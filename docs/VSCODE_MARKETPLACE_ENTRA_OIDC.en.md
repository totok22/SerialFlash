# Publish VS Code Extensions without PATs: GitHub Actions + Microsoft Entra OIDC

[简体中文](VSCODE_MARKETPLACE_ENTRA_OIDC.md) · [Validated example: SerialFlash](https://github.com/totok22/SerialFlash) · [Official VS Code publishing documentation](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)

> **Scope (October 2026):** Publishing a VS Code extension to **Visual Studio Marketplace** from GitHub Actions using Microsoft Entra workload identity federation (WIF) and `vsce publish --azure-credential`. No persistent Personal Access Token (PAT) or application client secret is required. Marketplace-native `vsce publish --oidc` is a different mechanism and its backend was not fully enabled when this guide was written; follow [vsmarketplace#1422](https://github.com/microsoft/vsmarketplace/issues/1422) for changes.

## Prerequisites and variables

You need: a Marketplace publisher you can administer, permission to register a Microsoft Entra application, a GitHub repository with Actions/Environments settings access, and a working VS Code extension manifest plus npm build.

| Placeholder | Meaning | SerialFlash example |
| --- | --- | --- |
| `OWNER/REPO` | GitHub owner and repository | `totok22/SerialFlash` |
| `PUBLISHER_ID` | Marketplace publisher **ID**, not display name | `totok22` |
| `ENV_NAME` | Dedicated GitHub Environment | `publish-vscode-marketplace` |
| `AZURE_CLIENT_ID` | Entra Application (client) ID | Obtain from app Overview |
| `AZURE_TENANT_ID` | Entra Directory (tenant) ID | Obtain from app Overview |

Make sure `package.json` includes a unique extension `name`, `version`, and a `publisher` matching **Publisher → Details → ID**. The publisher ID need not be the GitHub username.

## 1. Register an Entra application

Open [Microsoft Entra admin center](https://entra.microsoft.com/) → **Entra ID → App registrations → New registration**.

1. Give the app a descriptive name such as `VS Code Marketplace Publisher`.
2. Choose *Accounts in this organizational directory only* (single tenant) for the usual setup.
3. Leave Redirect URI empty and register the application.
4. Copy the **Application (client) ID** and **Directory (tenant) ID** from Overview.

Use an **App registration/service principal**, not an Azure user-assigned managed identity. No client secret is needed. The GitHub Action below uses `allow-no-subscriptions: true`.

## 2. Add a protected GitHub Environment

Go to **Repository → Settings → Environments → New environment**. Name it `ENV_NAME`, for example `publish-vscode-marketplace`.

Set **Deployment branches and tags → Selected branches and tags**, with **tag rule `v*`** and no allowed branches. Optionally require reviewers. An Environment establishes deployment restrictions *and* appears in the OIDC subject.

For the one-off profile lookup workflow in Step 5, a workflow launched from `main` requires temporarily allowing `main` in the Environment. Remove that temporary branch rule immediately afterward.

## 3. Configure a federated credential in Entra

Open the new application → **Certificates & secrets → Federated credentials → Add credential**, choose **GitHub Actions deploying Azure resources**.

- Organization: `OWNER`; repository: `REPO`.
- Entity type: **Environment**; environment name: `ENV_NAME`.
- Credential name: any descriptive name.
- Newer forms require numeric **Organization ID** and **Repository ID**. Look up the `id` fields using `https://api.github.com/users/OWNER` (or the organizations endpoint) and `https://api.github.com/repos/OWNER/REPO`.

Verify:

```text
Issuer:   https://token.actions.githubusercontent.com
Audience: api://AzureADTokenExchange
```

The **Subject** must exactly match what GitHub issued. Two formats may appear:

```text
# Traditional
repo:OWNER/REPO:environment:ENV_NAME

# Immutable owner/repository IDs
repo:OWNER@OWNER_ID/REPO@REPO_ID:environment:ENV_NAME
```

Do **not** assume the format based solely on repository creation date. Check `azure/login` logs for `Federated token details → subject claim` and copy that claim into the credential. For instance, the actual token from SerialFlash was:

```text
repo:totok22@161900590/SerialFlash@1255150268:environment:publish-vscode-marketplace
```

`AADSTS700213` usually indicates a mismatch in Subject/Issuer/Audience or the Environment name.

## 4. Set GitHub Actions variables

Go to **Settings → Secrets and variables → Actions → Variables**, add:

| Name | Value |
| --- | --- |
| `AZURE_CLIENT_ID` | Entra application Client ID |
| `AZURE_TENANT_ID` | Entra Directory Tenant ID |

These are identifiers, not secrets. Do not create or commit PATs/client secrets for this flow.

## 5. Obtain and authorize the Marketplace Profile User ID

Successful Entra authentication does **not** grant Marketplace publisher access. Marketplace **Members → Add** expects a **Profile API user ID**, not the Entra Client ID, Object ID, or Tenant ID.

Add this **manually invoked**, non-publishing workflow at `.github/workflows/marketplace-profile.yml`, replacing `ENV_NAME`:

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
      - name: Get Marketplace profile ID
        shell: bash
        run: |
          set -euo pipefail
          az rest \
            --method get \
            --url "https://app.vssps.visualstudio.com/_apis/profile/profiles/me" \
            --resource "499b84ac-1321-427f-aa17-267ca6975798" \
            --query id --output tsv
```

Launch **Actions → Lookup Marketplace profile ID → Run workflow**. Temporarily add `main` to permitted Environment branches only if needed, then remove it.

The resource GUID in the command identifies the **Azure DevOps resource**, not your user identity. Copy the GUID returned by the API. In [Marketplace publisher management](https://marketplace.visualstudio.com/manage/publishers/) → your publisher → **Members → Add**, paste it under **User Id**, select **Contributor**, and confirm.

The resulting member display may show `TenantID\ServicePrincipalID` instead of the Profile GUID; that display alone is not an error. Verify membership and actual publishing rights. The lookup workflow may be removed after setup.

## 6. Configure automatic publishing

For a JavaScript-only extension that produces one platform-neutral VSIX, create `.github/workflows/publish.yml` and replace `ENV_NAME`:

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
      - name: Check tag matches manifest
        env:
          TAG: ${{ github.ref_name }}
        run: node -e 'if (process.env.TAG !== "v" + require("./package.json").version) process.exit(1)'
      - run: npx --yes @vscode/vsce@4.0.0 package --out extension.vsix
      - uses: azure/login@v3
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          allow-no-subscriptions: true
      - run: npx --yes @vscode/vsce@4.0.0 publish --azure-credential --packagePath extension.vsix
```

`id-token: write` only lets GitHub request an OIDC token. `azure/login` exchanges the token for Entra identity, which `vsce --azure-credential` uses. Do **not** substitute `vsce --oidc`.

For native dependencies such as `serialport`, `sharp`, or `sqlite3`, package for each supported OS/CPU target using `vsce package --target` on suitable runners, then publish the resulting VSIX files. The production [SerialFlash matrix workflow](../.github/workflows/ci.yml) demonstrates six targets. Keep build/tests separate from the release job (`needs: build`) and grant GitHub Release `contents: write` only to jobs requiring it.

## 7. Release a version

Update the changelog, run tests, and keep the Git tag consistent with `package.json`:

```bash
npm version patch --no-git-tag-version
# Update CHANGELOG.md
git add package.json package-lock.json CHANGELOG.md
git commit -m "Release next patch version"
git push origin main
git tag v1.0.1       # Replace with the actual package.json version
git push origin v1.0.1
```

Confirm Actions completed, then wait for the Marketplace version to progress beyond `Verifying` into its final state.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `AADSTS700213` | Actual GitHub `subject claim` versus Entra credential, Environment, Issuer, Audience |
| Azure login succeeds but profile lookup fails | Azure DevOps resource ID, signed-in principal and API access |
| Marketplace refuses upload | Correct Profile API User ID was added to the right Publisher with Contributor permissions |
| Deployment blocked | GitHub Environment tag rules and required reviewers |
| Version already exists | Increment manifest version and push matching tag |
| Platform-specific install errors | Build/load-test native dependencies for the actual OS and architecture |

## References

- [VS Code: Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [GitHub: OIDC in Azure](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-azure)
- [GitHub: Immutable OIDC subject claims](https://github.blog/changelog/2026-04-23-immutable-subject-claims-for-github-actions-oidc-tokens/)
- [Microsoft Learn: Publish extensions using a service principal](https://learn.microsoft.com/en-us/azure/devops/extend/publish/command-line)
- [vsmarketplace#1422: Trusted Publishing status](https://github.com/microsoft/vsmarketplace/issues/1422)
- [vscode-hex-casting: Entra-based workflow example](https://github.com/object-Object/vscode-hex-casting/blob/a658ed5565eac6f03101d53f5e0da616beada178/publishing.md)
- [SerialFlash: tested build and release workflows](https://github.com/totok22/SerialFlash/tree/main/.github/workflows)

This guide reflects a real Entra OIDC login and Marketplace submission for SerialFlash `v0.2.1`. Check upstream changes before applying the procedure to another project.
