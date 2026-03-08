# macOS 代码签名和公证指南

本文档说明如何为 Refinex Terminal 在 macOS 上配置代码签名和公证。

## 概述

macOS 要求应用程序经过签名和公证才能在没有 Gatekeeper 警告的情况下运行。本指南涵盖：
- 使用 Developer ID 证书进行代码签名
- 使用 Apple 公证服务进行公证
- CI/CD 集成以实现自动签名
- 处理开源开发的未签名构建

## 前提条件

### 对于签名构建

1. **Apple Developer 账户**（$99/年）
   - 在 https://developer.apple.com/programs/ 注册

2. **Developer ID Application 证书**
   - 登录 https://developer.apple.com/account/
   - 转到 Certificates, Identifiers & Profiles
   - 创建新的"Developer ID Application"证书
   - 下载并安装到钥匙串访问

3. **应用专用密码**
   - 转到 https://appleid.apple.com/account/manage
   - 为公证生成应用专用密码

## 配置

### 1. 更新 tauri.conf.json

配置已在 `src-tauri/tauri.conf.json` 中设置：

```json
{
  "bundle": {
    "macOS": {
      "signingIdentity": null,
      "providerShortName": null,
      "entitlements": null,
      "exceptionDomain": null,
      "minimumSystemVersion": "10.15"
    }
  }
}
```

**注意**：`signingIdentity: null` 表示 Tauri 将从您的钥匙串自动检测证书。

### 2. 本地签名（开发）

在开发期间本地签名：

```bash
# 设置环境变量
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAM_ID)"

# 使用签名构建
pnpm tauri build
```

Tauri 将自动：
1. 在您的钥匙串中查找证书
2. 签名 `.app` 包
3. 创建签名的 `.dmg`

### 3. 公证（本地）

构建后，公证应用：

```bash
# 设置凭据
export APPLE_ID="your@email.com"
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # 应用专用密码
export APPLE_TEAM_ID="XXXXXXXXXX"

# 查找应用包
APP_PATH="src-tauri/target/release/bundle/macos/Refinex Terminal.app"

# 为公证创建 zip
ditto -c -k --keepParent "$APP_PATH" "$APP_PATH.zip"

# 提交公证
xcrun notarytool submit "$APP_PATH.zip" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait

# 装订公证票据
xcrun stapler staple "$APP_PATH"

# 验证
spctl -a -vvv -t install "$APP_PATH"
```

## CI/CD 集成

### GitHub Secrets 设置

将这些 secrets 添加到您的 GitHub 仓库（Settings → Secrets and variables → Actions）：

1. **APPLE_CERTIFICATE**（签名必需）
   ```bash
   # 从钥匙串导出证书为 .p12
   # 然后编码为 base64
   base64 -i certificate.p12 | pbcopy
   ```
   将 base64 字符串粘贴为 secret 值。

2. **APPLE_CERTIFICATE_PASSWORD**（必需）
   - 导出 .p12 证书时设置的密码

3. **KEYCHAIN_PASSWORD**（必需）
   - 临时钥匙串的任何安全密码（例如，使用 `openssl rand -base64 32` 生成）

4. **APPLE_SIGNING_IDENTITY**（必需）
   - 您的签名身份名称，例如 `"Developer ID Application: Your Name (TEAM_ID)"`
   - 使用以下命令查找：`security find-identity -v -p codesigning`

5. **APPLE_ID**（公证必需）
   - 您的 Apple ID 电子邮件

6. **APPLE_PASSWORD**（公证必需）
   - 来自 https://appleid.apple.com/account/manage 的应用专用密码

7. **APPLE_TEAM_ID**（公证必需）
   - 您的 10 字符 Team ID
   - 在 https://developer.apple.com/account/（Membership 部分）查找

8. **TAURI_SIGNING_PRIVATE_KEY**（可选，用于更新签名）
   - Tauri 更新器的私钥（参见 AUTO_UPDATER.md）

9. **TAURI_SIGNING_PRIVATE_KEY_PASSWORD**（可选）
   - Tauri 签名密钥的密码

### 工作流行为

发布工作流（`.github/workflows/release.yml`）将：

1. **如果配置了 secrets**：
   - 将证书导入临时钥匙串
   - 使用您的 Developer ID 构建并签名应用
   - 提交应用进行公证
   - 等待公证完成
   - 将公证票据装订到应用
   - 创建签名、公证的 `.dmg`

2. **如果未配置 secrets**：
   - 构建未签名的应用
   - 用户首次启动时需要右键点击 → 打开

## 未签名构建（开源）

对于没有付费 Apple Developer 账户的开源开发：

### 构建未签名

只需在不设置任何签名环境变量的情况下构建：

```bash
pnpm tauri build
```

应用将是未签名的但完全可用。

### 安装未签名应用

用户必须在首次启动时绕过 Gatekeeper：

1. **方法 1：右键点击 → 打开**
   - 在 Finder 中找到应用
   - 右键点击（或 Control-点击）应用
   - 从菜单中选择"打开"
   - 在对话框中点击"打开"

2. **方法 2：系统设置**
   - 尝试正常打开应用（将被阻止）
   - 转到系统设置 → 隐私与安全性
   - 点击被阻止应用消息旁边的"仍要打开"
   - 在确认对话框中点击"打开"

3. **方法 3：移除隔离属性**
   ```bash
   xattr -d com.apple.quarantine "/Applications/Refinex Terminal.app"
   ```

### 用户文档

在 README 中为未签名构建包含此内容：

```markdown
## macOS 安装（未签名构建）

这是未签名构建。首次启动时：

1. 右键点击应用并选择"打开"
2. 在安全对话框中点击"打开"
3. 应用将打开并记住此选择

或者，运行：
```bash
xattr -d com.apple.quarantine "/Applications/Refinex Terminal.app"
```

我们正在努力在未来提供签名构建。
```

## 验证

### 验证代码签名

```bash
# 检查应用是否已签名
codesign -dv --verbose=4 "Refinex Terminal.app"

# 验证签名
codesign --verify --deep --strict --verbose=2 "Refinex Terminal.app"

# 检查 Gatekeeper 评估
spctl -a -vvv -t install "Refinex Terminal.app"
```

签名应用的预期输出：
```
Refinex Terminal.app: accepted
source=Notarized Developer ID
```

### 验证公证

```bash
# 检查公证票据
stapler validate "Refinex Terminal.app"

# 检查扩展属性
xattr -l "Refinex Terminal.app"
```

预期输出：
```
Processing: Refinex Terminal.app
The validate action worked!
```

## 故障排除

### 找不到证书

**错误**：`No signing identity found`

**解决方案**：
1. 验证证书已安装：`security find-identity -v -p codesigning`
2. 确保证书有效（未过期）
3. 检查 `APPLE_SIGNING_IDENTITY` 是否完全匹配

### 公证失败

**错误**：`The software asset has not been notarized`

**常见原因**：
1. **未启用强化运行时** - Tauri 默认启用此功能
2. **无效的权限** - 检查 `tauri.conf.json` 权限
3. **未签名的依赖项** - 所有嵌入的框架都必须签名

**检查公证日志**：
```bash
xcrun notarytool log <submission-id> \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID"
```

### Gatekeeper 仍然阻止应用

**错误**：`"Refinex Terminal" 无法打开，因为无法验证开发者`

**解决方案**：
1. 验证公证：`stapler validate "Refinex Terminal.app"`
2. 检查票据是否已装订：`xcrun stapler validate "Refinex Terminal.app"`
3. 重新下载应用（Safari 可能添加隔离属性）
4. 移除隔离：`xattr -d com.apple.quarantine "Refinex Terminal.app"`

### CI 构建失败

**错误**：`security: SecKeychainItemImport: The specified item already exists in the keychain`

**解决方案**：上一次运行中的钥匙串清理步骤失败。这由工作流中的 `always()` 条件处理。

**错误**：`xcrun: error: unable to find utility "notarytool"`

**解决方案**：确保安装了 Xcode 命令行工具：
```bash
xcode-select --install
```

## 最佳实践

1. **永远不要将证书或密码提交**到版本控制
2. **使用应用专用密码**进行公证（而不是您的主 Apple ID 密码）
3. **在证书过期前轮换证书**（使用 `security find-identity` 检查过期时间）
4. **在发布前在干净的 macOS 系统上测试签名构建**
5. **监控公证** - Apple 可能因政策违规而拒绝应用
6. **保持 Xcode 更新** - notarytool 需要最新的 Xcode 版本

## 成本考虑

- **Apple Developer Program**：$99/年（签名和公证必需）
- **替代方案**：分发带有明确安装说明的未签名构建
- **开源**：考虑申请免费的 Apple Developer 账户（功能有限）

## 参考资料

- [Apple 代码签名指南](https://developer.apple.com/support/code-signing/)
- [公证 macOS 软件](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Tauri macOS 签名](https://v2.tauri.app/distribute/sign/macos/)
- [notarytool 文档](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution/customizing_the_notarization_workflow)

## 快速参考

### 导出证书用于 CI

```bash
# 查找您的证书
security find-identity -v -p codesigning

# 导出为 .p12（将提示输入密码）
security export -k ~/Library/Keychains/login.keychain-db \
  -t identities \
  -f pkcs12 \
  -o certificate.p12

# 编码为 base64 用于 GitHub Secrets
base64 -i certificate.p12 | pbcopy

# 清理
rm certificate.p12
```

### 本地测试公证

```bash
# 快速测试脚本
./scripts/notarize.sh "src-tauri/target/release/bundle/macos/Refinex Terminal.app"
```

创建 `scripts/notarize.sh`：
```bash
#!/bin/bash
set -e

APP_PATH="$1"
ZIP_PATH="$APP_PATH.zip"

echo "创建归档..."
ditto -c -k --keepParent "$APP_PATH" "$ZIP_PATH"

echo "提交公证..."
xcrun notarytool submit "$ZIP_PATH" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait

echo "装订票据..."
xcrun stapler staple "$APP_PATH"

echo "验证..."
spctl -a -vvv -t install "$APP_PATH"

echo "完成！应用已签名并公证。"
rm "$ZIP_PATH"
```
