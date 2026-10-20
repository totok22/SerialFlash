import test from "node:test";
import assert from "node:assert/strict";
import {
  formatFirmwareSize,
  shouldAutoSelectFirmware,
  sortFirmwareCandidates,
} from "../src/core/firmware-discovery.js";

test("sortFirmwareCandidates favors recent HEX files in firmware output folders", () => {
  const candidates = sortFirmwareCandidates([
    { relativePath: "notes/dump.bin", size: 64, mtimeMs: 3000 },
    { relativePath: "build/Debug/pdm.hex", size: 65536, mtimeMs: 2000 },
    { relativePath: "old/app.hex", size: 65536, mtimeMs: 1000 },
  ], {
    workspaceName: "pdm",
  });

  assert.equal(candidates[0].relativePath, "build/Debug/pdm.hex");
  assert.ok(candidates[0].score > candidates[1].score);
});

test("shouldAutoSelectFirmware requires a clear score gap", () => {
  assert.equal(shouldAutoSelectFirmware([{ score: 100 }]), true);
  assert.equal(shouldAutoSelectFirmware([{ score: 100 }, { score: 70 }]), false);
  assert.equal(shouldAutoSelectFirmware([{ score: 100 }, { score: 64 }]), true);
});

test("firmware discovery excludes CMake compiler checks without skewing firmware scores", () => {
  const firmware = { relativePath: "build/Debug/app.hex", size: 65536, mtimeMs: 1000 };
  const probes = [
    { relativePath: "build/Debug/CMakeFiles/4.4.2/CMakeDetermineCompilerABI_CXX.bin", size: 16384, mtimeMs: 9999999 },
    { path: "C:\\project\\build\\CMakeFiles\\4.4.2\\CMakeDetermineCompilerABI_C.bin", size: 16384, mtimeMs: 9999999 },
  ];

  assert.deepEqual(sortFirmwareCandidates([...probes, firmware]), sortFirmwareCandidates([firmware]));
  assert.deepEqual(sortFirmwareCandidates(probes), []);
  assert.equal(shouldAutoSelectFirmware(sortFirmwareCandidates(probes)), false);
});

test("formatFirmwareSize formats bytes and KiB", () => {
  assert.equal(formatFirmwareSize(512), "512 B");
  assert.equal(formatFirmwareSize(65536), "64 KB");
});
