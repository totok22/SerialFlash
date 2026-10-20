# 参与开发与贡献指南

[English](CONTRIBUTING.en.md)

主要维护目标为 `main` 分支上的 VS Code 插件（Web Serial 页面与 CLI 独立维护在 `web` 分支）。

---

## 1. 本地环境与开发调试

### 依赖与运行环境
- Node.js (推荐 18+) 与 npm
- VS Code Desktop 1.90+

```bash
# 安装依赖
npm ci

# 运行全套单元与集成测试
npm test
```

### F5 插件调试
1. 在 VS Code 中打开本仓库根目录；
2. 按 `F5`，选择 `Run SerialFlash Extension` 启动 Extension Development Host 调试窗口；
3. 在弹出的新窗口中打开包含固件工程的工作区，测试命令面板、Activity Bar 侧边栏、Webview 面板及右键菜单；
4. 语言测试：切换 VS Code 显示语言（`zh-CN` / `en`）以验证中英文面板的自适应渲染。

---

## 2. 架构约定与代码规范

- **分层边界**：
  - `src/vscode/`：负责 VS Code UI 集成、配置与命令处理；
  - `src/core/`：负责烧录主流程（`flash-session.js`）、复位时序（`reset-timing.js`）及固件检索（`firmware-discovery.js`）；
  - `src/stm32.js` / `src/firmware.js`：保持协议与格式解析的纯净独立；
  - `src/node-serial-transport.js`：负责串口硬件交互与电平取反适配。
- **电平极性**：项目内部统一约定 `true` 为低电平、`false` 为高电平。仅在串口适配层与 Node `serialport` 对接时进行取反。
- **代码风格**：使用现代化 JavaScript (ESM)，缩进统一为 2 空格。
- **测试覆盖**：新增或修改协议、HEX 解析、固件评分规则或复位时序时，须在 `tests/` 目录下添加或更新单元测试（通过 mock transport 隔离硬件行为）。

---

## 3. 文档与双语规范

- `README.md` 为英文首页，`README.zh-CN.md` 保持内容同步；`docs/` 下技术文档统一使用中文。
- 首页保持简明；详细配置、参数细节与排查指南维护于 `docs/USAGE.md`。
- 电路图与硬件参数变更同步更新 `docs/CH340_HARDWARE.md`。
- 实机硬件测试结果依据 `docs/HARDWARE_VALIDATION.md` 进行记录。

---

## 4. 打包与发布流程

每次发布前执行以下命令进行检查与打包：

```bash
# 执行测试
npm test

# 打包 VSIX 扩展安装包
npm run package
```

在本地 VS Code 中通过 **Extensions: Install from VSIX** 安装生成的 `.vsix` 文件，验证依赖加载与核心命令。

用户可见的变更须记录在 `CHANGELOG.md` 的 `Unreleased` 章节中。版本发布时由维护者统一打标签与发布：

```bash
npm run publish
```
