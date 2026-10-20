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

## Marketplace 认证（Microsoft Entra ID + GitHub OIDC）

Marketplace 当前不支持直接使用 `vsce publish --oidc` 的完整可信发布后端；请不要使用该选项。微软推荐通过 Microsoft Entra ID 的工作负载身份联合（WIF）配合 `vsce publish --azure-credential`，不必储存或轮换 Marketplace PAT。

本工作流使用 GitHub Environment `publish-vscode-marketplace`。**必须先创建与配置这个 Environment，并在 Azure 联合凭据中使用对应的 environment subject**，否则登录失败。

1. 在 [GitHub Environments](https://github.com/totok22/SerialFlash/settings/environments) 创建 `publish-vscode-marketplace`，建议将 Deployment branches and tags 设为 Selected branches and tags，仅添加 Tag 模式 `v*`；也可开启 required reviewers，并关闭管理员绕过保护规则（按仓库实际权限可选）。
2. 前往 [Microsoft Entra 管理中心](https://entra.microsoft.com/) → App registrations → New registration，注册供 SerialFlash 发布使用的应用；记录 Application (client) ID 和 Directory (tenant) ID。无需创建用户分配的 Azure 资源。
3. 进入该应用的 Certificates & secrets → Federated credentials → Add credential → GitHub Actions deploying Azure resources。填写：
   - Organization: `totok22` / Organization ID: `161900590`
   - Repository: `SerialFlash` / Repository ID: `1255150268`
   - Entity type: `Environment`
   - Environment name: `publish-vscode-marketplace`
   - Audience: `api://AzureADTokenExchange`
   - **Subject must match the actual GitHub token**. SerialFlash was created before 2026-07-15; unless it explicitly opted into immutable OIDC subjects or was renamed/transferred after that date, edit the generated Subject to `repo:totok22/SerialFlash:environment:publish-vscode-marketplace`. For repositories using immutable subjects, keep `repo:totok22@161900590/SerialFlash@1255150268:environment:publish-vscode-marketplace`. See [GitHub OIDC documentation](https://docs.github.com/en/actions/reference/security/oidc) and check actual repository OIDC configuration before selecting a format.
4. **Marketplace Publisher 授权不可略过。** 按照 [VS Code 官方 Entra 发布文档](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) 的 *Microsoft Entra ID* 部分，取得关联此 Entra 应用的 Azure DevOps/Marketplace 身份，并在 [Publisher 管理页面](https://marketplace.visualstudio.com/manage/publishers/) 的 `totok22` → Members 添加此身份，授予发布权限。此步骤不是简单填入 client ID；需要按文档完成应用主体与 Marketplace Publisher 的关联。
5. 在 [GitHub Actions Variables](https://github.com/totok22/SerialFlash/settings/variables/actions) 设置 `AZURE_CLIENT_ID` 与 `AZURE_TENANT_ID`。可作为仓库 Variables（本身非密钥）；Workflow 将使用 GitHub 颁发的 OIDC 令牌登录 Entra。
6. 在经过 CI 测试的版本标签上验证发布流程。VSIX 文件按平台构建；`vsce publish --azure-credential` 使用由 `azure/login` 建立的 Azure CLI 会话，不使用任何 Marketplace PAT。

注意：Azure 登录成功只表明联合身份配置有效，**不表示 Publisher 权限已经完成**。若 Marketplace 拒绝发布，请先核实应用所对应的 Marketplace 成员身份与角色，不要尝试绕过授权。

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
