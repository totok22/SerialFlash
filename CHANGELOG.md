# 变更记录

## Unreleased

## 0.2.2（预发布）- 2026-11-08

- 新增烧录后 `runMode`：默认 `hardware-reset`，可选 Bootloader `go`；`runAfterWrite=false` 跳过运行。设置、面板、项目配置与 Profile 支持该选项，新烧录历史记录运行选择。
- GO 使用解析后的烧录地址（HEX 基地址、显式覆盖地址或 BIN 默认 `0x08000000`），要求该处有应用向量表。擦除前检查 GET 返回的 GO 支持情况；失败不自动回退到硬件复位。日志区分 GO 应答、已发送复位时序和手动模式跳过运行，不将这些结果当作应用已运行。
- CH340C 经典电路独立维护进入 Bootloader、复位运行和 GO 准备的双线组合。入口保留旧实现的有效组合；运行态改为 `(DTR, RTS) = (false, true)`。GO 前等待 100 ms，通用预设仍按 `boot0Low` 与复位释放状态准备；`none` 不操作控制线。
- CH340X 保留此前已测的入口时序，结束复位改为固定 DTR 运行态并通过 RTS 产生 NRST 脉冲，最终保持 `(RTS, DTR) = (true, false)`。GO 准备也使用该终态，只改变 DTR、不产生复位脉冲，并等待 250 ms。原有复位等待保留，本次新终态待实机回归。
- 修复 Node 串口适配层的局部控制线更新：每次 `set()` 保留并传入完整 `dtr`/`rts` 状态，电平取反约定不变。通用硬件复位的最终状态按预设保留 BOOT0 运行态与复位释放态，不再统一写入 `false/false`。
- `Done` 在串口按配置关闭成功后才输出；关闭失败时保留失败结果，清理错误不覆盖原始协议异常。
- 增加预发布流水线：`v<版本>-pre.N` 标签生成 Marketplace 预发布 VSIX 和 GitHub Pre-release；普通版本标签仍走正式发布，错误标签会终止。
- 同步中英文使用、硬件和协议说明，补充运行结果与关闭串口 A/B 验证模板。关闭串口后的电平取决于驱动和电路。CH340C PDM 板已完成部分实机验证，范围见 `docs/HARDWARE_VALIDATION.md`；CH340X 与其他平台待回归。
- SerialFlash 输出通道中的 `Troubleshooting` 排查提示改为跟随 VS Code 显示语言：中文界面显示中文，其他语言显示英文。此前该提示在日志中固定为中文，Webview 面板和错误弹窗已经本地化。外部错误文本和设备输出仍保持原样。
- 双语 README 的“面板预览”新增一段操作演示 GIF（`docs/assets/serialflash-demo.gif`），展示选择串口、开始烧录与 Writing/Verifying 进度。

## 0.2.1 - 2026-10-20

- 将 VS Code 插件作为 `main` 的主要版本，Web Serial 页面和 CLI 单独维护在 `web` 分支。
- 依据工程文档规范重构与精简双语 README 及 `docs/` 下全套技术文档，剔除冗余免责声明与 AI 模板化表达，明确单事实来源（Single Source of Truth）。
- 完善 `docs/USAGE.md`：按功能对命令进行分组梳理，设置项表格补充类型、默认值与作用说明，精简 VS Code Tasks 与 Profile 配置说明。
- 优化 `docs/CH340_HARDWARE.md` 与 `docs/HARDWARE_VALIDATION.md`：规范化硬件连接条件、电平反转约定、状态机时序及硬件实机测试清单模板。
- 补充英文版关键文档：提供 `docs/USAGE.en.md`、`docs/CH340_HARDWARE.en.md`、`docs/STM32_PROTOCOL.en.md` 与 `CONTRIBUTING.en.md`，满足英文用户对使用手册、时序接线、协议与贡献指南的查阅需求。
- 归档 `docs/VS_CODE_EXTENSION_PLAN.md`：将过时草案精简为插件架构分层设计与历史演进备忘。
- 面板按 VS Code 显示语言自适应中英文，英文为默认回退；复位模式选择提供对应国际化文案。
- 自动发现固件时排除 `CMakeFiles` 编译器探测产物，避免误选探测 BIN。
- 增加可复用的 `.vscode/launch.json` F5 调试入口，更新 `CONTRIBUTING.md` 本地开发与打包流程。
- 增加 GitHub Actions 六平台 CI，覆盖单元测试、`serialport` 原生模块冒烟测试和平台专用 VSIX 打包。
- 增加基于 Microsoft Entra ID 与 GitHub OIDC 的 Marketplace 自动发布流程，推送 `v*` 标签时创建 GitHub Release 并发布扩展。
- 新增 `docs/RELEASING.md`，记录 CI 构建、Entra 身份配置和正式发布步骤。
- 修复 Windows 路径下的固件发现单元测试。

## 0.2.0

### VS Code 插件

- 将分支收敛为 `STM32 Serial Flasher` VS Code 本地插件。
- 增加命令面板、右键菜单、Quick Pick、Output Channel、状态栏和 Webview 烧录面板入口。
- 增加 Activity Bar Sidebar，显示当前配置、常用动作和最近烧录历史。
- 增加擦除、校验、解除读保护、清除记忆、创建项目配置、清空历史命令。
- 增加 `Close Port` 命令，并保证烧录失败时即使关闭自动关端口选项也会释放串口。
- 增加 `Cancel Flash` 命令和 Webview 入口。
- 增加 `custom` 复位模式及 DTR/RTS 自定义映射配置。
- 增加可配置固件发现 globs/excludes。
- 增加 `Show Firmware Info` 命令和右键菜单入口。
- 增加 `Run Diagnostics` 命令、侧边栏和 Webview 入口，用于输出 Extension Host、`serialport` 和串口枚举状态。
- 串口选择和诊断输出保留 serial number 与 VID/PID，便于多设备排查。
- 状态栏在插件激活时会显示已记住的串口。
- `.hex` / `.bin` 右键菜单增加直接校验入口。
- 固件 Quick Pick 增加格式、大小和 HEX base address 摘要。
- 失败日志增加串口占用、权限、Bootloader ACK 超时、NACK 和校验失败等排查建议。
- `Create Project Config` 支持合并带注释的 VS Code `settings.json`，并写入固件发现 globs/excludes。
- `Create Tasks` 支持合并带注释的 VS Code `tasks.json`，并保留已有任务。
- Remote / WSL / Dev Container 环境激活时提示串口归属 Extension Host，并引导运行 Diagnostics。
- Webview 面板运行中会锁定配置和危险动作，只保留 Cancel、Output 和 Diagnostics。
- Webview 面板显示失败排查建议，并在新一轮烧录开始或成功后清理旧错误状态。
- 切换项目 profile 或在 Webview 修改端口后，状态栏会同步当前端口。
- 增加多项目 profile：可保存和切换 `serialFlash.projects`。
- 增加 `serialFlash` VS Code Task Provider。
- 增加 `Create Tasks` 命令，可生成 `.vscode/tasks.json`。
- 增加工作区固件自动发现、排序和上次成功配置记忆。
- Webview 面板支持编辑主要烧录配置、显示最近日志和历史记录。
- 更新插件 Marketplace 图标和 Activity Bar 图标为新的灰色微芯片样式。
- Activity Bar 图标改用 `currentColor`，可随主题在激活/未激活状态下自适应配色。
- 将 STM32 UART ISP 烧录流程抽为 `flashStm32Uart()`，供插件命令统一调用。
- 共享烧录流程支持忽略 Bootloader ACK 前的串口噪声字节。
- 将 DTR/RTS 复位时序抽到 `src/core/reset-timing.js`。
- 增加 manifest、扩展激活、打包和临时 VS Code 安装验证。

### 清理

- 删除旧浏览器 Web Serial 页面、样式、字体和双击启动脚本。
- 删除 CLI 入口，当前分支只保留 VS Code 插件需要的 Node 串口适配、固件解析、协议和 core。

## v0.1.0 - 2026-06-07

首个公开版本。

### 界面

- UI 大改版并更名为 SerialFlash：琥珀色主题、自定义标题字体、间距与布局重新打磨。
- 增加明暗主题切换和中英文切换。
- 主题切换改为整页统一过渡，避免局部闪烁。
- 对齐执行日志面板与烧写设置面板的内容顶部。
- 修复页脚样式、信息图标，移除图片灯箱。
- 修复电路说明对话框按钮无法打开。
- 将串口入口合并为“选择并开启串口”，移除冗余的“开启串口”按钮。

### 烧写与协议

- 增加 STM32 UART ISP 自动进 Bootloader、擦除、写入、校验和运行流程。
- 增加 Intel HEX 解析，包含校验和、EOF、地址和记录长度校验。
- 修复 STM32 GET 命令解析：payload 长度为 `N + 1`，随后才是最终 ACK。
- 增加 STM32 `GO` 命令支持，用于烧写后跳转运行。
- 将 STM32 全片擦除等待时间放宽到 60 秒，兼容擦除较慢的芯片。
- 增加进入 Bootloader 后的稳定等待时间。
- 增加烧写完成后关闭串口选项，避免控制线持续影响目标板运行。

### 硬件预设

- 内置 CH340C 经典电路、CH340X 直连电路和常见 DTR/RTS 组合预设。
- 增加并实测 `ch340x` 直连电路自动时序预设。
- 修复 CH340C 经典电路的 CLI DTR/RTS 入口时序。
- 增加 Node `serialport` DTR/RTS 电平取反适配。
- 将通用 DTR/RTS 复位组合改为 FlyMcu 风格的“复位/进 Bootloader”描述。
- 记录 macOS CH340 优先使用 `/dev/tty.usbserial-*`。

### CLI 与启动

- 增加 Node.js CLI 烧写入口和基于 `serialport` 的 Node 串口适配层。
- 增加 macOS `start.command` 和 Windows `start.bat`，用于双击启动本地服务。

### 文档与测试

- 增加 Intel HEX 和 STM32 包格式测试。
- 增加 CH340C 和 CH340X 硬件说明。
- 增加 CH340C/CH340X 电路图片和排查经验记录。
- 将原实现计划中的协议要点整理为 `docs/STM32_PROTOCOL.md`。
