# SerialFlash 协作指南

## 项目定位与目录

`main` 维护 STM32 Serial Flasher VS Code 插件，Web Serial 页面和 CLI 位于 `web` 分支。
旧 `vscode-extension` 分支名仅为历史记录；插件文档不要继续把 `main` 当作 Web/CLI 入口。

| 路径 | 职责 |
| --- | --- |
| `package.json` | 插件 manifest、命令、菜单、设置、依赖和版本 |
| `src/vscode/extension.cjs` | CommonJS 入口，加载 ESM 插件实现 |
| `src/vscode/` | 控制器、侧边栏、面板、配置、串口服务、诊断、历史与任务 |
| `src/vscode/i18n.js` | 面板中英文文案和语言选择 |
| `src/vscode/media/` | Webview 前端与图标 |
| `src/core/flash-session.js` | STM32 UART ISP 烧录流程 |
| `src/core/reset-timing.js` | DTR/RTS 进入 Bootloader 和复位运行时序 |
| `src/core/firmware-discovery.js` | 固件候选过滤、评分和自动选择规则 |
| `src/core/node-firmware.js` | Node 侧固件加载 |
| `src/node-serial-transport.js` | Node `serialport` 适配与电平转换 |
| `src/stm32.js` | STM32 USART Bootloader 协议 |
| `src/firmware.js` | Intel HEX 解析 |
| `tests/` | Node 单元和回归测试 |
| `.vscode/launch.json` | 可复用的 F5 插件调试入口 |
| `README.md` / `README.zh-CN.md` | 英文默认首页与同步中文首页 |
| `docs/USAGE.md` | 中文使用参考 |
| `docs/CH340_HARDWARE.md` | 电路、时序与历史 CLI 记录 |
| `docs/HARDWARE_VALIDATION.md` | 插件实机验证模板 |
| `docs/STM32_PROTOCOL.md` | 协议说明 |
| `docs/VS_CODE_EXTENSION_PLAN.md` | 历史开发计划，当前行为以代码为准 |
| `CHANGELOG.md` | 已发布和未发布的变更 |

## 开发与验证

```bash
npm ci
npm test
npm run package
```

在 VS Code 中按 F5，选择 `Run SerialFlash Extension`，在 Extension Development Host 中调试。
项目直接运行 JavaScript，无需编译步骤。
协议、固件解析、发现规则、传输层、流程和时序变更需运行 `npm test`。
用户可见功能或依赖变更还需验证 VSIX 打包和扩展宿主加载。

保持协议与 transport 分离，用 mock 覆盖 ACK/NACK、超时、取消、HEX 地址、固件评分等边界。
固件自动发现应排除 `CMakeFiles` 编译器探测产物。
明确配置的现有文件优先于发现，文档和测试不能把“Latest”简化为按时间取最新文件。
HEX 使用文件基地址，显式 `flashAddress` 可覆盖；BIN 未配置地址时使用 `0x08000000`。

## 硬件与运行边界

- 项目内部约定 `true` 为低电平、`false` 为高电平；Node `serialport` 取反只放在适配层。
- CH340C 与 CH340X 时序独立维护，不要合并预设或按芯片型号假设电路相同。
- 历史 CLI 已记录特定 CH340C、CH340X 板卡的成功结果，不能直接当作当前插件实测结论。
- 未经实机验证，不要缩短复位和进入 Bootloader 的固定等待。
- 插件默认 `115200 8E1`，macOS 端口排序优先 `/dev/tty.usbserial-*`。
- 核对具体 MCU 的 USART 和 BOOT 要求，不能声称所有 STM32 均适配。
- 原生串口依赖在 Desktop 扩展宿主中运行；Remote 串口归实际宿主，不支持 `vscode.dev`。
- macOS、Windows 和 Linux 运行目标与硬件测试范围分开记录。

硬件测试按 `docs/HARDWARE_VALIDATION.md` 记录环境、版本、板卡、配置、命令和结果。
没有目标板时，明确说明仅验证软件、依赖加载或界面。
截图不得用配置、历史记录或构建探测文件冒充本次成功烧录。

## 代码与文档

使用现代 JavaScript 模块和 2 空格缩进。
协议函数保持小而明确，命令字节集中维护，注释解释非显然的时序、电平和协议边界。
硬件修复只改相关逻辑，避免无关重构。

`README.md` 使用英文，`README.zh-CN.md` 保持同步；其他仓库技术文档使用中文。
首页保持简洁，参数、命令、命名配置、任务和排查细节写入 `docs/USAGE.md`。
电路说明、时序和协议变化同步更新对应文档，图片与外部说明标明来源。
中英文面板分别使用 `docs/assets/vscode-panel.png` 与 `docs/assets/vscode-panel.zh-CN.png`。

用户可见变更记入 `CHANGELOG.md` 的 `Unreleased`。
当前已发布 0.2.0，未发布改动不能描述为扩展市场已有功能；版本号由维护者决定。

## Git 与本地文件

保留用户已有改动，不回滚其他协作者的工作。
不要提交固件二进制、设备日志、凭据、`.env*`、`node_modules/`、`dist/` 和 `build/`。
`.vscode/` 仅跟踪通用 `launch.json`，机器相关 settings 和 tasks 保持忽略。
`TODO.md` 是不纳入版本管理的本地任务文件。
commit subject 使用简短祈使句，例如 `Fix CH340 reset timing`。
