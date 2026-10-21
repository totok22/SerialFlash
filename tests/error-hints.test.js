import test from "node:test";
import assert from "node:assert/strict";
import { appendTroubleshooting, troubleshootingHints } from "../src/vscode/error-hints.js";

const CJK = /[㐀-鿿]/;

// One message per hint branch, so every registered hint is covered.
const ALL_HINT_ERRORS = [
  "Resource busy",
  "EACCES",
  "读取超时 (等待 Bootloader ACK)",
  "unexpected response",
  "Bootloader returned NACK",
  "Verify failed at 0x08004000",
  "Invalid HEX checksum",
  "serialport native module missing",
  "vendor fault",
];

function capture() {
  const lines = [];
  return { lines, append: (line) => lines.push(line) };
}

test("troubleshootingHints explains bootloader sync timeouts", () => {
  const hints = troubleshootingHints(new Error("读取超时 (等待 Bootloader ACK)"), {
    resetMode: "ch340x",
  });

  assert.ok(hints.some((hint) => hint.includes("BOOT0/RESET")));
  assert.ok(hints.some((hint) => hint.includes("ch340x")));
});

test("troubleshootingHints explains busy ports and permission failures", () => {
  const hints = troubleshootingHints(new Error("Resource busy EACCES"));

  assert.ok(hints.some((hint) => hint.includes("占用串口")));
  assert.ok(hints.some((hint) => hint.includes("dialout")));
});

test("troubleshootingHints warns before read protection unlock", () => {
  const hints = troubleshootingHints(new Error("Bootloader returned NACK"));

  assert.ok(hints.some((hint) => hint.includes("读保护")));
  assert.ok(hints.some((hint) => hint.includes("全片擦除")));
});

test("troubleshootingHints explains verify address mismatches", () => {
  const hints = troubleshootingHints(new Error("Verify failed at 0x08004000"));

  assert.ok(hints.some((hint) => hint.includes("flashAddress")));
});

for (const language of [undefined, "en", "en-US", "fr"]) {
  test(`appendTroubleshooting writes English hints for locale ${language}`, () => {
    const output = capture();
    appendTroubleshooting(output, new Error("读取超时 (等待 Bootloader ACK)"), { resetMode: "ch340x" }, language);

    assert.equal(output.lines[0], "Troubleshooting:");
    assert.ok(output.lines.some((line) => line.startsWith("- No Bootloader ACK received")));
    assert.ok(output.lines.some((line) => line.includes("Current reset mode is ch340x")));
    assert.doesNotMatch(output.lines.join("\n"), CJK);
  });
}

for (const language of ["zh", "zh-CN", "zh-TW"]) {
  test(`appendTroubleshooting writes Chinese hints for locale ${language}`, () => {
    const output = capture();
    appendTroubleshooting(output, new Error("Resource busy EACCES"), {}, language);

    assert.equal(output.lines[0], "故障排查:");
    assert.ok(output.lines.some((line) => line.includes("占用串口")));
    assert.ok(output.lines.some((line) => line.includes("dialout")));
  });
}

test("appendTroubleshooting localizes every hint without leaving Chinese in English output", () => {
  for (const message of ALL_HINT_ERRORS) {
    const english = capture();
    const hints = appendTroubleshooting(english, new Error(message), { resetMode: "ch340x" }, "en");
    assert.equal(english.lines.length, hints.length + 1, message);
    assert.doesNotMatch(english.lines.slice(1).join("\n"), CJK, message);

    const chinese = capture();
    appendTroubleshooting(chinese, new Error(message), { resetMode: "ch340x" }, "zh-CN");
    assert.deepEqual(chinese.lines.slice(1), hints.map((hint) => `- ${hint}`), message);
  }
});

test("appendTroubleshooting returns the unlocalized hints for dialogs and the panel", () => {
  const error = new Error("Bootloader returned NACK");
  const hints = appendTroubleshooting(capture(), error, {}, "en");

  assert.deepEqual(hints, troubleshootingHints(error));
});
