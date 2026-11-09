import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { NodeSerialTransport } from "../src/node-serial-transport.js";

function mockPort() {
  const port = new EventEmitter();
  port.calls = [];
  port.open = (callback) => { port.isOpen = true; callback(); };
  port.close = (callback) => { port.isOpen = false; callback(); };
  port.set = (signals, callback) => {
    port.calls.push(signals);
    callback(port.error);
  };
  return port;
}

test("partial control updates preserve the other line and invert only at the adapter", async () => {
  const port = mockPort();
  const transport = new NodeSerialTransport(port);
  await transport.open();
  await transport.setSignals({ requestToSend: true });
  await transport.setSignals({ dataTerminalReady: true });
  await transport.setSignals({ dataTerminalReady: false });
  assert.deepEqual(port.calls, [
    { dtr: true, rts: false },
    { dtr: false, rts: false },
    { dtr: true, rts: false },
  ]);
  await transport.close();
  await transport.open();
  await transport.setSignals({ dataTerminalReady: true });
  assert.deepEqual(port.calls.at(-1), { dtr: false, rts: true });
  await transport.close();
});

test("failed control update does not replace the last successful state", async () => {
  const port = mockPort();
  const transport = new NodeSerialTransport(port);
  await transport.setSignals({ requestToSend: true });
  port.error = new Error("set failed");
  await assert.rejects(transport.setSignals({ requestToSend: false }), /set failed/);
  port.error = null;
  await transport.setSignals({ dataTerminalReady: true });
  assert.deepEqual(port.calls.at(-1), { dtr: false, rts: false });
});
