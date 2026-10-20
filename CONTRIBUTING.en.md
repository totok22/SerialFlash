# Contributing & Developer Guide

[简体中文](CONTRIBUTING.md)

The primary maintenance branch is `main` (hosting the VS Code extension). The legacy Web Serial page and CLI are maintained on the `web` branch.

---

## 1. Local Development & Debugging

### Prerequisites
- Node.js (18+ recommended) and npm
- VS Code Desktop 1.90+

```bash
# Install dependencies
npm ci

# Run test suite
npm test
```

### F5 Extension Debugging
1. Open the repository root in VS Code Desktop.
2. Press `F5` and select `Run SerialFlash Extension` to launch the Extension Development Host.
3. In the development window, open a workspace with firmware files (`.hex` or `.bin`) to test commands, sidebar views, Webview flasher panels, and context menus.
4. Locale verification: Launch VS Code with different display languages (e.g. `code --locale=zh-CN` or `code --locale=en`) to test bilingual UI rendering.

---

## 2. Architecture & Code Conventions

- **Layer Boundaries**:
  - `src/vscode/`: Extension UI integration, commands, and settings management.
  - `src/core/`: ISP flash flow (`flash-session.js`), reset timing state machine (`reset-timing.js`), and firmware auto-discovery (`firmware-discovery.js`).
  - `src/stm32.js` / `src/firmware.js`: Protocol framing and Intel HEX parsing.
  - `src/node-serial-transport.js`: Hardware serial communication and modem line inversion.
- **Logic Level Convention**: Internal logic defines `true` as low level (asserted) and `false` as high level (deasserted). Inversion for Node `serialport` is handled exclusively within the serial transport adapter.
- **Code Style**: Modern ECMAScript modules (ESM), 2-space indentation.
- **Test Coverage**: Changes to protocol, HEX parsing, scoring rules, or reset timing must include unit tests in `tests/` using transport mocks.

---

## 3. Documentation Guidelines

- `README.md` is the primary English landing page; `README.zh-CN.md` is kept in sync. Technical documents in `docs/` have paired English and Chinese references.
- Keep the landing page concise. In-depth configuration options and troubleshooting belong in [docs/USAGE.en.md](docs/USAGE.en.md).
- Schematic and hardware updates belong in [docs/CH340_HARDWARE.en.md](docs/CH340_HARDWARE.en.md).
- Physical hardware validation results follow the template in [docs/HARDWARE_VALIDATION.md](docs/HARDWARE_VALIDATION.md).

---

## 4. Packaging & Release

Before publishing or creating a pull request, run:

```bash
# Run unit tests
npm test

# Package VSIX extension package
npm run package
```

Test the generated `.vsix` in a clean VS Code installation via **Extensions: Install from VSIX**.

User-visible changes must be documented in `CHANGELOG.md` under the `Unreleased` section.

