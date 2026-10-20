# CI 构建与扩展发布

本仓库 `main` 是 VS Code Desktop 扩展（`totok22.serialflash-stm32`），不是旧版 Web/CLI。发布产物为平台专用 `.vsix`，不生成 `.exe` 或 `.app`。

## 构建

`.github/workflows/ci.yml` 在针对 `main` 的 PR、推送 `main`、手动触发及推送 `v*` 标签时执行：

1. 六个平台/架构运行 `npm ci` 和 `npm test`。
2. 执行 `node tests/native-binding-smoke.mjs`，在无设备条件下加载 `serialport` 原生模块并枚举串口。
3. 使用固定版本 `@vscode/vsce@4.0.0` 为对应目标打包 VSIX，作为 GitHub Actions Artifacts 保存 14 天。

| 目标 | Runner |
| --- | --- |
| `win32-x64` | `windows-2025` |
| `win32-arm64` | `windows-11-arm` |
| `darwin-x64` | `macos-15-intel` |
| `darwin-arm64` | `macos-15` |
| `linux-x64` | `ubuntu-24.04` |
| `linux-arm64` | `ubuntu-24.04-arm` |

`serialport` 使用原生依赖，不能把单个宿主机器上的 VSIX 当作跨平台验证。CI 只覆盖单元测试、原生依赖加载和 VSIX 打包；实际 STM32 烧写、DTR/RTS 时序、VS Code Extension Host 加载仍需人工实机验证（见 `docs/HARDWARE_VALIDATION.md`）。失败的平台会阻止自动发布，不应删掉失败作业来假装支持该平台。

## Marketplace 认证

GitHub Actions 不需要额外的 GitHub PAT。工作流已使用仓库自带的 `GITHUB_TOKEN` 创建 GitHub Release。

**方式 A：Marketplace PAT（默认，配置简单）**

1. 在 [Azure DevOps](https://dev.azure.com/) 登录具备 `totok22` Marketplace Publisher 发布权限的 Microsoft 身份，进入 **User settings → Personal access tokens → New Token**。
2. 按 VS Code 官方发布文档选择 **All accessible organizations**、**Custom defined → Marketplace → Manage**，设置较短有效期，创建并复制 PAT。
3. 在 [SerialFlash Actions Secrets](https://github.com/totok22/SerialFlash/settings/secrets/actions) 选择 **New repository secret**，名称填写 `VSCE_PAT`，值粘贴 PAT。不要提交到代码、Issue、PR 或 Actions 日志。
4. 无需设置 `MARKETPLACE_AUTH`；工作流默认使用 `VSCE_PAT` 认证。过期前需轮换。

注意：微软公告 **2026-12-01 停用 Azure DevOps 全局 PAT**。这意味着上面的方式是过渡方案，不应长期依赖。官方建议改为不使用长期 Token 的认证。

**方式 B：OIDC Trusted Publishing（推荐长期使用）**

新版 `vsce` 支持 `publish --oidc`。Marketplace 端必须事先配置并启用信任 **`totok22/SerialFlash`** 和工作流 **`.github/workflows/ci.yml`** 的 Trusted Publishing Policy；请先在 [Publisher 管理页](https://marketplace.visualstudio.com/manage/publishers/) 确认账户当前具备此配置入口与权限。

完成 Marketplace 信任配置后，在 [GitHub Actions Variables](https://github.com/totok22/SerialFlash/settings/variables/actions) 新建 repository variable：`MARKETPLACE_AUTH` = `oidc`。工作流已经将 `id-token: write` 限制在发布 job；此模式不读取 `VSCE_PAT`，不需要存储 Marketplace PAT。

如果 Marketplace 端尚未向当前 Publisher 提供可信发布策略设置，不要仅切换变量，否则身份交换会失败。届时沿用短期 PAT 或按照官方文档采用 Microsoft Entra ID 方式。

## 正式发布步骤

1. 合并改动至 `main`；确认 PR/主分支六平台 CI 全部通过，按需进行硬件实机验证。
2. 修改 `CHANGELOG.md`：将待发布变更移到具体版本标题；更新版本号。例如由 `0.2.0` 更新到 `0.2.1`：

   ```bash
   npm version patch --no-git-tag-version
   git add package.json package-lock.json CHANGELOG.md
   git commit -m "Release 0.2.1"
   git push origin main
   git tag v0.2.1
   git push origin v0.2.1
   ```

3. 标签必须与 `package.json` 的版本严格一致，且指向该版本提交。推送 `v0.2.1` 将重新执行六平台测试/打包，成功后自动将六个 VSIX 上传到 GitHub Release，并推送到 VS Code Marketplace。已发布同版本时，`--skip-duplicate` 使重新运行能够跳过重复包。
4. 通过 [GitHub Actions](https://github.com/totok22/SerialFlash/actions) 检查各 job 状态，并在 [Marketplace 页面](https://marketplace.visualstudio.com/items?itemName=totok22.serialflash-stm32) 确认版本。普通 `main` 推送和 PR **不会发布**。

如需手动从 GitHub Release 安装，下载与系统架构匹配的 `.vsix`，在 VS Code 中选择 **Extensions: Install from VSIX...**。

参考：[VS Code 发布文档](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)、[VS Code CI 文档](https://code.visualstudio.com/api/working-with-extensions/continuous-integration)、[vsce 官方仓库（OIDC）](https://github.com/microsoft/vscode-vsce#trusted-publishing)。
