import test from "node:test";
import assert from "node:assert/strict";
import { flashStm32Uart, syncBootloaderIgnoringNoise } from "../src/core/flash-session.js";
import { ACK, NACK, addressPacket } from "../src/stm32.js";

class MockTransport {
  constructor(reads) {
    this.reads = reads.map((bytes) => bytes instanceof Error ? bytes : Array.from(bytes));
    this.writes = [];
    this.signals = [];
    this.opened = false;
    this.closed = false;
  }

  async open() {
    this.opened = true;
  }

  async close() {
    this.closed = true;
  }

  async write(bytes) {
    this.writes.push(Array.from(bytes));
  }

  async readExact(length) {
    const next = this.reads.shift();
    if (next instanceof Error) throw next;
    assert.ok(next, `missing mock read of ${length} bytes`);
    assert.equal(next.length, length);
    return new Uint8Array(next);
  }

  async flushReadBuffer() {}

  async setSignals(signals) {
    this.signals.push(signals);
  }
}

test("flashStm32Uart opens, writes, verifies, runs, and closes transport", async () => {
  const reads = [
    [ACK], // sync
    [ACK], // GET command ACK
    [0x07],
    [0x31, 0x00, 0x02, 0x11, 0x21, 0x31, 0x43, 0x44],
    [ACK],
    [ACK], // GET_ID command ACK
    [0x01],
    [0x04, 0x13],
    [ACK],
    [ACK], // EXTENDED_ERASE command ACK
    [ACK], // extended erase ACK
    [ACK], // WRITE_MEMORY command ACK
    [ACK], // write address ACK
    [ACK], // write data ACK
    [ACK], // READ_MEMORY command ACK
    [ACK], // read address ACK
    [ACK], // read length ACK
    [0xaa, 0xbb], // verify payload
  ];
  const transport = new MockTransport(reads);
  const logs = [];
  const progress = [];

  await flashStm32Uart({
    transport,
    firmware: { bytes: new Uint8Array([0xaa, 0xbb]), format: "bin", baseAddress: null },
    address: 0x08000000,
    resetMode: "none",
    packetSize: 2,
    onLog: (message) => logs.push(message),
    onProgress: (event) => progress.push(event),
  });

  assert.equal(transport.opened, true);
  assert.equal(transport.closed, true);
  assert.deepEqual(transport.writes[0], [0x7f]);
  assert.ok(transport.writes.some((bytes) => bytes[0] === 0x31));
  assert.ok(transport.writes.some((bytes) => bytes[0] === 0x11));
  assert.ok(logs.includes("Done"));
  assert.ok(logs.includes("Run skipped: manual reset required"));
  assert.equal(progress.at(-1).phase, "verify");
  assert.equal(progress.at(-1).percent, 100);
});

test("flashStm32Uart can leave transport open after successful flash", async () => {
  const reads = [
    [ACK],
    [ACK],
    [0x07],
    [0x31, 0x00, 0x02, 0x11, 0x21, 0x31, 0x43, 0x44],
    [ACK],
    [ACK],
    [0x01],
    [0x04, 0x13],
    [ACK],
    [ACK],
    [ACK],
  ];
  const transport = new MockTransport(reads);

  await flashStm32Uart({
    transport,
    firmware: { bytes: new Uint8Array([]), format: "bin", baseAddress: null },
    address: 0x08000000,
    resetMode: "none",
    erase: true,
    verify: false,
    run: false,
    close: false,
  });

  assert.equal(transport.closed, false);
});

test("flashStm32Uart closes transport on failure even when close is false", async () => {
  const transport = new MockTransport([[0x00]]);

  await assert.rejects(
    () => flashStm32Uart({
      transport,
      firmware: { bytes: new Uint8Array([0xaa]), format: "bin", baseAddress: null },
      address: 0x08000000,
      resetMode: "none",
      close: false,
    }),
    /已忽略 1 字节非 Bootloader 响应: 0x00/,
  );

  assert.equal(transport.closed, true);
});

test("syncBootloaderIgnoringNoise ignores non bootloader bytes before ACK", async () => {
  const transport = new MockTransport([[0x43], [0x00], [ACK]]);

  const ignored = await syncBootloaderIgnoringNoise(transport, 1000);

  assert.deepEqual(ignored, [0x43, 0x00]);
  assert.deepEqual(transport.writes, [[0x7f]]);
});

test("syncBootloaderIgnoringNoise reports ignored bytes on timeout", async () => {
  const transport = new MockTransport([[0x43]]);

  await assert.rejects(
    () => syncBootloaderIgnoringNoise(transport, 1000),
    /已忽略 1 字节非 Bootloader 响应: 0x43/,
  );
});

function goSessionReads({ supported = true, verify = [0xaa, 0xbb], go = [[ACK], [ACK]] } = {}) {
  return [
    [ACK], [ACK], [0x04], [0x31, 0x00, 0x02, 0x31, supported ? 0x21 : 0x11], [ACK],
    [ACK], [0x01], [0x04, 0x10], [ACK],
    [ACK], [ACK], [ACK], // write
    [ACK], [ACK], [ACK], verify, // verify
    ...go,
  ];
}

function goOptions(transport, overrides = {}) {
  return {
    transport, firmware: { bytes: new Uint8Array([0xaa, 0xbb]), format: "hex", baseAddress: 0x08004000 },
    resetMode: "none", runMode: "go", erase: false, ...overrides,
  };
}

test("GO follows verify, uses HEX base or explicit override, and honors close=false", async () => {
  for (const address of [undefined, 0x08008000]) {
    const transport = new MockTransport(goSessionReads());
    const logs = [];
    await flashStm32Uart(goOptions(transport, { address, close: false, onLog: (line) => logs.push(line) }));
    assert.deepEqual(transport.writes.slice(-2), [[0x21, 0xde], addressPacket(address ?? 0x08004000)]);
    assert.equal(transport.reads.length, 0);
    assert.equal(transport.closed, false);
    assert.deepEqual(transport.signals, []);
    assert.ok(logs.findIndex((line) => line.startsWith("GO command acknowledged:")) > logs.indexOf("Verify complete"));
    assert.ok(logs.some((line) => line.includes("application execution not confirmed")));
  }
});

test("unsupported GO fails before erasing or writing", async () => {
  const transport = new MockTransport(goSessionReads({ supported: false }));
  await assert.rejects(flashStm32Uart(goOptions(transport, { erase: true })), /does not support GO/);
  assert.deepEqual(transport.writes, [[0x7f], [0x00, 0xff], [0x02, 0xfd]]);
  assert.equal(transport.closed, true);
});

test("CH340C flash prepares its coupled run state before GO", async () => {
  const transport = new MockTransport(goSessionReads());
  await flashStm32Uart(goOptions(transport, { resetMode: "dtr-low-rts-high" }));
  assert.deepEqual(transport.signals, [
    { dataTerminalReady: false, requestToSend: true },
    { dataTerminalReady: true, requestToSend: false },
    { dataTerminalReady: false, requestToSend: false },
    { dataTerminalReady: false, requestToSend: true },
  ]);
  assert.deepEqual(transport.writes.slice(-2), [[0x21, 0xde], addressPacket(0x08004000)]);
  assert.equal(transport.closed, true);
});

test("CH340X GO prepares run lines before the command and honors port lifetime", async () => {
  for (const close of [true, false]) {
    const transport = new MockTransport(goSessionReads());
    const logs = [];
    const write = transport.write.bind(transport);
    let goSignals;
    transport.write = async (bytes) => {
      if (bytes[0] === 0x21) {
        assert.ok(logs.includes("Verify complete"));
        goSignals = transport.signals.at(-1);
      }
      await write(bytes);
    };
    await flashStm32Uart(goOptions(transport, { resetMode: "ch340x", close, onLog: (line) => logs.push(line) }));
    assert.deepEqual(goSignals, { requestToSend: true, dataTerminalReady: false });
    assert.equal(transport.signals.length, 5); // entry plus GO preparation; no reset after GO
    assert.deepEqual(transport.signals.at(-1), goSignals);
    assert.deepEqual(transport.writes.slice(-2), [[0x21, 0xde], addressPacket(0x08004000)]);
    assert.equal(transport.closed, close);
    assert.ok(logs.some((line) => line.includes("GO command acknowledged:") && line.includes("application execution not confirmed")));
  }
});

test("CH340X hardware reset pulses RTS with BOOT0 held in run state", async () => {
  const transport = new MockTransport(goSessionReads({ go: [] }));
  await flashStm32Uart(goOptions(transport, { resetMode: "ch340x", runMode: "hardware-reset", close: false }));
  assert.deepEqual(transport.signals.slice(4), [
    { requestToSend: true, dataTerminalReady: false },
    { requestToSend: false, dataTerminalReady: false },
    { requestToSend: true, dataTerminalReady: false },
  ]);
  assert.ok(!transport.writes.some((bytes) => bytes[0] === 0x21));
  assert.equal(transport.closed, false);
});

test("CH340X GO failure closes the port without a reset fallback", async () => {
  const transport = new MockTransport(goSessionReads({ go: [[NACK]] }));
  const logs = [];
  await assert.rejects(flashStm32Uart(goOptions(transport, {
    resetMode: "ch340x", close: false, onLog: (line) => logs.push(line),
  })), /NACK/);
  assert.equal(transport.signals.length, 5);
  assert.deepEqual(transport.signals.at(-1), { requestToSend: true, dataTerminalReady: false });
  assert.equal(transport.closed, true);
  assert.ok(!logs.includes("Done"));
});

test("CH340X No Run keeps entry state without preparing GO or resetting", async () => {
  const transport = new MockTransport(goSessionReads({ supported: false, go: [] }));
  await flashStm32Uart(goOptions(transport, { resetMode: "ch340x", run: false, close: false }));
  assert.equal(transport.signals.length, 4);
  assert.deepEqual(transport.signals.at(-1), { requestToSend: true, dataTerminalReady: true });
  assert.ok(!transport.writes.some((bytes) => bytes[0] === 0x21));
  assert.equal(transport.closed, false);
});

test("GO NACK and timeout never report Done and close even with close=false", async () => {
  for (const go of [[[NACK]], [[ACK], [NACK]], [[ACK], new Error("GO address ACK timeout")]]) {
    const transport = new MockTransport(goSessionReads({ go }));
    const logs = [];
    await assert.rejects(flashStm32Uart(goOptions(transport, { close: false, onLog: (line) => logs.push(line) })));
    assert.equal(transport.closed, true);
    assert.ok(!logs.includes("Done"));
    assert.ok(!logs.some((line) => line.startsWith("GO command acknowledged:")));
  }
});

test("cancellation during synchronization prevents erase", async () => {
  const controller = new AbortController();
  const transport = new MockTransport(goSessionReads());
  await assert.rejects(flashStm32Uart(goOptions(transport, {
    erase: true, signal: controller.signal,
    onLog: (line) => { if (line.startsWith("Bootloader ")) controller.abort(); },
  })), /cancelled/);
  assert.deepEqual(transport.writes, [[0x7f], [0x00, 0xff], [0x02, 0xfd]]);
});

test("cleanup error preserves the original GO failure", async () => {
  const transport = new MockTransport(goSessionReads({ go: [[NACK]] }));
  const logs = [];
  transport.close = async () => { throw new Error("close failed"); };
  await assert.rejects(flashStm32Uart(goOptions(transport, { onLog: (line) => logs.push(line) })), /NACK/);
  assert.ok(logs.includes("Serial port cleanup failed: close failed"));
});

test("successful GO with failed port close never reports Done", async () => {
  const transport = new MockTransport(goSessionReads());
  const logs = [];
  transport.close = async () => { throw new Error("close failed"); };
  await assert.rejects(flashStm32Uart(goOptions(transport, { onLog: (line) => logs.push(line) })), /close failed/);
  assert.ok(logs.some((line) => line.startsWith("GO command acknowledged:")));
  assert.ok(!logs.includes("Done"));
});

test("failed verification or cancellation after verify prevents GO", async () => {
  for (const cancel of [false, true]) {
    const controller = new AbortController();
    const transport = new MockTransport(goSessionReads({ verify: cancel ? [0xaa, 0xbb] : [0x00, 0x00] }));
    await assert.rejects(flashStm32Uart(goOptions(transport, {
      signal: controller.signal,
      onLog: (line) => { if (cancel && line === "Verify complete") controller.abort(); },
    })), cancel ? /cancelled/ : /Verify failed/);
    assert.ok(!transport.writes.some((bytes) => bytes[0] === 0x21));
    assert.equal(transport.closed, true);
  }
});

test("No Run suppresses GO even on a bootloader without GO support", async () => {
  const transport = new MockTransport(goSessionReads({ supported: false, go: [] }));
  await flashStm32Uart(goOptions(transport, { run: false }));
  assert.ok(!transport.writes.some((bytes) => bytes[0] === 0x21));
});

test("invalid run mode fails before opening the port", async () => {
  const transport = new MockTransport([]);
  await assert.rejects(flashStm32Uart(goOptions(transport, { runMode: "typo" })), /Invalid run mode/);
  assert.equal(transport.opened, false);
});
