import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createTranslator, getTranslations, localizePanelHints, normalizeLanguage } from "../src/vscode/i18n.js";
import { troubleshootingHints } from "../src/vscode/error-hints.js";
import { getResetModes } from "../src/vscode/settings.js";

const script = readFileSync(new URL("../src/vscode/media/panel.js", import.meta.url), "utf8");

class Element {
  constructor() {
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.attributes = {};
    this.listeners = {};
    this.text = "";
  }
  get textContent() { return this.text + this.children.map((child) => child.textContent).join(""); }
  set textContent(value) { this.text = value; this.children = []; }
  replaceChildren(...children) { this.text = ""; this.children = children; }
  append(...children) { this.children.push(...children); }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, listener) { this.listeners[name] = listener; }
}

function webview(language) {
  const elements = new Map();
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  get("serialflash-locale").textContent = JSON.stringify({
    language: normalizeLanguage(language), messages: getTranslations(language), resetModes: getResetModes(language),
  });
  const input = new Element();
  input.dataset.setting = "customReset.boot0High";
  input.value = "dtr-true";
  const buttons = [new Element(), new Element(), new Element()];
  buttons[0].dataset.action = "flash";
  buttons[1].dataset = { action: "output", allowRunning: "true" };
  buttons[2].dataset = { action: "cancel", allowRunning: "true", requiresRunning: "true" };
  const sent = [];
  let receive;
  runInNewContext(script, {
    acquireVsCodeApi: () => ({ postMessage: (message) => sent.push(message) }),
    document: {
      body: { dataset: {} },
      getElementById: get,
      createElement: () => new Element(),
      querySelector: () => get("progress"),
      querySelectorAll: (selector) => selector === "[data-setting]" ? [input] : buttons,
    },
    window: { addEventListener: (_, listener) => { receive = listener; } },
  });
  return { get, input, buttons, sent, render: (state) => receive({ data: { type: "state", state } }) };
}

test("translator defaults to English, preserves unknown text, and returns independent dictionaries", () => {
  assert.equal(normalizeLanguage("zh-Hant-TW"), "zh");
  assert.equal(normalizeLanguage("zhfoo"), "en");
  assert.equal(normalizeLanguage(null), "en");
  assert.equal(createTranslator("zh")("Cancel"), "取消");
  assert.equal(createTranslator("en")("未知设备输出"), "未知设备输出");
  assert.equal(createTranslator("zh")("Vendor message {id}", { id: "$&" }), "Vendor message $&");
  assert.equal(createTranslator("zh")("toString"), "toString");
  const messages = getTranslations("zh");
  messages.Cancel = "changed";
  assert.equal(createTranslator("zh")("Cancel"), "取消");
});

test("every static and dynamic panel translation key has Chinese copy", () => {
  const sources = [script, readFileSync(new URL("../src/vscode/panel.js", import.meta.url), "utf8")];
  const messages = getTranslations("zh");
  for (const source of sources) {
    for (const [, key] of source.matchAll(/\bt\("([^"]+)"\)/g)) {
      assert.ok(Object.hasOwn(messages, key), `Missing Chinese translation: ${key}`);
    }
  }
  assert.deepEqual(Object.keys(getTranslations("en")), Object.keys(messages));
});

for (const language of ["en", "zh-TW"]) {
  test(`webview localizes empty state, progress, options, history and diagnostics in ${language}`, () => {
    const view = webview(language);
    const t = createTranslator(language);
    view.render({});
    assert.equal(view.get("phase").textContent, t("Idle"));
    assert.equal(view.get("firmware").textContent, t("No firmware selected"));
    assert.equal(view.get("port").textContent, t("No port selected"));
    assert.equal(view.get("history").textContent, t("No flash history"));
    assert.equal(view.get("log").textContent, t("No output yet"));
    view.render({ running: true, phase: "write", progress: 42, settings: { resetMode: "ch340x", eraseBeforeWrite: true } });
    assert.equal(view.get("phase").textContent, t("Writing"));
    assert.equal(view.get("progress").attributes["aria-valuenow"], "42");
    assert.equal(view.get("reset").textContent, t("CH340X direct circuit"));
    assert.equal(view.get("optionPills").children[0].title, `${t("Erase")}: ${t("Enabled")}`);
    assert.equal(view.get("optionPills").children[1].title, `${t("Verify")}: ${t("Disabled")}`);
    assert.equal(view.buttons[0].disabled, true);
    assert.equal(view.buttons[1].disabled, false);
    assert.equal(view.buttons[2].disabled, false);
    view.render({ running: true, phase: "verify" });
    assert.equal(view.get("phase").textContent, t("Verifying"));
    view.render({ running: true, phase: "Cancelling" });
    assert.equal(view.get("phase").textContent, t("Cancelling"));
    view.render({ progress: 100, phase: "verify", history: [{ success: false }, { firmware: "app.hex" }], diagnostics: {
      extensionHost: { remoteName: "local", platform: "darwin", arch: "arm64" },
      serialport: { loaded: true }, ports: [{ path: "/dev/test", serialNumber: "123" }],
    } });
    assert.equal(view.get("phase").textContent, t("Done"));
    assert.equal(view.get("history").children[0].textContent, t("Unknown firmware") + t("Failed"));
    assert.equal(view.get("history").children[1].textContent, "app.hex" + t("Done"));
    assert.match(view.get("diagnostics").textContent, new RegExp(`${t("Host")}: ${t("Local")}`));
    assert.ok(view.get("diagnostics").textContent.includes(`${t("Serial number")} 123`));
    assert.equal(view.get("diagnosticsCard").hidden, false);
    if (language === "en") {
      for (const id of ["phase", "firmware", "port", "reset", "history", "diagnostics", "optionPills"]) {
        assert.doesNotMatch(view.get(id).textContent, /[\u3400-\u9fff]/);
      }
    }
  });
}

test("webview preserves external logs, errors, paths, hints and settings values verbatim", () => {
  const view = webview("en");
  const external = "厂商错误: write / verify <script>中文</script>";
  view.render({ error: external, log: [external], troubleshooting: [external], settings: {
    firmware: "固件/app.hex", resetMode: "vendor-mode", customReset: { boot0High: "rts-false" },
  } });
  assert.equal(view.get("log").textContent, external);
  assert.equal(view.get("phase").textContent, external);
  assert.equal(view.get("troubleshooting").textContent, external);
  assert.equal(view.get("firmware").textContent, "固件/app.hex");
  assert.equal(view.get("reset").textContent, "vendor-mode");
  assert.equal(view.input.value, "rts-false");
  view.input.listeners.change();
  assert.deepEqual(JSON.parse(JSON.stringify(view.sent.at(-1))), {
    type: "action", action: "saveSetting", key: "customReset.boot0High", value: "rts-false",
  });
});

test("known application troubleshooting copy localizes without rewriting unknown hints", () => {
  const resetMode = "dtr-low-rts-high";
  const hints = troubleshootingHints(new Error("EBUSY EACCES timeout unexpected response NACK verify failed invalid firmware serialport"), { resetMode });
  hints.push(...troubleshootingHints(new Error("other")));
  const english = localizePanelHints(hints, "en", resetMode);
  assert.equal(english.length, hints.length);
  assert.doesNotMatch(english.join("\n"), /[\u3400-\u9fff]/);
  assert.ok(english.some((hint) => hint.includes(resetMode)));
  assert.deepEqual(localizePanelHints(english, "zh-Hant", resetMode), hints);
  assert.deepEqual(localizePanelHints(["vendor 中文 output", "外部 write verify"], "en", resetMode), ["vendor 中文 output", "外部 write verify"]);
});
