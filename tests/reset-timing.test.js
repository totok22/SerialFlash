import test from "node:test";
import assert from "node:assert/strict";
import { bootloaderEntryStages, enterBootloader, resetToRun, prepareForGo } from "../src/core/reset-timing.js";
import { NodeSerialTransport } from "../src/node-serial-transport.js";

test("bootloaderEntryStages returns CH340X direct preset", () => {
  const stages = bootloaderEntryStages("ch340x");

  assert.deepEqual(stages, [
    {
      name: "CH340X 直连电路",
      config: "ch340x",
    },
  ]);
});

test("bootloaderEntryStages keeps normal modes single-stage", () => {
  assert.deepEqual(bootloaderEntryStages("dtr-low-rts-high"), [
    { name: "default", config: "dtr-low-rts-high" },
  ]);
});

test("enterBootloader applies CH340X direct timing", async () => {
  const calls = [];
  const transport = {
    async setSignals(signals) {
      calls.push(["signals", signals]);
    },
  };

  await enterBootloader(transport, async (ms) => calls.push(["delay", ms]), "ch340x");

  assert.deepEqual(calls, [
    ["signals", { requestToSend: false, dataTerminalReady: true }],
    ["delay", 150],
    ["signals", { requestToSend: true, dataTerminalReady: true }],
    ["delay", 150],
    ["signals", { requestToSend: true, dataTerminalReady: false }],
    ["delay", 150],
    ["signals", { requestToSend: true, dataTerminalReady: true }],
    ["delay", 1000],
  ]);
});

test("enterBootloader applies generic BOOT/RESET preset", async () => {
  const calls = [];
  const transport = {
    async setSignals(signals) {
      calls.push(["signals", signals]);
    },
  };

  await enterBootloader(transport, async (ms) => calls.push(["delay", ms]), "boot-dtr-high-reset-rts-low");

  assert.deepEqual(calls, [
    ["signals", { dataTerminalReady: false }],
    ["delay", 100],
    ["signals", { requestToSend: true }],
    ["delay", 100],
    ["signals", { requestToSend: false }],
    ["delay", 800],
  ]);
});

test("CH340C entry explicitly preserves the coupled legacy line sequence", async () => {
  const calls = [];
  await enterBootloader({ setSignals: async (value) => calls.push(value) },
    async (ms) => calls.push(ms), "dtr-low-rts-high");
  assert.deepEqual(calls, [
    { dataTerminalReady: false, requestToSend: true }, 100,
    { dataTerminalReady: true, requestToSend: false }, 100,
    { dataTerminalReady: false, requestToSend: false }, 800,
  ]);
});

test("resetToRun applies CH340X run timing", async () => {
  const calls = [];
  const transport = {
    async setSignals(signals) {
      calls.push(["signals", signals]);
    },
  };

  await resetToRun(transport, async (ms) => calls.push(["delay", ms]), "ch340x");

  assert.deepEqual(calls, [
    ["signals", { requestToSend: true, dataTerminalReady: false }],
    ["delay", 250],
    ["signals", { requestToSend: false, dataTerminalReady: false }],
    ["delay", 250],
    ["signals", { requestToSend: true, dataTerminalReady: false }],
    ["delay", 1000],
  ]);
});

test("generic reset retains the configured run state and all fixed waits", async () => {
  const signals = [];
  const waits = [];
  await resetToRun({ setSignals: async (value) => signals.push(value) },
    async (ms) => waits.push(ms), "boot-rts-high-reset-dtr-high");
  assert.deepEqual(signals.at(-1), { requestToSend: true, dataTerminalReady: true });
  assert.deepEqual(waits, [100, 100, 200, 800]);
});

test("GO releases CH340C BOOT0 without asserting RESET", async () => {
  const calls = [];
  assert.equal(await prepareForGo({ setSignals: async (value) => calls.push(value) },
    async (ms) => calls.push(ms), "dtr-low-rts-high"), true);
  assert.deepEqual(calls, [{ dataTerminalReady: false, requestToSend: true }, 100]);
});

test("CH340C reset returns to its coupled run state with original waits", async () => {
  const calls = [];
  await resetToRun({ setSignals: async (value) => calls.push(value) },
    async (ms) => calls.push(ms), "dtr-low-rts-high");
  assert.deepEqual(calls, [
    { dataTerminalReady: false, requestToSend: true }, 100,
    { dataTerminalReady: true, requestToSend: false }, 100,
    { dataTerminalReady: false, requestToSend: true }, 200,
    { dataTerminalReady: false, requestToSend: true }, 800,
  ]);
});

test("GO respects custom BOOT and reset polarity", async () => {
  const calls = [];
  await prepareForGo({ setSignals: async (value) => calls.push(value) }, async () => {}, {
    boot0High: "dtr-false", boot0Low: "dtr-true", resetAssert: "rts-false",
  });
  assert.deepEqual(calls, [{ dataTerminalReady: true, requestToSend: true }]);
});

test("CH340X GO restores BOOT0 while preserving the synchronized RESET state", async () => {
  const signals = [];
  const waits = [];
  const transport = { setSignals: async (value) => signals.push(value) };
  await enterBootloader(transport, async () => {}, "ch340x");
  const synchronized = signals.at(-1);
  assert.equal(await prepareForGo(transport, async (ms) => waits.push(ms), "ch340x"), true);
  assert.equal(signals.at(-1).requestToSend, synchronized.requestToSend);
  assert.equal(signals.at(-1).dataTerminalReady, false);
  assert.deepEqual(waits, [250]);
});

test("manual GO does not drive control lines", async () => {
  const unexpected = async () => assert.fail("unexpected control line transition or delay");
  assert.equal(await prepareForGo({ setSignals: unexpected }, unexpected, "none"), false);
});

test("CH340X end states pass complete native flags with inversion only in the adapter", async () => {
  const calls = [];
  const transport = new NodeSerialTransport({
    set(flags, callback) { calls.push(flags); callback(); },
  });
  await enterBootloader(transport, async () => {}, "ch340x");
  const synchronized = calls.at(-1);
  await prepareForGo(transport, async () => {}, "ch340x");
  assert.equal(calls.at(-1).rts, synchronized.rts);
  assert.deepEqual(calls.at(-1), { dtr: true, rts: false });
  await resetToRun(transport, async () => {}, "ch340x");
  assert.deepEqual(calls.slice(-3), [
    { dtr: true, rts: false },
    { dtr: true, rts: true },
    { dtr: true, rts: false },
  ]);
});
