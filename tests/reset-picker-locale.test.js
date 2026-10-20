import test from "node:test";
import assert from "node:assert/strict";
import { SerialFlashController } from "../src/vscode/commands.js";
import { getResetModes, RESET_MODES } from "../src/vscode/settings.js";

for (const language of [undefined, "en-US", "de", "zh-CN", "zh-TW"]) {
  test(`reset picker follows VS Code locale ${language} and saves stable IDs`, async () => {
    const updates = [];
    let items;
    let title;
    let refreshes = 0;
    const vscode = {
      env: { language },
      ConfigurationTarget: { Global: 2 },
      workspace: { getConfiguration: () => ({
        get: (key) => key === "resetMode" ? "ch340x" : undefined,
        inspect: () => ({}), update: async (...args) => updates.push(args),
      }) },
      window: { showQuickPick: async (choices, options) => {
        items = choices;
        title = options.title;
        return choices[1];
      } },
    };
    const result = await SerialFlashController.prototype.selectResetMode.call({
      vscode, context: { globalState: { get() {} } }, refreshViews: () => { refreshes++; },
    });
    const chinese = language?.startsWith("zh");
    assert.equal(title, chinese ? "选择复位模式" : "Select reset mode");
    assert.equal(items[1].description, chinese ? "上次使用" : "last used");
    assert.equal(items[0].label, chinese ? "CH340C 经典电路" : "CH340C classic circuit");
    for (const item of items) {
      if (chinese) assert.match(item.detail, /[\u3400-\u9fff]/);
      else assert.doesNotMatch(`${item.label} ${item.detail}`, /[\u3400-\u9fff]/);
    }
    assert.equal(result, "ch340x");
    assert.deepEqual(updates, [["resetMode", "ch340x", 2]]);
    assert.equal(refreshes, 1);
    assert.deepEqual(getResetModes(language).map(({ id }) => id), RESET_MODES.map(({ id }) => id));
  });
}

test("cancelling reset picker leaves settings unchanged", async () => {
  const vscode = {
    env: { language: "zh" },
    workspace: { getConfiguration: () => ({ get() {}, inspect: () => ({}) }) },
    window: { showQuickPick: async () => undefined },
  };
  const result = await SerialFlashController.prototype.selectResetMode.call({
    vscode, context: { globalState: { get() {} } }, refreshViews: () => assert.fail("cancelled picker refreshed"),
  });
  assert.equal(result, "");
});
