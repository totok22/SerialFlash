# STM32 Serial Flasher

[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code%20Marketplace-STM32%20Serial%20Flasher-blue?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=totok22.serialflash-stm32)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Flash STM32 `.hex` and `.bin` firmware from VS Code through the chip's ROM USART bootloader.
With a suitable USB-UART bridge and BOOT0/NRST circuit, the board's USB-C connector can carry the whole programming workflow.
No ST-Link is needed for programming through this connection.

[简体中文](README.zh-CN.md) · [Usage reference（中文）](docs/USAGE.md) · [Contributing（中文）](CONTRIBUTING.md)

## Why I built this

I work on macOS, where I do not have a native FlyMCU application in my workflow.
FlyMCU's interface also feels dated to me.
I already build firmware in VS Code, so I wanted to flash the board from the same editor.

My boards use USB-C with a USB-UART bridge and an automatic download circuit.
SerialFlash lets me reuse that connection to enter the bootloader, erase, write, verify, and reset the board to run.
The circuit and the MCU's boot configuration must support this workflow.

## Install

Install [STM32 Serial Flasher from the VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=totok22.serialflash-stm32),
or run:

```bash
code --install-extension totok22.serialflash-stm32
```

The published version is **0.2.0**.
The English/Chinese panel shown below is an unreleased source change; installing Marketplace 0.2.0 does not include it yet.
See [CHANGELOG.md](CHANGELOG.md) for the release boundary.

For a local build, follow [CONTRIBUTING.md](CONTRIBUTING.md) and install the generated VSIX using **Extensions: Install from VSIX**.

## Panel preview

![English SerialFlash panel in VS Code](docs/assets/vscode-panel.png)

English development-host screenshot: existing CAN2RS485 HEX and saved port, idle with no target board connected.
Panel language follows the VS Code display language: Chinese, or English as the fallback.

## What you can do

- Flash from the panel, Activity Bar sidebar, Command Palette, file context menu, or status bar.
- Select `.hex` or `.bin` build output, or let workspace discovery suggest candidates.
- Use CH340C/CH340X reset presets, manual bootloader entry, or custom DTR/RTS mappings.
- Remember successful settings and save named profiles for different boards or firmware targets.
- Chain an existing build task with a SerialFlash task inside VS Code.
- Inspect progress, recent history, full Output logs, and host/serial diagnostics.

## Before connecting

You need VS Code Desktop 1.90 or later and a USB-UART device recognized by the operating system.
The packaged extension includes `serialport`; adapter drivers may still be needed.

Your STM32 must expose a USART supported by its ROM bootloader.
Check the exact part, bootloader pins, and boot-entry requirements in
[ST AN2606](https://www.st.com/resource/en/application_note/an2606-stm32-microcontroller-system-memory-boot-mode-stmicroelectronics.pdf).
Support depends on the MCU, boot settings, wiring, and commands provided by that bootloader.

A USB-C connector alone does not establish compatibility.
For this workflow it must connect to a USB-UART bridge wired to the required USART;
a connector wired only to the STM32's native USB peripheral is a different programming path.

## First flash

1. Build your firmware and open the project folder in VS Code.
2. Connect the board's USB-UART interface and close other tools using that serial port.
3. Run **SerialFlash: Open Flasher Panel** from the Command Palette, or open the SerialFlash Activity Bar icon.
4. Select the `.hex` or `.bin` file and the board's serial port.
5. Select the reset mode that matches the actual circuit in the next section.
6. Check the address and write options, then run **SerialFlash: Flash Latest Firmware**.
7. Read the Output log for the bootloader version, PID, and write/verification result; confirm the application runs on the board.

The shortcut is `Cmd+Alt+F` on macOS and `Ctrl+Alt+F` on Windows/Linux.
The extension defaults to `115200 8E1`, erase before writing, verify after writing, reset to run, and close the port.
Erasing removes the chip's existing application and other flash contents.

After a successful flash, the extension remembers the port, firmware, reset mode, and baud rate.
Confirm these values when changing boards or build targets.

## Wiring and reset modes

The bridge's TX connects to the bootloader USART RX, RX connects to TX, and grounds must be shared.
Check the board's supply and signal voltage requirements before wiring an external adapter.
Automatic entry also needs DTR/RTS control of BOOT0 and NRST through a compatible circuit.

| Reset mode | Use |
| --- | --- |
| `dtr-low-rts-high` | Classic CH340C automatic download circuit; extension default |
| `ch340x` | Existing preset for the historically tested CH340X board; verify the actual mapping |
| `none` | Enter the ROM bootloader manually; the extension does not drive DTR/RTS |
| `dtr-high-rts-low` | Generic DTR high reset / RTS low BOOT preset |
| `custom` | Set the control-line mapping for a different circuit |

### CH340C automatic download circuit

![CH340C automatic download circuit](docs/assets/ch340c-auto-download.png)

This circuit uses transistors between the bridge's control lines and BOOT0/RESET.
Select `dtr-low-rts-high` for this circuit; the bridge model alone is not enough to choose a preset.

### CH340X automatic download circuit

![CH340X automatic download circuit](docs/assets/ch340x-auto-download.png)

The reference connects RTS# to RESET and enhanced DTR# to BOOT0.
That mapping differs from the historical software control names used by the existing `ch340x` preset.
Check your board's actual mapping and the [hardware notes](docs/CH340_HARDWARE.md) before choosing a preset.

Circuit source: [WCH-SoftGroup's original explanation](https://www.cnblogs.com/WCH-SoftGroup/p/16520720.html)
and [WCH's official application note](https://www.wch.cn/application/575.html).
The hardware notes cover timing, topology differences, and historical CLI results.

## Firmware selection and addresses

An existing configured firmware path takes priority, including a path remembered after a successful flash.
**Flash Latest Firmware** can therefore reuse that file even when another artifact is newer.

When the configured file is absent, discovery ranks candidates by modification time, build path, file format,
workspace-name match, remembered path, and small-BIN size penalties.
A single candidate or a clear scoring lead is selected automatically; otherwise you choose from a list.
Automatic discovery excludes `CMakeFiles` compiler checks, which are build-system probes rather than board firmware.

| Firmware | Address when `serialFlash.flashAddress` is not explicitly set |
| --- | --- |
| Intel HEX (`.hex`) | Base address encoded in the file |
| Raw binary (`.bin`) | `0x08000000` |

An explicit `serialFlash.flashAddress` overrides either default.
Only `.hex` and `.bin` are offered as firmware; export an ELF build to one of these formats first.
Use **Show Firmware Info** to inspect the file and the Output log to check the actual flash address.

## Desktop, remote hosts, and validation

SerialFlash uses Node and native serial bindings in the VS Code Extension Host.
It targets Desktop hosts on macOS, Windows, and Linux where the bundled native dependency can load
and the operating system exposes the serial device.

In Remote SSH, WSL, or Dev Containers, ports belong to the machine running the extension host.
Run **SerialFlash: Run Diagnostics** to check that host and its visible devices.
The extension cannot flash from `vscode.dev` or `github.dev`.

Hardware evidence currently consists of historical macOS CLI tests on specific CH340C and CH340X boards;
see [CH340_HARDWARE.md](docs/CH340_HARDWARE.md). Current extension hardware coverage is still to be established
using [HARDWARE_VALIDATION.md](docs/HARDWARE_VALIDATION.md).

## More documentation

| Document | Contents |
| --- | --- |
| [Usage（中文）](docs/USAGE.md) | Commands, settings, profiles, tasks, and troubleshooting |
| [Hardware（中文）](docs/CH340_HARDWARE.md) | Circuit details, reset timing, historical tests |
| [Protocol（中文）](docs/STM32_PROTOCOL.md) | STM32 USART bootloader protocol notes |
| [Contributing（中文）](CONTRIBUTING.md) | Install dependencies, F5 debugging, tests, packaging |
| [Changelog（中文）](CHANGELOG.md) | Released and unreleased changes |

## Repository branches

The VS Code extension is the primary project on [`main`](https://github.com/totok22/SerialFlash/tree/main).
The browser Web Serial page and Node CLI are maintained separately on [`web`](https://github.com/totok22/SerialFlash/tree/web).
Use that branch's own instructions for browser requirements and CLI commands.
The old `vscode-extension` branch name is historical.

## License

[MIT](LICENSE).
