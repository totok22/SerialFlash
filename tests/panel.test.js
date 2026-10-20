import test from "node:test";
import assert from "node:assert/strict";
import { SerialFlashPanel } from "../src/vscode/panel.js";

function fakeVscode(language) {
  return {
    env: { language },
    ViewColumn: { One: 1 },
    Uri: {
      joinPath(uri, ...parts) {
        return { fsPath: [uri.fsPath, ...parts].join("/") };
      },
    },
    window: {
      createWebviewPanel() {
        throw new Error("not used");
      },
    },
  };
}

function makePanel(controller) {
  const messages = [];
  const panel = new SerialFlashPanel(
    fakeVscode(),
    { extensionUri: { fsPath: "/extension" } },
    { show: () => controller.calls.push(["output"]) },
  );
  panel.controller = controller;
  panel.panel = {
    webview: {
      postMessage(message) {
        messages.push(message);
      },
    },
  };
  return { panel, messages };
}

function makeHtmlPanel(language) {
  const panel = new SerialFlashPanel(
    fakeVscode(language),
    { extensionUri: { fsPath: "/extension" } },
    { show: () => {} },
  );
  panel.panel = {
    webview: {
      cspSource: "vscode-resource:",
      asWebviewUri(uri) {
        return uri.fsPath;
      },
    },
  };
  return panel;
}

function fakeController() {
  const calls = [];
  return {
    calls,
    panelState: () => ({ settings: { firmware: "app.hex" } }),
    flashLatestFirmware: async () => calls.push(["flash"]),
    selectFirmware: async () => calls.push(["selectFirmware"]),
    selectSerialPort: async (force) => calls.push(["selectPort", force]),
    selectResetMode: async () => calls.push(["selectReset"]),
    resetToBootloader: async () => calls.push(["bootloader"]),
    resetAndRun: async () => calls.push(["run"]),
    runDiagnostics: async () => calls.push(["diagnostics"]),
    cancelFlash: () => calls.push(["cancel"]),
    eraseChip: async () => calls.push(["erase"]),
    verifyLatestFirmware: async () => calls.push(["verify"]),
    unlockReadProtection: async () => calls.push(["unlock"]),
    closeActivePort: async () => calls.push(["closePort"]),
    createProjectConfig: async () => calls.push(["projectConfig"]),
    createTasks: async () => calls.push(["createTasks"]),
    createProjectProfile: async () => calls.push(["createProfile"]),
    selectProjectProfile: async () => calls.push(["selectProfile"]),
    clearHistory: async () => calls.push(["clearHistory"]),
    clearRememberedDevice: async () => calls.push(["clearRemembered"]),
    updateSetting: async (key, value) => calls.push(["saveSetting", key, value]),
  };
}

test("panel ready message posts current state", async () => {
  const controller = fakeController();
  const { panel, messages } = makePanel(controller);

  await panel.handleMessage({ type: "ready" });

  assert.deepEqual(messages, [
    { type: "state", state: { settings: { firmware: "app.hex" } } },
  ]);
});

test("panel action messages dispatch to controller", async () => {
  const controller = fakeController();
  const { panel } = makePanel(controller);

  await panel.handleMessage({ type: "action", action: "flash" });
  await panel.handleMessage({ type: "action", action: "cancel" });
  await panel.handleMessage({ type: "action", action: "selectPort" });
  await panel.handleMessage({ type: "action", action: "diagnostics" });
  await panel.handleMessage({ type: "action", action: "saveSetting", key: "baudRate", value: 57600 });
  await panel.handleMessage({ type: "action", action: "createProfile" });

  assert.deepEqual(controller.calls, [
    ["flash"],
    ["cancel"],
    ["selectPort", true],
    ["diagnostics"],
    ["saveSetting", "baudRate", 57600],
    ["createProfile"],
  ]);
});

test("panel marks running-safe actions and cancel button", () => {
  const html = makeHtmlPanel().html();

  assert.match(html, /data-action="cancel" data-allow-running="true" data-requires-running="true"/);
  assert.match(html, /data-action="output" data-allow-running="true"/);
  assert.match(html, /data-action="diagnostics" data-allow-running="true"/);
  assert.match(html, /class="primary" data-action="flash"/);
});

test("panel includes troubleshooting output area", () => {
  const html = makeHtmlPanel().html();

  assert.match(html, /<h2>Troubleshooting<\/h2>/);
  assert.match(html, /<ul id="troubleshooting"><\/ul>/);
});

test("panel groups advanced and dangerous controls", () => {
  const html = makeHtmlPanel().html();

  assert.match(html, /<span>Flash parameters<\/span>/);
  assert.match(html, /<span>Hardware reset<\/span>/);
  assert.match(html, /<span>Projects and automation<\/span>/);
  assert.match(html, /<span>Maintenance and dangerous operations<\/span>/);
  assert.match(html, /data-action="unlock" class="danger"/);
  assert.match(html, /data-action="clearRemembered"/);
});

for (const language of [undefined, "en", "en-US", "de", "fr"]) {
  test(`panel defaults to English for ${language}`, () => {
    const html = makeHtmlPanel(language).html();
    assert.match(html, /<html lang="en">/);
    assert.doesNotMatch(html, /[\u3400-\u9fff]/);
    assert.match(html, /placeholder="Leave blank to use the HEX file address"/);
    assert.match(html, /aria-label="Flash progress"/);
    assert.match(html, /title="Select firmware" aria-label="Select firmware"/);
  });
}

for (const language of ["zh", "zh-CN", "zh-TW", "zh-HK", "zh-Hans", "ZH_hant"]) {
  test(`panel uses Chinese for ${language}`, () => {
    const html = makeHtmlPanel(language).html();
    assert.match(html, /<html lang="zh-CN">/);
    assert.match(html, /<span>烧录参数<\/span>/);
    assert.match(html, /placeholder="HEX 可留空使用文件地址"/);
    assert.match(html, /aria-label="烧录进度"/);
    assert.match(html, /title="选择固件" aria-label="选择固件"/);
    assert.match(html, /<option value="even">偶校验<\/option>/);
    assert.match(html, /<option value="dtr-true">DTR 低电平（true）<\/option>/);
  });
}


test("panel localizes known hints at the boundary without mutating state or translating logs", () => {
  const { panel, messages } = makePanel(fakeController());
  const hint = "关闭占用串口的串口监视器、终端、烧录工具或上一轮未释放的连接。";
  const state = { troubleshooting: [hint, "外部设备消息"], log: [hint], error: "设备错误", settings: {} };
  panel.postState(state);
  const sent = messages[0].state;
  assert.doesNotMatch(sent.troubleshooting[0], /[\u3400-\u9fff]/);
  assert.equal(sent.troubleshooting[1], "外部设备消息");
  assert.deepEqual(state.troubleshooting, [hint, "外部设备消息"]);
  assert.deepEqual(sent.log, [hint]);
  assert.equal(sent.error, "设备错误");
});
