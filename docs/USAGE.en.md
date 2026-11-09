# SerialFlash Usage Reference

[简体中文](USAGE.md)

This reference covers the interfaces, commands, settings, tasks, and troubleshooting procedures for the STM32 Serial Flasher VS Code extension.

For installation and quick start instructions, see [README.md](../README.md). For circuit schematics and reset timing, see [Hardware Notes](CH340_HARDWARE.en.md).

---

## 1. Runtime Environments & User Interfaces

### Requirements & Scoping
- **VS Code**: VS Code Desktop 1.90 or later.
- **Extension Host**: Serial communication uses native Node `serialport` bindings and runs within the extension host.
- **Remote Development**: When using Remote SSH, WSL, or Dev Containers, serial ports belong to the **host where the extension runs**, not your local client machine. Run `SerialFlash: Run Diagnostics` to inspect the host environment and visible serial devices.

### Interface Surfaces
- **Webview Panel**: Open via the Activity Bar or command `SerialFlash: Open Flasher Panel`. Provides firmware and port pickers, parameter configuration, advanced operations, and recent log outputs (18 lines).
- **Activity Bar Sidebar**: Displays current target firmware, selected serial port, reset mode, quick actions, and the 8 most recent flash records.
- **Status Bar**: Displays the currently configured serial port when idle (click to open the panel); shows real-time percentage progress during programming.
- **Context Menus**: Right-click any `.hex` or `.bin` file in the Explorer or editor tabs to flash, verify, or set it as the active firmware.
- **Keyboard Shortcuts**:
  - macOS: `Cmd+Alt+F`
  - Windows / Linux: `Ctrl+Alt+F`

---

## 2. Command Reference

Press `Cmd/Ctrl+Shift+P` and type `SerialFlash:` to filter contributed commands:

### Flashing & Chip Operations
| Command | Description |
| --- | --- |
| `Flash Latest Firmware` | Uses the configured/remembered firmware or auto-discovers one, then follows the erase, write, verify, and run settings |
| `Flash Current File` | Sets the currently active or right-clicked `.hex` / `.bin` as active firmware and flashes immediately |
| `Cancel Flash` | Requests cancellation of the ongoing flash sequence (safely halts at the next checkpoint) |
| `Verify Firmware` | Connects to the bootloader, reads back flash memory, and compares it byte-for-byte with the active firmware |
| `Erase Chip` | Prompts for confirmation, then connects to the bootloader and executes a full chip erase |
| `Unlock Read Protection` | Prompts for confirmation and sends the readout unprotect command (**Warning: MCU hardware automatically erases all Flash memory**) |
| `Reset To Bootloader` | Drives the DTR/RTS lines to enter bootloader state without protocol handshake |
| `Reset And Run` | Drives the reset timing to reboot and run target user firmware |
| `Close Port` | Manually releases the active serial port connection |

### Firmware Management
| Command | Description |
| --- | --- |
| `Select Firmware` | Scans workspace candidates and opens a Quick Pick to select and remember firmware |
| `Set as SerialFlash Firmware` | Sets the right-clicked file in the Explorer or editor as active firmware without flashing |
| `Show Firmware Info` | Displays format, size in bytes, base address, modification date, and absolute path |

### Device & Mode Configuration
| Command | Description |
| --- | --- |
| `Select Serial Port` | Re-enumerates available serial ports with manufacturer, VID/PID, and serial number |
| `Select Reset Mode` | Selects a hardware reset preset (CH340C / CH340X / Manual / Custom) |
| `Open Flasher Panel` | Opens the Webview flasher panel |
| `Show Output` | Reveals the dedicated SerialFlash Output channel in VS Code |
| `Run Diagnostics` | Inspects extension host platform, `serialport` module status, and visible ports |

### Project & History Management
| Command | Description |
| --- | --- |
| `Create Project Config` | Merges current settings into `.vscode/settings.json` in the root workspace folder |
| `Create Tasks` | Generates or merges standard `.vscode/tasks.json` SerialFlash build tasks |
| `Create Project Profile` | Saves the active configuration as a named profile for multi-board/target switching |
| `Select Project Profile` | Selects a saved profile and applies its settings to the active environment |
| `Clear Remembered Device` | Clears globally remembered port, firmware path, and baud rate |
| `Clear Flash History` | Clears stored flash history entries |
| `Refresh` | Refreshes the sidebar view and flasher panel state |

---

## 3. Firmware Discovery & Flash Addresses

### Selection Priority
1. **Configured File Priority**: If `serialFlash.firmware` is explicitly set (or a previously remembered path exists), it is used directly.
2. **Auto-Discovery**: If no path is set or the file is missing, and `serialFlash.autoDiscoverFirmware` is enabled (default):
   - Searches files matching `firmwareGlobs` across the workspace;
   - Excludes directories matching `excludeGlobs` (e.g. `node_modules`, `.git`, `dist`);
   - **Compiler Probe Filtering**: Intermediate artifacts such as `CMakeFiles/` test binaries are automatically ignored;
   - Scores candidates by modification time, file type, and output directory; automatically selects a clear winner or prompts via Quick Pick if multiple viable targets exist.

### Base Address Rules
| Format | Default Address | Description |
| --- | --- | --- |
| Intel HEX (`.hex`) | Base address in file | Parsed from extended linear address records (e.g., `0x08000000`) |
| Raw Binary (`.bin`) | `0x08000000` | BIN files lack address metadata; uses standard STM32 internal Flash base |

> [!TIP]
> If your application uses an offset (e.g., a custom bootloader reserving the lower sector and shifting the app to `0x08008000`), explicitly configure `serialFlash.flashAddress` to override the default.

---

## 4. Settings Reference

All settings keys begin with `serialFlash.`. They can be edited in User or Workspace settings, or configured via the Webview panel.

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `firmware` | `string` | `""` | Target firmware path (relative to workspace or absolute) |
| `port` | `string` | `""` | Serial device path (e.g., `/dev/tty.usbserial-10`, `COM3`) |
| `baudRate` | `number` | `115200` | Serial baud rate |
| `parity` | `string` | `"even"` | Parity bit (STM32 ROM bootloader requires `"even"`) |
| `resetMode` | `string` | `"dtr-low-rts-high"` | Hardware auto-reset preset; see below |
| `customReset.boot0High` | `string` | `"dtr-false"` | Line state asserting bootloader entry in custom mode |
| `customReset.boot0Low` | `string` | `""` | Line state returning to normal run in custom mode (blank to invert) |
| `customReset.resetAssert` | `string` | `"rts-true"` | Line state asserting reset pulse in custom mode |
| `flashAddress` | `string` | `""` | Explicit flash address (blank uses HEX base address or BIN default) |
| `packetSize` | `number` | `256` | Payload packet size in bytes (1 to 256; protocol maximum is 256) |
| `timeout` | `number` | `2000` | General serial operation timeout in milliseconds |
| `eraseBeforeWrite` | `boolean` | `true` | Performs full chip erase prior to programming |
| `verifyAfterWrite` | `boolean` | `true` | Reads back flash memory and compares byte-for-byte after programming |
| `runAfterWrite` | `boolean` | `true` | Performs the run step after writing and optional verification succeed; `false` skips it |
| `runMode` | `string` | `"hardware-reset"` | 0.2.2 pre-release: `hardware-reset` or `go`; used only when `runAfterWrite=true` |
| `closePortAfterWrite` | `boolean` | `true` | Closes the port when finished; resulting pin states depend on the driver and circuit |
| `unlockReadProtection` | `boolean` | `false` | Automatically attempts readout unprotect on erase NACK (**erases all Flash**) |
| `autoDiscoverFirmware` | `boolean` | `true` | Scans workspace when no firmware path is specified |
| `firmwareGlobs` | `array` | `["**/*.hex", "**/*.bin"]` | Glob patterns included in firmware search |
| `excludeGlobs` | `array` | `["**/{node_modules,.git,dist}/**"]` | Glob patterns excluded from firmware search |
| `projects` | `array` | `[]` | Array of named profile configurations |

### Example Workspace Settings (`.vscode/settings.json`)
```json
{
  "serialFlash.firmware": "build/Debug/app.hex",
  "serialFlash.port": "/dev/tty.usbserial-10",
  "serialFlash.resetMode": "dtr-low-rts-high",
  "serialFlash.baudRate": 115200,
  "serialFlash.eraseBeforeWrite": true,
  "serialFlash.verifyAfterWrite": true,
  "serialFlash.runAfterWrite": true,
  "serialFlash.runMode": "hardware-reset"
}
```

### Post-flash Run Mode (0.2.2 pre-release)

`runMode` is available in the 0.2.2 pre-release. See the [CH340C PDM validation record](HARDWARE_VALIDATION.md#3-2026-11-08ch340c-pdm-验证) for the tested scope. The panel offers Hardware reset or Bootloader GO; disabling Run after success disables this selector.

| Settings | Post-flash action |
| --- | --- |
| `runAfterWrite=false` | Skips both hardware reset and GO; logs `Run skipped` and shows No Run |
| `runAfterWrite=true`, `runMode=hardware-reset` | Default: sends the sequence selected by `resetMode`; the log confirms only that the sequence was sent |
| Above settings with `resetMode=none` | No automatic run; logs `Run skipped: manual reset required`. Restore normal boot conditions and reset manually |
| `runAfterWrite=true`, `runMode=go` | Sends GO after writing and optional verification succeed, without a hardware reset pulse |

GO uses the resolved flash address: explicit `flashAddress` first, otherwise the HEX base address or BIN default `0x08000000`. A valid application vector table must be present there; firmware must be linked for that location and configure its vector table correctly. Changing the flash address does not relocate firmware.

Before erase, the workflow checks the GET command list for GO support. Missing support aborts flashing; select `hardware-reset` or disable Run after success before retrying. A GO NACK or timeout does not trigger an automatic hardware-reset fallback.

Before GO, classic CH340C requests `(DTR, RTS) = (false, true)`; generic presets and custom mappings request `boot0Low` with reset deasserted. Both wait 100 ms. `ch340x` requests `(RTS, DTR) = (true, false)` and waits 250 ms, restoring BOOT0 run conditions while keeping RTS at its entry-end state. `none` leaves control lines unchanged; the user manages boot conditions. See [hardware details](CH340_HARDWARE.en.md).

`GO command acknowledged: …; application execution not confirmed` confirms only a protocol response. Hardware-reset logs also do not prove application execution: check an LED, application serial output, or another observable behavior. See the Go command section of [AN3155](https://www.st.com/resource/en/application_note/an3155-usart-protocol-used-in-the-stm32-bootloader-stmicroelectronics.pdf) for the protocol.

`closePortAfterWrite` independently controls closing the port at completion; failures still close it. Closing guarantees neither BOOT0/NRST levels nor application startup or prevention of a jump. No Run only skips the extension's run step. Compare open-port and closed-port behavior using the [hardware validation template](HARDWARE_VALIDATION.md).

`Create Project Config` and named profiles save `runMode`. New flash history entries record the run selection, not proof of application execution. The separate `Reset And Run` command and `run` task still perform hardware reset and do not use post-flash `runMode`.

---

## 5. Reset Modes & Control Line Polarity

### Internal Logic Polarity
The extension defines control states as:
- `true`: **Low Level** (Asserted / Transistor conductive)
- `false`: **High Level** (Deasserted / Transistor cut-off)

> [!NOTE]
> The Node.js `serialport` module uses the opposite boolean polarity. The adapter layer `src/node-serial-transport.js` handles this inversion automatically.

### Available Reset Presets
| Mode Key | Action | Circuit Topology |
| --- | --- | --- |
| `dtr-low-rts-high` | DTR low asserts reset; RTS high pulls BOOT0 | Classic dual-transistor (NPN + PNP) CH340C/CH340G auto-download circuit |
| `ch340x` | Dedicated RTS/DTR pulse sequence | Direct CH340X circuit (RTS# to NRST, enhanced DTR to BOOT0) |
| `dtr-high-rts-low` | DTR high asserts reset; RTS low pulls BOOT0 | Inverted logic / optocoupler-isolated auto-reset adapters |
| `none` | No extension-driven control-line sequence; opening/closing remains driver-dependent | Manual mode (press BOOT0 + RST buttons on board) |
| `custom` | User-defined line mappings | Custom or non-standard auto-reset circuits |

### Custom Reset Configuration Example
```json
{
  "serialFlash.resetMode": "custom",
  "serialFlash.customReset.boot0High": "dtr-false",
  "serialFlash.customReset.boot0Low": "dtr-true",
  "serialFlash.customReset.resetAssert": "rts-true"
}
```

---

## 6. Named Project Profiles

For workspaces with multiple target boards or distinct Debug/Release targets, use named profiles.

Run `SerialFlash: Create Project Profile` and enter a profile name (e.g. `board-f103-debug`). The settings will be saved to `serialFlash.projects` in `.vscode/settings.json`:

```json
{
  "serialFlash.projects": [
    {
      "name": "board-f103-debug",
      "firmware": "build/Debug/app.hex",
      "port": "/dev/tty.usbserial-10",
      "resetMode": "dtr-low-rts-high",
      "flashAddress": "0x08000000",
      "baudRate": 115200
    },
    {
      "name": "board-f407-release",
      "firmware": "build/Release/firmware.bin",
      "port": "/dev/tty.usbserial-20",
      "resetMode": "ch340x",
      "flashAddress": "0x08000000",
      "baudRate": 115200
    }
  ]
}
```

To switch between boards, run `SerialFlash: Select Project Profile`.

---

## 7. VS Code Tasks Automation

Run `SerialFlash: Create Tasks` to generate a standard `.vscode/tasks.json`. Supported task actions (`action`):
- `flashLatest`: Flashes the latest firmware
- `bootloader`: Resets into bootloader only
- `run`: Resets into application code only

### Chaining Build and Flash Tasks
You can configure a compound task sequence to build and flash with a single shortcut:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Build Firmware",
      "type": "shell",
      "command": "ninja -C build",
      "problemMatcher": []
    },
    {
      "label": "SerialFlash: Flash Latest Firmware",
      "type": "serialFlash",
      "action": "flashLatest",
      "problemMatcher": []
    },
    {
      "label": "Build & Flash",
      "dependsOrder": "sequence",
      "dependsOn": [
        "Build Firmware",
        "SerialFlash: Flash Latest Firmware"
      ],
      "problemMatcher": []
    }
  ]
}
```

---

## 8. Troubleshooting Guide

When encountering issues, run `SerialFlash: Show Output` for detailed handshake logs, or run `SerialFlash: Run Diagnostics` to check host environment and serial visibility.

| Issue | Potential Cause | Recommended Fix |
| --- | --- | --- |
| **Firmware not found** | Binary not compiled or outside workspace | Verify build outputs `.hex` or `.bin`; check `firmwareGlobs` pattern |
| **Port busy / EACCES** | Another monitor or serial terminal is holding the port | Close other serial monitors; on Linux, verify your user belongs to `dialout` or `uucp` |
| **Bootloader ACK timeout (`0x7F`)** | MCU failed to enter bootloader mode | 1. Check circuit wiring and reset mode preset;<br>2. Switch to `none` mode, hold the BOOT button, and press RST manually to verify basic serial communication;<br>3. Verify TX/RX cross-connection and shared GND |
| **Continuous garbage / app output** | Auto-reset sequence did not trigger bootloader | Check transistor/MOSFET wiring and verify DTR/RTS timing and pulse width |
| **Command NACK (`0x1F`)** | Command unsupported or chip is read-protected | 1. Check supported commands for your MCU in [AN2606](https://www.st.com/resource/en/application_note/an2606-stm32-microcontroller-system-memory-boot-mode-stmicroelectronics.pdf);<br>2. If read-protected, run `Unlock Read Protection` (note: erases entire Flash) |
| **Verify mismatch** | Wrong flash address or incomplete erase | Verify linker script Flash start address; ensure `eraseBeforeWrite` is enabled |
| **Board does not run after flash** | Run skipped, incorrect boot conditions, or GO address/vector mismatch | Check `runAfterWrite`, `runMode`, and `resetMode`; distinguish command ACK from application evidence; measure BOOT0/NRST and compare port-close A/B results |
| **Local port not visible in Remote** | Extension runs on remote host, not local client | Confirm physical USB device is plugged into the machine running the extension host |

