# GitHub Actions 无 PAT 发布 VS Code 扩展：Microsoft Entra ID + OIDC

[English](VSCODE_MARKETPLACE_ENTRA_OIDC.en.md) · [实际项目示例：SerialFlash](https://github.com/totok22/SerialFlash) · [官方 VS Code 发布文档](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)

> **适用范围（2026-10）**：在 GitHub 托管源码、发布到 **Visual Studio Marketplace** 的 VS Code 扩展。本文使用 **GitHub Actions → Microsoft Entra ID 工作负载身份联合 → `vsce publish --azure-credential`**，无需保存或轮换 PAT、Client Secret。Marketplace 原生 `vsce publish --oidc` 截至写作时尚未完整启用，二者不是同一种方案；发布前可查阅 [vsmarketplace#1422](https://github.com/microsoft/vsmarketplace/issues/1422)。

## 0. 前置条件与参数

- 一个可管理的 VS Code Marketplace Publisher；[Publisher 管理页面](https://marketplace.visualstudio.com/manage/publishers/) → Details → **ID** 必须与扩展 `package.json` 中的 `publisher` 一致。注意 **Publisher Name** 仅是展示名称。
- 可以创建 Microsoft Entra 应用注册的租户权限，以及有权管理上述 Publisher 的 Microsoft 账户。
- 有权修改 GitHub 仓库的 Actions、Environments、Variables 和工作流。
- Node.js/npm、扩展 `package.json`、可用的 `@vscode/vsce`；如需可复现构建，仓库需提交 `package-lock.json`。

先确定以下占位符，全文保持一致：

| 占位符 | 含义 | SerialFlash 示例 |
| --- | --- | --- |
| `OWNER` / `REPO` | GitHub 所有者与仓库 | `totok22` / `SerialFlash` |
| `PUBLISHER_ID` | Marketplace Publisher **ID** | `totok22` |
| `ENV_NAME` | 专用 GitHub Environment | `publish-vscode-marketplace` |
| `AZURE_CLIENT_ID` | Entra 应用程序（客户端）ID | 在应用概述中读取 |
| `AZURE_TENANT_ID` | Entra 目录（租户）ID | 在应用概述中读取 |

示例扩展包在 `package.json` 中至少应有：

```json
{
  "name": "my-extension",
  "publisher": "my-publisher",
  "version": "1.0.0",
  "engines": { "vscode": "^1.90.0" }
}
```

其中 `publisher` 是 Marketplace 的 **ID**，与 GitHub 所有者不必相同。

## 1. 注册 Microsoft Entra 应用

打开 [Microsoft Entra 管理中心](https://entra.microsoft.com/) → **Entra ID → 应用注册 → 新注册**：

1. 名称自定，如 `VS Code Marketplace Publisher`。
2. 账户类型一般选 **仅此组织目录中的账户（单租户）**。
3. **重定向 URI 留空**，点击「注册」。
4. 在「概述」保存 `应用程序(客户端) ID` 和 `目录(租户) ID`。

这是 **应用注册 / Service Principal** 方案，不用创建 Azure「用户分配的托管标识」、客户端密码或长期密钥。租户是否允许应用注册由管理员策略决定；是否需要 Azure 订阅取决于所采用的身份方案，本例的 Azure CLI 登录使用 `allow-no-subscriptions: true`。

## 2. 创建并保护 GitHub Environment

打开仓库 **Settings → Environments → New environment**，命名为 `ENV_NAME`（例：`publish-vscode-marketplace`）。

推荐 **Deployment branches and tags → Selected branches and tags**，只允许正式发行标签 `v*`；需要审批时可启用 Required reviewers。正式发布 job 将引用此 Environment：它同时是发布门禁和 OIDC Subject 的一部分。

无需创建 Environment Secret。进行一次性手动 Profile ID 查询时，如工作流从默认分支运行，需要**暂时**允许 `main`，查询后立即删除该分支规则，恢复仅 `v*`。

## 3. 关联 GitHub 与 Entra：联合凭据

进入刚创建的 Entra 应用 → **证书和密码 → 联合凭据 → 添加凭据**，选择「GitHub Actions 部署 Azure 资源」。

填写：**组织** `OWNER`、**存储库** `REPO`、**实体类型**「环境（Environment）」、**GitHub 环境名称** `ENV_NAME`、凭据名称自定。新版界面还会要求 **Organization ID** 和 **Repository ID**：可从 GitHub API 的 `https://api.github.com/users/OWNER`（字段 `id`）及 `https://api.github.com/repos/OWNER/REPO`（字段 `id`）读取。组织所有者可改用对应 organizations API。

Issuer 固定为：

```text
https://token.actions.githubusercontent.com
```

Audience 固定为：

```text
api://AzureADTokenExchange
```

**Subject 必须与 GitHub Actions 实际签发的 `subject claim` 字节一致**，不能仅根据仓库年龄猜测：

```text
# 传统格式
repo:OWNER/REPO:environment:ENV_NAME

# 带不可变数字 ID 的格式
repo:OWNER@OWNER_ID/REPO@REPO_ID:environment:ENV_NAME
```

GitHub 自 2026-07-15 起对新建、重命名或转移的仓库使用含数字 ID 的默认格式；已有仓库也可能主动启用。Entra 表单有时会自动填入新格式，请不要擅自覆盖。最可靠的方法是运行一次 `azure/login` 工作流，从日志的 **Federated token details → subject claim** 读取实际内容，再更新 Entra 凭据。若报 `AADSTS700213`，优先逐字核查 Subject、Issuer、Audience、Environment 名称。

SerialFlash 实际通过的 Subject：

```text
repo:totok22@161900590/SerialFlash@1255150268:environment:publish-vscode-marketplace
```

## 4. 配置 GitHub Actions Variables

仓库 **Settings → Secrets and variables → Actions → Variables → New repository variable**：

| Name | Value |
| --- | --- |
| `AZURE_CLIENT_ID` | Entra 应用的 Application (client) ID |
| `AZURE_TENANT_ID` | Entra 应用的 Directory (tenant) ID |

这两个 ID 是标识符，不是密码。不要放入客户端密码、PAT 或其他长期密钥。本指南的 `azure/login` 使用上述 Variables，且 `allow-no-subscriptions: true`。

## 5. 获取 Marketplace 发布身份的 Profile User ID

**Entra 登录成功不代表 Marketplace 已授权。** Marketplace **Members → Add** 需要的是该 Service Principal 在 Azure DevOps Profile API 返回的 `id`，**不能填 Entra Client ID / Object ID / Tenant ID**。

先添加以下只供管理员手动执行的 GitHub Actions 文件 `.github/workflows/marketplace-profile.yml`。将 `ENV_NAME` 替换为你的环境名：

```yaml
name: Lookup Marketplace profile ID
on:
  workflow_dispatch:
permissions:
  contents: read
jobs:
  lookup:
    runs-on: ubuntu-latest
    environment: ENV_NAME
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: azure/login@v3
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          allow-no-subscriptions: true
      - name: Fetch service principal's Marketplace profile ID
        shell: bash
        run: |
          set -euo pipefail
          az rest \
            --method get \
            --url "https://app.vssps.visualstudio.com/_apis/profile/profiles/me" \
            --resource "499b84ac-1321-427f-aa17-267ca6975798" \
            --query id --output tsv
```

运行：**Actions → Lookup Marketplace profile ID → Run workflow**。若 Environment 仅允许标签、而手动触发从 `main` 执行，先临时允许 `main`，运行后移除。该 API 的 `499b84ac-1321-427f-aa17-267ca6975798` 是 **Azure DevOps 资源 ID**，不是个人账号 ID。

然后在 [Marketplace Publisher 管理页](https://marketplace.visualstudio.com/manage/publishers/) → 你的 Publisher → **Members → Add**：

1. `User Id` 填上述命令输出的 GUID。
2. 角色选 **Contributor**（SerialFlash 已验证该角色可发布），提交添加。
3. 成功后列表可能显示 `TenantID\\ServicePrincipalID` 格式，而不是输入的 Profile GUID；以成员添加成功及实际发布权限为准。

查询工作流可保留供维护，也可在授权后删除。**立即恢复 Environment 的发布标签限制**。

## 6. 配置自动发布工作流

以下为**单个跨平台兼容 VSIX** 的最小发布示例；依赖 Node 原生模块的扩展应使用每个平台的 Runner 和 `vsce package --target` 单独打包，参考 [SerialFlash 的完整六平台 CI](../.github/workflows/ci.yml)。

新建 `.github/workflows/publish.yml`，修改 `ENV_NAME`：

```yaml
name: Publish VS Code extension
on:
  push:
    tags: ['v*']
permissions:
  contents: read
jobs:
  publish:
    runs-on: ubuntu-latest
    environment: ENV_NAME
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm
      - run: npm ci
      - run: npm test
      - name: Match tag to package version
        env:
          TAG: ${{ github.ref_name }}
        run: node -e 'if (process.env.TAG !== "v" + require("./package.json").version) process.exit(1)'
      - name: Package
        run: npx --yes @vscode/vsce@4.0.0 package --out extension.vsix
      - name: Authenticate with Entra (OIDC)
        uses: azure/login@v3
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          allow-no-subscriptions: true
      - name: Publish to Marketplace
        run: npx --yes @vscode/vsce@4.0.0 publish --azure-credential --packagePath extension.vsix
```

关键点：

- `permissions: id-token: write` 允许 GitHub 请求 OIDC 身份令牌；不等于直接授予 Azure 修改权限。
- `azure/login` 把 GitHub OIDC 身份换成 Entra 会话；`vsce --azure-credential` 使用该会话向 Marketplace 发布。
- **不要把 `--oidc` 与 `--azure-credential` 混用。**
- 如果还要发布 GitHub Release，单独使用 `GITHUB_TOKEN` 和 `contents: write`，只授予 Release job；不需要 GitHub PAT。
- 可将构建测试 job 与发布 job 分离、使用 `needs: build`，并在 GitHub Environment 限定正式 Tag。
- 涉及 `serialport`、`sharp`、`sqlite3` 等原生二进制依赖时，不要把仅在 Linux 打包成功视作 Windows/macOS 已验证；分别验证平台构建及原生加载。

## 7. 发布新版本

先确认版本、`CHANGELOG.md` 和测试通过，再从仓库根目录执行（以下示例使用 npm lockfile）：

```bash
npm version patch --no-git-tag-version
# 编辑 CHANGELOG.md，整理对应版本更新内容
git add package.json package-lock.json CHANGELOG.md
git commit -m "Release next patch version"
git push origin main
git tag v1.0.1          # 改成 package.json 中实际的版本
git push origin v1.0.1
```

版本标签必须与 `package.json` 的 `version` 一致；真实扩展已存在的版本不可当作新的发行版本重复发布。首次运行应检查 Actions 作业成功及 Marketplace 页面最终版本状态，`Verifying` 表示平台仍在处理，并非最终验证结束。

## 常见问题

| 现象 | 检查项 |
| --- | --- |
| `AADSTS700213` | Entra Subject 与 GitHub 日志的实际 `subject claim` 不同；核对 ID、Environment、Issuer、Audience |
| `azure/login` 成功，但 Profile API 失败 | `az rest` 的 `--resource`、租户/身份以及服务主体可访问性 |
| Marketplace 提示无权发布 | 确认添加的是 **Profile API 返回的 ID**，且拥有该 Publisher 的发布角色 |
| Job 等待/被拒绝部署 | GitHub Environment 的标签限制、审批设置、Job 引用的 Environment 名称 |
| 版本已存在 | `package.json` 和标签递增，避免重复上传不可重用的版本 |
| 仅部分平台可安装 | 原生依赖需要对应目标架构的构建和运行验证 |

## 参考资料

- [VS Code 官方：Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [GitHub 官方：Configuring OIDC in Azure](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-azure)
- [GitHub：Immutable subject claims（2026）](https://github.blog/changelog/2026-04-23-immutable-subject-claims-for-github-actions-oidc-tokens/)
- [Microsoft Learn：Service Principal 的 Profile API 获取方法](https://learn.microsoft.com/en-us/azure/devops/extend/publish/command-line)
- [microsoft/vsmarketplace#1422：Marketplace Trusted Publishing 进展](https://github.com/microsoft/vsmarketplace/issues/1422)
- [object-Object/vscode-hex-casting：早期 Entra OIDC 发布实践](https://github.com/object-Object/vscode-hex-casting/blob/a658ed5565eac6f03101d53f5e0da616beada178/publishing.md)
- [SerialFlash：六平台构建、Profile ID 查询和 Marketplace 发布实例](https://github.com/totok22/SerialFlash/tree/main/.github/workflows)

本文记录了一条在 SerialFlash `v0.2.1` 已执行成功的 Entra 联合登录和 Marketplace 提交流程。微软/GitHub 后续可能调整登录接口或 Publisher 策略；首次迁移其他仓库时，以实际 Actions 日志和官方文档为准。
