import assert from "node:assert/strict";
import { SerialPort } from "serialport";

// No hardware is required. Loading and enumerating exercise the native addon.
const ports = await SerialPort.list();
assert.ok(Array.isArray(ports), "SerialPort.list() must return an array");
console.log(`serialport native binding OK: ${process.platform}/${process.arch} (${ports.length} ports)`);
