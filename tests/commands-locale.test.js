import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SerialPort } from "serialport";
import { SerialFlashController } from "../src/vscode/commands.js";
import { NodeSerialTransport } from "../src/node-serial-transport.js";
import { Stm32Bootloader, ACK } from "../src/stm32.js";
import { createTranslator, getTranslations } from "../src/vscode/i18n.js";

function controller(language) {
  const warnings = [];
  const information = [];
  const errors = [];
  const logs = [];
  const saved = new Map();
  const settings = { resetMode: "none", eraseBeforeWrite: false, verifyAfterWrite: false, runAfterWrite: false };
  const vscode = {
    env: { language },
    StatusBarAlignment: { Left: 1 },
    ConfigurationTarget: { Global: 2 },
    workspace: {
      findFiles: async () => [],
      getConfiguration: () => ({ get: (key) => settings[key], inspect: () => ({}), update: async () => {} }),
    },
    window: {
      createStatusBarItem: () => ({ show() {} }),
      showWarningMessage: async (message) => { warnings.push(message); },
      showInformationMessage: async (message) => { information.push(message); },
      showErrorMessage: async (message) => { errors.push(message); },
    },
  };
  const instance = new SerialFlashController(vscode, {
    globalState: { get: (key, fallback) => saved.get(key) ?? fallback, update: async (key, value) => saved.set(key, value) },
  }, { show() {}, append: (line) => logs.push(line) }, null);
  return { instance, warnings, information, errors, logs };
}

function fakeTransport(t, error) {
  t.mock.method(NodeSerialTransport.prototype, "open", async () => {});
  t.mock.method(NodeSerialTransport.prototype, "close", async () => {});
  t.mock.method(NodeSerialTransport.prototype, "write", async () => {});
  t.mock.method(NodeSerialTransport.prototype, "readExact", async () => {
    if (error) throw error;
    return new Uint8Array([ACK]);
  });
}

for (const language of [undefined, "en-US", "zh-CN", "zh-TW"]) {
  test(`firmware and port warnings follow VS Code locale ${language}`, async (t) => {
    const view = controller(language);
    t.mock.method(SerialPort, "list", async () => []);
    await view.instance.flashCurrentFile({ fsPath: "/tmp/main.c" });
    await view.instance.selectFirmware();
    await view.instance.resolveFirmwareForFlash();
    await view.instance.selectSerialPort(true);
    const translate = createTranslator(language);
    assert.deepEqual(view.warnings, [
      translate("The current file is not .hex or .bin firmware."),
      translate("No .hex or .bin firmware found in the workspace."),
      translate("No .hex or .bin firmware found in the workspace."),
      translate("No serial devices found."),
    ]);
    if (!language?.startsWith("zh")) assert.doesNotMatch(view.warnings.join("\n"), /[\u3400-\u9fff]/);
    else for (const message of view.warnings) assert.match(message, /[\u3400-\u9fff]/);
  });
}

for (const language of ["en", "zh-HK"]) {
  test(`flash completion and failure dialogs use localized known copy in ${language}`, async (t) => {
    const folder = await mkdtemp(join(tmpdir(), "serialflash-locale-"));
    t.after(() => rm(folder, { recursive: true, force: true }));
    const path = join(folder, "app.bin");
    await writeFile(path, new Uint8Array([0, 1, 2, 3]));
    const candidate = { path, relativePath: "app.bin" };
    const view = controller(language);
    view.instance.selectSerialPort = async () => "/dev/serialflash-test";
    fakeTransport(t);
    t.mock.method(Stm32Bootloader.prototype, "getCommands", async () => ({ version: 0x31 }));
    t.mock.method(Stm32Bootloader.prototype, "getId", async () => 0x410);
    t.mock.method(Stm32Bootloader.prototype, "writeMemory", async () => {});
    await view.instance.flashCandidate(candidate);
    assert.deepEqual(view.information, [createTranslator(language)("SerialFlash: Flashing complete.")]);

    const error = new Error("EBUSY vendor fault");
    t.mock.method(NodeSerialTransport.prototype, "readExact", async () => { throw error; });
    await view.instance.flashCandidate(candidate);
    assert.equal(view.errors.length, 1);
    assert.ok(view.errors[0].includes(error.message));
    if (language === "en") assert.doesNotMatch(view.errors[0], /[\u3400-\u9fff]/);
    else assert.match(view.errors[0], /关闭占用串口/);
    assert.ok(view.logs.includes(`Error: ${error.message}`), "external error text stays verbatim in the output log");
    if (language === "en") {
      assert.ok(view.logs.includes("Troubleshooting:"));
      assert.ok(view.logs.some((line) => line.includes("Close serial monitors")));
      assert.ok(!view.logs.some((line) => line.includes("关闭占用串口")), "output hints follow the English locale");
    } else {
      assert.ok(view.logs.includes("故障排查:"));
      assert.ok(view.logs.some((line) => line.includes("关闭占用串口")));
      assert.ok(!view.logs.some((line) => line.includes("Close serial monitors")), "output hints follow the Chinese locale");
    }
  });
}

for (const method of ["runBootloaderAction", "runResetAction"]) {
  test(`${method} localizes known dialog hints and preserves external errors`, async (t) => {
    const view = controller("en");
    view.instance.selectSerialPort = async () => "/dev/serialflash-test";
    const error = new Error("EBUSY vendor 故障");
    fakeTransport(t, error);
    await assert.rejects(view.instance[method]("Test operation", async () => { throw error; }), error);
    assert.equal(view.errors.length, 1);
    assert.ok(view.errors[0].includes(error.message));
    assert.match(view.errors[0], /Close serial monitors/);
    assert.doesNotMatch(view.errors[0], /关闭占用串口/);
    assert.ok(view.logs.includes("Troubleshooting:"));
    assert.ok(view.logs.some((line) => line.includes("Close serial monitors")));
    assert.ok(!view.logs.some((line) => line.includes("关闭占用串口")), "output hints follow the English locale");
  });
}

test("commands contain no hardcoded Chinese and all translation calls have Chinese copy", () => {
  const source = readFileSync(new URL("../src/vscode/commands.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /[\u3400-\u9fff]/);
  const messages = getTranslations("zh");
  for (const [, key] of source.matchAll(/\bt\("([^"]+)"\)/g)) {
    assert.ok(Object.hasOwn(messages, key), `Missing Chinese translation: ${key}`);
  }
});
