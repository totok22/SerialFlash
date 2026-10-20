// English source strings are stable keys. Unknown external text is preserved.
const chinese = {
  "The current file is not .hex or .bin firmware.": "当前文件不是 .hex 或 .bin 固件。",
  "No .hex or .bin firmware found in the workspace.": "工作区中没有找到 .hex 或 .bin 固件。",
  "No serial devices found.": "没有发现串口设备。",
  "SerialFlash: Flashing complete.": "SerialFlash: 烧录完成。",

  "Flash target": "烧录目标",
  "Diagnostics": "诊断",
  "Firmware": "固件",
  "Port": "串口",
  "Reset": "复位",
  "Select": "选择",
  "Execute": "执行",
  "Start flashing": "开始烧录",
  "Cancel": "取消",
  "Enter Bootloader": "进 Bootloader",
  "Reset and run": "复位运行",
  "Output": "输出",
  "Flash parameters": "烧录参数",
  "Baud rate, address, packet size and write options": "波特率、地址、包大小和写入选项",
  "Baud rate": "波特率",
  "STM32 USART Bootloader commonly uses 115200.": "STM32 USART Bootloader 常用 115200。",
  "Flash address": "Flash 地址",
  "Leave blank to use the HEX file address": "HEX 可留空使用文件地址",
  "BIN defaults to 0x08000000; HEX can use the base address in the file.": "BIN 默认 0x08000000；HEX 可使用文件内 base address。",
  "Packet size": "包大小",
  "STM32 write packets support up to 256 bytes.": "STM32 写入包最大 256 字节。",
  "Timeout (ms)": "超时 ms",
  "Do not shorten the wait for entering Bootloader without hardware verification.": "复位进入 Bootloader 的等待不要随意缩短。",
  "Parity": "校验位",
  "Default: 8E1.": "默认 8E1。",
  "Erase before flashing": "烧录前擦除",
  "Verify after writing": "写入后校验",
  "Run after success": "成功后运行",
  "Close port when finished": "完成后关闭串口",
  "Hardware reset": "硬件复位",
  "Change DTR/RTS mapping only when resetMode is custom": "仅在 resetMode 为 custom 时需要改 DTR/RTS 映射",
  "Project convention: true means low, false means high. The transport layer inverts Node serialport booleans.": "项目内部约定 true 为低电平、false 为高电平；Node serialport 的布尔值已在传输层统一取反。",
  "Projects and automation": "项目与自动化",
  "Save settings, profiles and VS Code Tasks": "保存配置、profile 和 VS Code Tasks",
  "Select profile": "选择 Profile",
  "Save profile": "保存 Profile",
  "Write project config": "写入项目配置",
  "Generate Tasks": "生成 Tasks",
  "Maintenance and dangerous operations": "维护与危险操作",
  "Erase, verify, remove read protection and release the port": "擦除、校验、解除读保护、释放串口",
  "Allow removing read protection": "允许解除读保护",
  "Removing read protection erases the entire chip. Use only when the chip is confirmed to be read protected.": "解除读保护会触发整片擦除，只在确认芯片处于读保护状态时使用。",
  "Verify firmware": "校验固件",
  "Erase chip": "擦除芯片",
  "Remove read protection": "解除读保护",
  "Close port": "关闭串口",
  "Clear remembered device": "清除记忆",
  "Log": "日志",
  "Full output": "完整输出",
  "History": "历史记录",
  "Clear": "清空",
  "Run again": "重新运行",
  "Idle": "空闲",
  "Flash progress": "烧录进度",
  "Troubleshooting": "故障排查",
  "Even": "偶校验",
  "None": "无校验",
  "BOOT0 high": "BOOT0 高电平",
  "BOOT0 low": "BOOT0 低电平",
  "Assert RESET": "触发 RESET",
  "Inverse of BOOT0 high": "与 BOOT0 高电平相反",
  "DTR low (true)": "DTR 低电平（true）",
  "DTR high (false)": "DTR 高电平（false）",
  "RTS low (true)": "RTS 低电平（true）",
  "RTS high (false)": "RTS 高电平（false）",
  "Select firmware": "选择固件",
  "Select serial port": "选择串口",
  "Select reset mode": "选择复位模式",
  "Flashing": "正在烧录",
  "Writing": "正在写入",
  "Verifying": "正在校验",
  "Cancelling": "正在取消",
  "Done": "完成",
  "Failed": "失败",
  "Error": "错误",
  "Erase": "擦除",
  "Verify": "校验",
  "Run": "运行",
  "Unlock": "解锁",
  "Enabled": "已启用",
  "Disabled": "已禁用",
  "No firmware selected": "未选择固件",
  "No port selected": "未选择串口",
  "Unknown firmware": "未知固件",
  "No flash history": "暂无烧录记录",
  "No output yet": "暂无输出",
  "HEX auto / BIN 0x08000000": "HEX 自动 / BIN 0x08000000",
  "Host": "主机",
  "OS": "操作系统",
  "Local": "本地",
  "Loaded": "已加载",
  "Ports": "串口数量",
  "Serial number": "序列号",
  "last used": "上次使用",
  "CH340C classic circuit": "CH340C 经典电路",
  "CH340X direct circuit": "CH340X 直连电路",
  "Manual BOOT0/RESET": "手动 BOOT0/RESET",
  "Generic DTR high reset / RTS low BOOT": "通用 DTR 高复位 / RTS 低 BOOT",
  "Custom DTR/RTS mapping": "自定义 DTR/RTS 映射",
  "DTR low / RTS high verified classic CH340C timing": "DTR 低 / RTS 高，已验证的 CH340C 经典时序",
  "Direct DTR/RTS wiring timing": "DTR/RTS 直连时序",
  "Do not drive modem control lines": "不驱动调制解调器控制线",
  "Generic preset": "通用预设",
  "Use serialFlash.customReset.* settings": "使用 serialFlash.customReset.* 设置",
  "Close serial monitors, terminals, flash tools or previous connections that are using the port.": "关闭占用串口的串口监视器、终端、烧录工具或上一轮未释放的连接。",
  "Check serial port permissions. On Linux, add your user to dialout/uucp and log in again.": "检查串口权限；Linux 通常需要把当前用户加入 dialout/uucp 组后重新登录。",
  "No Bootloader ACK received: check BOOT0/RESET wiring, reset mode, port selection and 115200 8E1.": "没有收到 Bootloader ACK：确认 BOOT0/RESET 接线、复位模式、端口选择和 115200 8E1。",
  "Current reset mode is {mode}; if timeouts persist, try Select Reset Mode or enter Bootloader manually.": "当前 reset mode 是 {mode}；如果持续超时，尝试 Select Reset Mode 或手动进入 Bootloader。",
  "The target may still be running user firmware and sending serial data. Confirm it has entered the ROM Bootloader.": "目标可能仍在运行用户程序并输出串口数据；先确认已进入 ROM Bootloader。",
  "Bootloader returned NACK: check read protection, flash address, erase state and command support.": "Bootloader 返回 NACK：检查芯片读保护、flash address、擦除状态和当前命令是否被该 Bootloader 支持。",
  "Use Unlock Read Protection only after confirming that erasing the entire chip is allowed.": "只有确认允许全片擦除时，才使用 Unlock Read Protection。",
  "Verification failed: check that the firmware matches the board and the flashAddress/HEX base address is correct, then erase and flash again.": "校验失败：检查固件是否对应当前板卡、flashAddress/HEX base address 是否正确，并重新擦除后再烧录。",
  "Firmware parsing failed: rebuild or export .hex/.bin and check that the file is not a log, ELF or truncated artifact.": "固件解析失败：重新构建或导出 .hex/.bin，确认文件不是日志、ELF 或被截断的产物。",
  "The native serialport dependency is unavailable: reinstall dependencies or install a packaged VSIX, then run Run Diagnostics.": "serialport 原生依赖不可用：重新安装依赖或用已打包 VSIX 安装，并运行 Run Diagnostics。",
  "Open SerialFlash Output for full logs. If needed, run Run Diagnostics and record the port, reset mode, Bootloader version and PID.": "打开 SerialFlash Output 查看完整日志；必要时运行 Run Diagnostics 并记录端口、reset mode、Bootloader 版本和 PID。"
};

export function normalizeLanguage(language) {
  return typeof language === "string" && /^zh(?:[-_]|$)/i.test(language) ? "zh" : "en";
}

export function getTranslations(language) {
  return normalizeLanguage(language) === "zh"
    ? { ...chinese }
    : Object.fromEntries(Object.keys(chinese).map((key) => [key, key]));
}

export function createTranslator(language) {
  const messages = getTranslations(language);
  return (message, values = {}) => {
    const text = Object.hasOwn(messages, message) ? messages[message] : message;
    return String(text).replace(/\{(\w+)\}/g, (match, key) => Object.hasOwn(values, key) ? String(values[key]) : match);
  };
}

// Match only registered application hints; never translate log lines or unknown device text.
export function localizePanelHints(hints, language, resetMode) {
  const t = createTranslator(language);
  const values = { mode: resetMode || "" };
  const entries = Object.entries(chinese).map(([source, translated]) => [
    source,
    source.replace(/\{mode\}/g, () => values.mode),
    translated.replace(/\{mode\}/g, () => values.mode),
  ]);
  return hints.map((hint) => {
    const match = entries.find(([, source, translated]) => hint === source || hint === translated);
    return match ? t(match[0], values) : hint;
  });
}
