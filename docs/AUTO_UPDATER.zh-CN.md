# 自动更新器配置指南

本文档说明如何为 Refinex Terminal 配置 Tauri 自动更新器。

## 概述

自动更新器配置为检查 GitHub Releases 的新版本。当有新版本可用时，用户将在应用程序右下角看到一个非侵入式通知。

## 配置

### 1. 生成签名密钥（可选但推荐）

对于生产版本，您应该签名更新以确保真实性：

```bash
# 如果尚未安装 Tauri CLI，请先安装
cargo install tauri-cli

# 生成新的密钥对
cargo tauri signer generate -w ~/.tauri/myapp.key

# 这将输出：
# - 私钥保存到：~/.tauri/myapp.key
# - 公钥：<your-public-key>
```

**重要**：保护好私钥（`~/.tauri/myapp.key`），永远不要将其提交到版本控制！

### 2. 更新 tauri.conf.json

将公钥添加到 `src-tauri/tauri.conf.json`：

```json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://github.com/refinex/refinex-terminal/releases/latest/download/latest.json"
      ],
      "dialog": false,
      "pubkey": "YOUR_PUBLIC_KEY_HERE"
    }
  }
}
```

### 3. 在 CI/CD 中签名发布

更新 `.github/workflows/release.yml` 以签名发布：

```yaml
- name: Build Tauri app
  env:
    TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
  run: pnpm tauri build
```

将私钥添加到 GitHub Secrets：
1. 转到您的仓库 → Settings → Secrets and variables → Actions
2. 添加 `TAURI_SIGNING_PRIVATE_KEY`，内容为 `~/.tauri/myapp.key` 的内容
3. 如果设置了密码，添加 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

## 工作原理

### 应用启动时

1. 应用在后台检查更新（非阻塞）
2. 如果有可用更新，右下角会出现通知
3. 通知显示：
   - 新版本号
   - 发布说明
   - "更新并重启"按钮
   - 关闭按钮

### 更新流程

1. 用户点击"更新并重启"
2. 下载更新并显示进度条
3. 下载完成后，应用自动重启到新版本

### 手动检查

用户可以通过以下方式手动检查更新：
- 命令面板（`Cmd/Ctrl + Shift + P`）→ "检查更新"
- 设置 → 关于 → "检查更新"按钮

## 测试

### 本地测试

1. 构建发布版本：
   ```bash
   pnpm tauri build
   ```

2. 在 GitHub 上创建一个版本号更高的测试发布

3. 运行构建的应用并验证更新通知是否出现

###D 测试

1. 创建测试标签：
   ```bash
   git tag v0.1.1-test
   git push origin v0.1.1-test
   ```

2. 发布工作流将自动构建并发布

3. 下载并运行之前的版本以测试更新流程

## 更新清单

Tauri 在构建过程中自动生成 `latest.json` 文件。此文件包含：

```json
{
  "version": "0.1.1",
  "notes": "来自 GitHub 的发布说明",
  "pub_date": "2024-01-01T00:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "signature": "...",
      "url": "https://github.com/.../app.app.tar.gz"
    },
    "windows-x86_64": {
      "signature": "...",
      "url": "https://github.com/.../app.msi"
    }
  }
}
```

此文件必须作为 `late到 GitHub Release。

## 故障排除

### 更新检查失败

- 验证 `tauri.conf.json` 中的端点 URL 是否正确
- 检查 GitHub Release 中是否存在 `latest.json`
- 确保应用有互联网连接

### 签名验证失败

- 验证 `tauri.conf.json` 中的公钥是否与用于签名的私钥匹配
- 确保在构建过程中私钥可用
- 检查 CI/CD 中的 `TAURI_SIGNING_PRIVATE_KEY` 是否设置正确

### 更新下载失败

- 检查 GitHub Release 资源是否公开可访问
- 验证 `latest.json` 中的下载 URL 是否正确
- 确保有足够的磁盘空间用于更新

## 安全考虑

1. **始终签名生产版本**以防止篡改
2. **使用 HTTPS** 作为更新端点
3. **保护私钥安全** - 永远不要将其提交到版本控制
4. **轮换密钥**（如果泄露）
5. **在生产发布前在暂存环境中测试更新**

## 禁用自动更新

要禁用自动更新，在 `tauri.conf.json` 中设置 `active: false`：

```json
{
  "plugins": {
    "updater": {
      "active": false
    }
  }
}
```

## 参考资料

- [Tauri Updater 插件文档](https://v2.tauri.app/plugin/updater/)
- [Tauri 签名指南](https://v2.tauri.app/distribute/sign/)
- [GitHub Releases 文档](https://docs.github.com/en/repositories/releasing-projects-on-github)
