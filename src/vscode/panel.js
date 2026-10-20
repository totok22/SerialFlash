import { createTranslator, getTranslations, localizePanelHints, normalizeLanguage } from "./i18n.js";
import { getResetModes } from "./settings.js";

export class SerialFlashPanel {
  constructor(vscode, context, output) {
    this.vscode = vscode;
    this.context = context;
    this.output = output;
    this.panel = null;
    this.controller = null;
  }

  show(controller) {
    this.controller = controller;
    if (this.panel) {
      this.panel.reveal(this.vscode.ViewColumn.One);
      this.postState(controller.panelState());
      return;
    }

    this.panel = this.vscode.window.createWebviewPanel(
      "serialFlash.panel",
      "SerialFlash",
      this.vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          this.vscode.Uri.joinPath(this.context.extensionUri, "src", "vscode", "media"),
        ],
      },
    );

    this.panel.webview.html = this.html();
    this.panel.webview.onDidReceiveMessage((message) => this.handleMessage(message));
    this.panel.onDidDispose(() => {
      this.panel = null;
    });
    this.postState(controller.panelState());
  }

  postState(state) {
    const localized = state.troubleshooting?.length ? {
      ...state,
      troubleshooting: localizePanelHints(state.troubleshooting, this.vscode.env?.language, state.settings?.resetMode),
    } : state;
    this.panel?.webview.postMessage({ type: "state", state: localized });
  }

  async handleMessage(message) {
    if (!this.controller) return;
    if (message?.type === "ready") {
      this.postState(this.controller.panelState());
      return;
    }
    if (message?.type !== "action") return;

    const action = message.action;
    if (action === "flash") await this.controller.flashLatestFirmware();
    if (action === "selectFirmware") await this.controller.selectFirmware();
    if (action === "selectPort") await this.controller.selectSerialPort(true);
    if (action === "selectReset") await this.controller.selectResetMode();
    if (action === "bootloader") await this.controller.resetToBootloader();
    if (action === "run") await this.controller.resetAndRun();
    if (action === "cancel") this.controller.cancelFlash();
    if (action === "output") this.output.show();
    if (action === "diagnostics") await this.controller.runDiagnostics();
    if (action === "erase") await this.controller.eraseChip();
    if (action === "verify") await this.controller.verifyLatestFirmware();
    if (action === "unlock") await this.controller.unlockReadProtection();
    if (action === "closePort") await this.controller.closeActivePort();
    if (action === "projectConfig") await this.controller.createProjectConfig();
    if (action === "createTasks") await this.controller.createTasks();
    if (action === "createProfile") await this.controller.createProjectProfile();
    if (action === "selectProfile") await this.controller.selectProjectProfile();
    if (action === "clearHistory") await this.controller.clearHistory();
    if (action === "clearRemembered") await this.controller.clearRememberedDevice();
    if (action === "saveSetting") await this.controller.updateSetting(message.key, message.value);
  }

  html() {
    const language = normalizeLanguage(this.vscode.env?.language);
    const t = createTranslator(language);
    const locale = JSON.stringify({ language, messages: getTranslations(language), resetModes: getResetModes(language) })
      .replace(/</g, "\\u003c");
    const webview = this.panel.webview;
    const cssUri = webview.asWebviewUri(this.vscode.Uri.joinPath(this.context.extensionUri, "src", "vscode", "media", "panel.css"));
    const jsUri = webview.asWebviewUri(this.vscode.Uri.joinPath(this.context.extensionUri, "src", "vscode", "media", "panel.js"));
    const nonce = String(Date.now());

    return `<!doctype html>
<html lang="${language === "zh" ? "zh-CN" : "en"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <link rel="stylesheet" href="${cssUri}">
  <title>SerialFlash</title>
</head>
<body>
  <main class="shell">
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7z"/></svg>
        </span>
        <div class="brand-text">
          <h1>SerialFlash</h1>
          <p class="tagline">STM32 UART ISP</p>
        </div>
      </div>
      <div class="status" id="status" data-state="idle" role="status" aria-live="polite">
        <span class="status-dot" aria-hidden="true"></span>
        <strong id="phase" class="status-phase">${t("Idle")}</strong>
        <span class="status-pct" id="progressText">0%</span>
      </div>
    </header>

    <section class="main-grid">
      <div class="panel-card setup-card">
        <header class="section-heading">
          <h2>${t("Flash target")}</h2>
          <button class="ghost" data-action="diagnostics" data-allow-running="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            ${t("Diagnostics")}
          </button>
        </header>

        <div class="target-list">
          <div class="target-row">
            <span class="target-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
            </span>
            <div class="target-body">
              <span class="target-key">${t("Firmware")}</span>
              <strong id="firmware">${t("No firmware selected")}</strong>
            </div>
            <button data-action="selectFirmware" title="${t("Select firmware")}" aria-label="${t("Select firmware")}">${t("Select")}</button>
          </div>
          <div class="target-row">
            <span class="target-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2"/><path d="M12 12v9"/><path d="m8 17 4 4 4-4"/></svg>
            </span>
            <div class="target-body">
              <span class="target-key">${t("Port")}</span>
              <strong id="port">${t("No port selected")}</strong>
            </div>
            <button data-action="selectPort" title="${t("Select serial port")}" aria-label="${t("Select serial port")}">${t("Select")}</button>
          </div>
          <div class="target-row">
            <span class="target-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3.5-7.1"/><path d="M21 3v6h-6"/></svg>
            </span>
            <div class="target-body">
              <span class="target-key">${t("Reset")}</span>
              <strong id="reset">-</strong>
            </div>
            <button data-action="selectReset" title="${t("Select reset mode")}" aria-label="${t("Select reset mode")}">${t("Select")}</button>
          </div>
        </div>
      </div>

      <div class="panel-card run-card">
        <header class="section-heading">
          <div>
            <h2>${t("Execute")}</h2>
            <p id="runSummary">115200 8E1 / 0x08000000</p>
          </div>
        </header>
        <button class="primary" data-action="flash">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="6 4 20 12 6 20 6 4"/></svg>
          ${t("Start flashing")}
        </button>
        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="${t("Flash progress")}">
          <div id="bar"></div>
        </div>
        <button class="cancel" data-action="cancel" data-allow-running="true" data-requires-running="true">${t("Cancel")}</button>
        <div class="quick-actions">
          <button data-action="bootloader">${t("Enter Bootloader")}</button>
          <button data-action="run">${t("Reset and run")}</button>
          <button data-action="output" data-allow-running="true">${t("Output")}</button>
        </div>
        <div class="option-pills" id="optionPills"></div>
      </div>
    </section>

    <section class="advanced">
      <details>
        <summary>
          <span>${t("Flash parameters")}</span>
          <small>${t("Baud rate, address, packet size and write options")}</small>
        </summary>
        <div class="editor">
          <label>
            <span>${t("Baud rate")}</span>
            <input id="baudInput" data-setting="baudRate" inputmode="numeric">
            <small>${t("STM32 USART Bootloader commonly uses 115200.")}</small>
          </label>
          <label>
            <span>${t("Flash address")}</span>
            <input id="addressInput" data-setting="flashAddress" placeholder="${t("Leave blank to use the HEX file address")}">
            <small>${t("BIN defaults to 0x08000000; HEX can use the base address in the file.")}</small>
          </label>
          <label>
            <span>${t("Packet size")}</span>
            <input id="packetInput" data-setting="packetSize" inputmode="numeric">
            <small>${t("STM32 write packets support up to 256 bytes.")}</small>
          </label>
          <label>
            <span>${t("Timeout (ms)")}</span>
            <input id="timeoutInput" data-setting="timeout" inputmode="numeric">
            <small>${t("Do not shorten the wait for entering Bootloader without hardware verification.")}</small>
          </label>
          <label>
            <span>${t("Parity")}</span>
            <select id="parityInput" data-setting="parity">
              <option value="even">${t("Even")}</option>
              <option value="none">${t("None")}</option>
            </select>
            <small>${t("Default: 8E1.")}</small>
          </label>
        </div>
        <div class="checks">
          <label><input type="checkbox" data-setting="eraseBeforeWrite"> ${t("Erase before flashing")}</label>
          <label><input type="checkbox" data-setting="verifyAfterWrite"> ${t("Verify after writing")}</label>
          <label><input type="checkbox" data-setting="runAfterWrite"> ${t("Run after success")}</label>
          <label><input type="checkbox" data-setting="closePortAfterWrite"> ${t("Close port when finished")}</label>
        </div>
      </details>

      <details>
        <summary>
          <span>${t("Hardware reset")}</span>
          <small>${t("Change DTR/RTS mapping only when resetMode is custom")}</small>
        </summary>
        <p class="note">${t("Project convention: true means low, false means high. The transport layer inverts Node serialport booleans.")}</p>
        <div class="editor compact-editor">
          <label>
            <span>${t("BOOT0 high")}</span>
            <select data-setting="customReset.boot0High">
              <option value="dtr-true">${t("DTR low (true)")}</option>
              <option value="dtr-false">${t("DTR high (false)")}</option>
              <option value="rts-true">${t("RTS low (true)")}</option>
              <option value="rts-false">${t("RTS high (false)")}</option>
            </select>
          </label>
          <label>
            <span>${t("BOOT0 low")}</span>
            <select data-setting="customReset.boot0Low">
              <option value="">${t("Inverse of BOOT0 high")}</option>
              <option value="dtr-true">${t("DTR low (true)")}</option>
              <option value="dtr-false">${t("DTR high (false)")}</option>
              <option value="rts-true">${t("RTS low (true)")}</option>
              <option value="rts-false">${t("RTS high (false)")}</option>
            </select>
          </label>
          <label>
            <span>${t("Assert RESET")}</span>
            <select data-setting="customReset.resetAssert">
              <option value="dtr-true">${t("DTR low (true)")}</option>
              <option value="dtr-false">${t("DTR high (false)")}</option>
              <option value="rts-true">${t("RTS low (true)")}</option>
              <option value="rts-false">${t("RTS high (false)")}</option>
            </select>
          </label>
        </div>
      </details>

      <details>
        <summary>
          <span>${t("Projects and automation")}</span>
          <small>${t("Save settings, profiles and VS Code Tasks")}</small>
        </summary>
        <div class="action-row">
          <button data-action="selectProfile">${t("Select profile")}</button>
          <button data-action="createProfile">${t("Save profile")}</button>
          <button data-action="projectConfig">${t("Write project config")}</button>
          <button data-action="createTasks">${t("Generate Tasks")}</button>
        </div>
      </details>

      <details>
        <summary>
          <span>${t("Maintenance and dangerous operations")}</span>
          <small>${t("Erase, verify, remove read protection and release the port")}</small>
        </summary>
        <div class="danger-zone">
          <label><input type="checkbox" data-setting="unlockReadProtection"> ${t("Allow removing read protection")}</label>
          <p class="note">${t("Removing read protection erases the entire chip. Use only when the chip is confirmed to be read protected.")}</p>
          <div class="action-row">
            <button data-action="verify">${t("Verify firmware")}</button>
            <button data-action="erase">${t("Erase chip")}</button>
            <button data-action="unlock" class="danger">${t("Remove read protection")}</button>
            <button data-action="closePort">${t("Close port")}</button>
            <button data-action="clearRemembered">${t("Clear remembered device")}</button>
          </div>
        </div>
      </details>
    </section>

    <section class="lower">
      <div class="panel-card log-card">
        <header>
          <h2>${t("Log")}</h2>
          <button class="ghost" data-action="output" data-allow-running="true">${t("Full output")}</button>
        </header>
        <pre id="log"></pre>
      </div>
      <div class="panel-card">
        <header>
          <h2>${t("History")}</h2>
          <button class="ghost" data-action="clearHistory">${t("Clear")}</button>
        </header>
        <ol id="history"></ol>
      </div>
    </section>

    <section class="lower secondary">
      <div class="panel-card" id="diagnosticsCard" hidden>
        <header>
          <h2>${t("Diagnostics")}</h2>
          <button class="ghost" data-action="diagnostics" data-allow-running="true">${t("Run again")}</button>
        </header>
        <pre id="diagnostics"></pre>
      </div>
      <div class="panel-card" id="troubleshootingCard" hidden>
        <header>
          <h2>${t("Troubleshooting")}</h2>
        </header>
        <ul id="troubleshooting"></ul>
      </div>
    </section>
  </main>
  <script nonce="${nonce}" id="serialflash-locale" type="application/json">${locale}</script>
  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
  }
}
