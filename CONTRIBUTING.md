# 参与开发

主要版本是 `main` 上的 VS Code 插件。Web Serial 页面和 CLI 单独维护在 `web` 分支。
用户入口见 [README.md](README.md) 和 [README.zh-CN.md](README.zh-CN.md)，详细操作见 [docs/USAGE.md](docs/USAGE.md)。

## 安装与调试

使用满足依赖要求的 Node.js 和 npm，在仓库根目录安装依赖并运行测试：

```bash
npm ci
npm test
```

在 VS Code Desktop 中打开仓库根目录，按 F5，选择 `Run SerialFlash Extension`。
仓库的 `.vscode/launch.json` 会启动 Extension Development Host，并加载当前源码。
项目使用 JavaScript，无需编译步骤或构建前置任务。

在新窗口打开固件工程，调用 `SerialFlash: Open Flasher Panel`。
检查命令、文件右键菜单、侧边栏、状态栏、Output 和面板交互。
调试英文、中文面板时，按相应 VS Code 显示语言分别启动并核对。
共享 Webview 代码的渲染预览可辅助检查文案与排版，截图需注明预览方式。
插件截图保留真实文件、端口和执行状态；没有连接目标板时应注明。

## 架构与修改范围

`src/vscode/` 负责 VS Code 集成，`src/core/` 负责烧录流程、时序和固件发现。
`src/stm32.js` 处理协议，`src/firmware.js` 处理 Intel HEX，`src/node-serial-transport.js` 适配串口。
更详细的目录和协作约定见 [AGENTS.md](AGENTS.md)。

修改协议、解析、发现规则、流程或复位时序时，补充对应的回归测试。
测试应覆盖实际故障和边界，硬件行为用 transport mock 隔离。
文档和排版改动以链接、示例及渲染检查为主，无需增加与实现重复的测试。

## 硬件变更

项目内部将 `true` 定义为低电平、`false` 定义为高电平。
只在串口适配层转换为 Node `serialport` 语义。
CH340C 与 CH340X 时序分别维护，不能仅按芯片名称推断接线。
未经实机验证，不要缩短复位或进入 Bootloader 的等待时间。

按 [docs/HARDWARE_VALIDATION.md](docs/HARDWARE_VALIDATION.md) 记录每次插件实机测试。
至少记录日期、系统、插件版本、板卡、MCU、串口芯片、端口、固件、配置、命令、Bootloader 版本、PID 和各阶段结果。
截图、模拟测试、串口枚举和历史 CLI 成功记录都不能代替当前插件的硬件验证。
电路与时序变化同步更新 [docs/CH340_HARDWARE.md](docs/CH340_HARDWARE.md)。

## 文档与发布

`README.md` 默认使用英文，`README.zh-CN.md` 保持内容同步，`docs/` 使用中文。
首页说明动机、安装、操作和硬件边界；命令、参数、命名配置与排查细节放在 `docs/USAGE.md`。
图片和他人说明注明出处，平台运行目标与实际测试结果分开表述。

用户可见变更写入 `CHANGELOG.md` 的 `Unreleased`，发布前再整理成版本条目。
当前扩展市场版本为 0.2.0；未发布的中英文面板不可写成已上架功能。
版本号由维护者在发布时决定。

打包前运行：

```bash
npm test
npm run package
```

VSIX 包含 `serialport` 生产依赖。用 **Extensions: Install from VSIX** 安装后，检查依赖加载、诊断和主要操作入口。
原生依赖能加载不代表该系统上的板卡烧录已通过验证。
检查打包文件，避免夹带固件、设备日志、凭据和本地开发文件。

发布者确认版本号、变更记录、双语首页和验证结果后，才执行：

```bash
npm run publish
```

提交或 PR 应说明解决的问题、最终行为、验证方式和仍缺少的硬件测试。
保留用户已有改动，不提交与本次任务无关的文件。
