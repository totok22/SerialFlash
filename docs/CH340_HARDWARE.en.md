# CH340 Hardware & Reset Timing Reference

[简体中文](CH340_HARDWARE.md)

This document describes the circuit topology, signal polarity conventions, and reset timing for automatic download circuits based on CH340-series USB-UART bridges.

---

## 1. Hardware Connection Requirements

STM32 microcontrollers execute ISP flashing via their built-in system ROM USART bootloader. Connecting a target board with a USB-UART bridge requires:

- **Serial Lines**: USB-UART TXD connects to STM32 Bootloader USART RX, and RXD connects to TX. Both sides share a common ground (GND).
- **Logic Voltage**: Verify the USB-UART I/O logic level matches the MCU voltage (typically 3.3V). Do not connect 5V or RS-232 levels directly to STM32 I/O pins.
- **Bootloader & Reset Pins**: The auto-download circuit controls STM32 BOOT0 (or designated boot configuration pins) and NRST via the bridge's DTR/RTS lines. BOOT1 (if present) is typically tied to GND. Refer to ST [AN2606](https://www.st.com/resource/en/application_note/an2606-stm32-microcontroller-system-memory-boot-mode-stmicroelectronics.pdf) for part-specific boot requirements.
- **Port Routing**: The board's USB-C port routes internally to the USB-UART bridge and auto-reset circuit. A port routed solely to the STM32 native USB peripheral cannot be used for USART ISP.

---

## 2. Software Logic Polarity Conventions

Internal extension logic adheres to the following convention for modem control lines:
- `true`: **Low Level** (Asserted / Transistor conductive)
- `false`: **High Level** (Deasserted / Transistor cut-off)

> [!NOTE]
> The Node.js `serialport` module defines modem line booleans with inverted semantics. The adapter layer `src/node-serial-transport.js` handles this conversion automatically.

---

## 3. CH340C Classic Circuit (`dtr-low-rts-high`)

This classic design uses a pair of bipolar transistors (NPN + PNP) and passive resistors to translate DTR and RTS signals into BOOT0 and NRST levels:

- **Reset Control**: DTR# drives NPN transistor Q1 via a base resistor to pull NRST low, generating a reset pulse.
- **Boot Control**: RTS# controls BOOT0 via PNP transistor Q2.
- **Operational Logic**:
  - When DTR and RTS share the same logical state, both transistors are cut off, and MCU pins remain in their default states via board pull-up/pull-down resistors.
  - When DTR and RTS differ in state, the circuit drives either a reset pulse or asserts BOOT0 high.

![CH340C Auto-Download Circuit](assets/ch340c-auto-download.png)

*Schematic reference: [WCH-SoftGroup Technical Note](https://www.cnblogs.com/WCH-SoftGroup/p/16520720.html).*

### Validated Timing Parameters
Bootloader entry sequence (`dtr-low-rts-high`):
1. RTS low, DTR low;
2. DTR transitions to high level;
3. Delay approximately 800 ms to allow MCU power stabilization and bootloader entry;
4. Send `0x7F` synchronization byte.

---

## 4. CH340X Direct Circuit (`ch340x`)

The CH340X provides enhanced modem control capabilities, eliminating external transistors by directly connecting dedicated pins to the MCU:

| CH340X Pin | Function | STM32 Target | Description |
| --- | --- | --- | --- |
| Pin 8 | TXD | MCU RXD | Serial data transmit |
| Pin 9 | RXD | MCU TXD | Serial data receive |
| Pin 4 | RTS# | RESET (NRST) | Reset output |
| Pin 6 | TNOW / DTR# | BOOT0 | Boot configuration output |
| Pin 6 External R4 | 4.7 kΩ pull-down | GND | Configures enhanced DTR and provides BOOT0 pull-down |

![CH340X Auto-Download Circuit](assets/ch340x-auto-download.png)

*Schematic reference: [WCH Official Application Note](https://www.wch.cn/application/575.html).*

### Timing State Machine
Defined in `src/core/reset-timing.js`:

- **Entering Bootloader**:
  - Sequence: `(RTS, DTR) = (false, true) → (true, true) → (true, false) → (true, true)`
  - Stabilization delay: ~1000 ms, followed by sending `0x7F`.
- **Reset to Run User Application**:
  - Sequence: `(false, false) → (false, true) → (false, false)`
  - NRST is released, allowing the MCU to boot user firmware from Flash.

---

## 5. Key Debugging & Hardware Considerations

- **Sync Byte Timeout (`0x7F` Timeout)**:
  - Indicates the MCU did not enter ROM bootloader mode. Check board power, common ground, and BOOT0/NRST pin connections.
  - If using a non-standard circuit, switch to `none` mode, hold the BOOT button, and press RST manually to verify hardware and serial continuity.
- **Continuous Garbage or User App Output**:
  - Indicates the reset sequence failed to preempt user code execution. Inspect reset pulse duration and BOOT0 setup hold times using a logic analyzer or oscilloscope.
- **Board Inactive After Flash**:
  - For CH340X direct circuits, keeping the serial connection open may leave control lines asserting NRST or BOOT0. The extension defaults to `closePortAfterWrite: true` to release these lines upon completion.
- **Full Chip Erase Latency**:
  - Large STM32 devices (High-density / XL-density) may require tens of seconds to complete a full mass erase. The protocol layer provides a dedicated 60-second timeout window for erase operations.

