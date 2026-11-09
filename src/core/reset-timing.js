function invertChoice(choice) {
  return choice.replace("true", "TMP").replace("false", "true").replace("TMP", "false");
}

function applyChoice(signals, choice) {
  const [name, rawValue] = choice.split("-");
  const value = rawValue === "true";
  if (name === "dtr") signals.dataTerminalReady = value;
  if (name === "rts") signals.requestToSend = value;
}

function signalsForChoice(choice) {
  const signals = {};
  applyChoice(signals, choice);
  return signals;
}

function isCh340xMode(modeOrConfig) {
  return modeOrConfig === "ch340x";
}

const RESET_PRESETS = {
  "dtr-high-rts-low": { boot0High: "rts-true", boot0Low: "rts-false", resetAssert: "dtr-false" },
  "dtr-low-rts-high": { boot0High: "rts-true", boot0Low: "rts-false", resetAssert: "dtr-true" },
  "boot-rts-low-reset-dtr-low": { boot0High: "rts-true", boot0Low: "rts-false", resetAssert: "dtr-true" },
  "boot-rts-low-reset-dtr-high": { boot0High: "rts-true", boot0Low: "rts-false", resetAssert: "dtr-false" },
  "boot-rts-high-reset-dtr-low": { boot0High: "rts-false", boot0Low: "rts-true", resetAssert: "dtr-true" },
  "boot-rts-high-reset-dtr-high": { boot0High: "rts-false", boot0Low: "rts-true", resetAssert: "dtr-false" },
  "boot-dtr-low-reset-rts-low": { boot0High: "dtr-true", boot0Low: "dtr-false", resetAssert: "rts-true" },
  "boot-dtr-low-reset-rts-high": { boot0High: "dtr-true", boot0Low: "dtr-false", resetAssert: "rts-false" },
  "boot-dtr-high-reset-rts-low": { boot0High: "dtr-false", boot0Low: "dtr-true", resetAssert: "rts-true" },
  "boot-dtr-high-reset-rts-high": { boot0High: "dtr-false", boot0Low: "dtr-true", resetAssert: "rts-false" },
};

function normalizeResetConfig(modeOrConfig) {
  if (!modeOrConfig) return RESET_PRESETS["dtr-high-rts-low"];
  if (isCh340xMode(modeOrConfig) || modeOrConfig === "none") return null;
  if (RESET_PRESETS[modeOrConfig]) return RESET_PRESETS[modeOrConfig];

  if (typeof modeOrConfig === "object") {
    const boot0High = modeOrConfig.boot0High ?? "dtr-false";
    return {
      boot0High,
      boot0Low: modeOrConfig.boot0Low ?? invertChoice(boot0High),
      resetAssert: modeOrConfig.resetAssert ?? "rts-true",
    };
  }

  return { boot0High: "dtr-false", boot0Low: "dtr-true", resetAssert: "rts-true" };
}

export function bootloaderEntryStages(modeOrConfig) {
  if (isCh340xMode(modeOrConfig)) {
    return [
      {
        name: "CH340X 直连电路",
        config: "ch340x",
      },
    ];
  }
  return [{ name: "default", config: modeOrConfig }];
}

// STM32 进入 Bootloader 物理时序。项目内部约定 true 为低电平、false 为高电平。
export async function enterBootloader(transport, delay, modeOrConfig) {
  if (modeOrConfig === "dtr-low-rts-high") {
    // The classic transistor circuit couples both lines. Preserve the effective
    // legacy sequence explicitly instead of relying on SerialPort's omitted-line defaults.
    await transport.setSignals({ dataTerminalReady: false, requestToSend: true });
    await delay(100);
    await transport.setSignals({ dataTerminalReady: true, requestToSend: false });
    await delay(100);
    await transport.setSignals({ dataTerminalReady: false, requestToSend: false });
    await delay(800);
    return;
  }

  if (isCh340xMode(modeOrConfig)) {
    // 保留已使用的 CH340X 入口组合；最终 RTS 为 true，DTR 为 true。
    await transport.setSignals({ requestToSend: false, dataTerminalReady: true });
    await delay(150);

    await transport.setSignals({ requestToSend: true, dataTerminalReady: true });
    await delay(150);

    await transport.setSignals({ requestToSend: true, dataTerminalReady: false });
    await delay(150);

    await transport.setSignals({ requestToSend: true, dataTerminalReady: true });
    await delay(1000);
    return;
  }

  const config = normalizeResetConfig(modeOrConfig);
  if (!config) return;

  await transport.setSignals(signalsForChoice(config.boot0High));
  await delay(100);

  await transport.setSignals(signalsForChoice(config.resetAssert));
  await delay(100);

  await transport.setSignals(signalsForChoice(invertChoice(config.resetAssert)));
  await delay(800);
}

export async function resetToRun(transport, delay, modeOrConfig) {
  if (modeOrConfig === "dtr-low-rts-high") {
    // CH340C's transistor network couples BOOT0 and NRST. Release both into
    // the board's run state instead of leaving the bootloader entry state latched.
    const runSignals = { dataTerminalReady: false, requestToSend: true };
    await transport.setSignals(runSignals);
    await delay(100);
    await transport.setSignals({ dataTerminalReady: true, requestToSend: false });
    await delay(100);
    await transport.setSignals(runSignals);
    await delay(200);
    await transport.setSignals(runSignals);
    await delay(800);
    return;
  }

  if (isCh340xMode(modeOrConfig)) {
    // CH340X 参考直连：DTR 接 BOOT0，RTS 接 NRST。
    // 保持 DTR 运行态，切换 RTS 复位；请求值的取反仍只在 Node 适配层完成。
    await transport.setSignals({ requestToSend: true, dataTerminalReady: false });
    await delay(250);

    await transport.setSignals({ requestToSend: false, dataTerminalReady: false });
    await delay(250);

    await transport.setSignals({ requestToSend: true, dataTerminalReady: false });
    await delay(1000);
    return;
  }

  const config = normalizeResetConfig(modeOrConfig);
  if (!config) return;

  await transport.setSignals(signalsForChoice(config.boot0Low));
  await delay(100);

  await transport.setSignals(signalsForChoice(config.resetAssert));
  await delay(100);

  await transport.setSignals(signalsForChoice(invertChoice(config.resetAssert)));
  await delay(200);

  // Keep this preset's BOOT0-low and RESET-released state, including custom polarities.
  const runSignals = signalsForChoice(config.boot0Low);
  applyChoice(runSignals, invertChoice(config.resetAssert));
  await transport.setSignals(runSignals);
  await delay(800);
}

export async function prepareForGo(transport, delay, modeOrConfig) {
  if (modeOrConfig === "dtr-low-rts-high") {
    // Keep DTR unchanged from synchronized entry; RTS restores the classic
    // circuit's run condition without pulsing RESET before GO.
    await transport.setSignals({ dataTerminalReady: false, requestToSend: true });
    await delay(100);
    return true;
  }

  if (isCh340xMode(modeOrConfig)) {
    // 保持入口结束时的 RTS，不产生 NRST 脉冲；仅恢复 DTR 的 BOOT0 运行态。
    await transport.setSignals({ requestToSend: true, dataTerminalReady: false });
    await delay(250);
    return true;
  }

  const config = normalizeResetConfig(modeOrConfig);
  if (!config) return false;
  const signals = signalsForChoice(config.boot0Low);
  applyChoice(signals, invertChoice(config.resetAssert));
  await transport.setSignals(signals);
  await delay(100);
  return true;
}
