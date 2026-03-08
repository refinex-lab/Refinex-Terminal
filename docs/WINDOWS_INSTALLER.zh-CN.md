# Windows 安装程序和代码签名指南

本文档说明如何为 Refinex Terminal 配置 Windows 安装程序和代码签名。

## 概述

Refinex Terminal 使用 NSIS（Nullsoft Scriptable Install System）创建 Windows 安装程序。安装程序包括：
- 开始菜单快捷方式
- 资源管理器右键菜单集成（"在此处打开 Refinex Terminal"）
- PATH 环境变量配置
- 可选的代码签名以实现可信安装

## 安装程序功能

### 1. 开始菜单集成

安装程序自动在"Refinex Terminal"下的开始菜单中创建快捷方式：
- 主应用程序快捷方式
- 卸载程序快捷方式

`tauri.conf.json` 中的配置：
```json
{
  "bundle": {
    "windows": {
      "nsis": {
        "startMenuFolder": "Refinex Terminal"
      }
    }
  }
}
```

### 2. 资源管理器右键菜单

右键菜单条目添加到：
- **文件夹**：右键点击任何文件夹 → "在此处打开 Refinex Terminal"
- **文件夹背景**：在资源管理器中右键点击空白处 → "在此处打开 Refinex Terminal"
- **驱动器**：右键点击任何驱动器 → "在此处打开 Refinex Terminal"

实现：
- `src-tauri/installer/context-menu.reg` 中的注册表条目
- 通过 `src-tauri/installer/installer-hooks.nsi` 中的 NSIS 钩子自动安装
- 卸载时自动清理

### 3. PATH 配置

安装程序将安装目录添加到系统 PATH：
- **单用户安装**：添加到用户 PATH（HKCU）
- **系统范围安装**：添加到系统 PATH（HKLM）
- 允许从任何命令提示符运行 `refinex-terminal`
- 卸载时自动删除

### 4. 安装选项

- **安装目录**：用户可以选择（默认：`%LOCALAPPDATA%\Programs\Refinex Terminal`）
- **安装模式**：单用户（默认）或系统范围
- **开始菜单文件夹**：可自定义
- **桌面快捷方式**：可选（安装期间用户选择）

## 代码签名

### 为什么要签名？

签名的安装程序提供：
- ✅ 无 SmartScreen 警告
- ✅ 验证的发布者身份
- ✅ 防止篡改
- ✅ 专业外观
- ✅ 更高的用户信任

### 获取代码签名证书

#### 选项 1：商业证书颁发机构

从受信任的 CA 购买：
- **DigiCert** - $474/年（推荐）
- **Sectigo** - $299/年
- **GlobalSign** - $299/年

要求：
- 业务验证（EV 证书需要硬件令牌）
- 有效的业务注册
- 验证需要 1-3 个工作日

#### 选项 2：自签名证书（仅用于测试）

仅用于开发/测试（将向用户显示警告）：

```powershell
# 创建自签名证书
$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject "CN=Refinex, O=Refinex, C=US" `
  -KeyAlgorithm RSA `
  -KeyLength 2048 `
  -Provider "Microsoft Enhanced RSA and AES Cryptographic Provider" `
  -KeyExportPolicy Exportable `
  -KeyUsage DigitalSignature `
  -CertStoreLocation "Cert:\CurrentUser\My"

# 导出为 PFX
$password = ConvertTo-SecureString -String "YourPassword" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "certificate.pfx" -Password $password

# 安装到受信任的根（仅用于测试！）
Import-Certificate -FilePath "certificate.cer" -CertStoreLocation "Cert:\LocalMachine\Root"
```

**警告**：自签名证书将为最终用户触发 SmartScreen 警告。

### 本地签名

#### 前提条件

1. 安装 Windows SDK（包括 `signtool.exe`）
2. 拥有您的代码签名证书（.pfx 文件）

#### 签名安装程序

```powershell
# 设置证书路径和密码
$certPath = "path\to\certificate.pfx"
$certPassword = "your-password"

# 查找安装程序
$installer = Get-ChildItem -Path "src-tauri\target\release\bundle\nsis" -Filter "*.exe" | Select-Object -First 1

# 使用时间戳签名
signtool sign `
  /f $certPath `
  /p $certPassword `
  /tr http://timestamp.digicert.com `
  /td sha256 `
  /fd sha256 `
  $installer.FullName

# 验证签名
signtool verify /pa /v $installer.FullName
```

#### 验证签名

```powershell
# 检查签名详细信息
Get-AuthenticodeSignature "path\to\installer.exe" | Format-List *

# 使用 signtool 验证
signtool verify /pa /v "path\to\installer.exe"
```

签名安装程序的预期输出：
```
SignerCertificate      : [Subject]
                           CN=Refinex, O=Refinex, C=US
                         [Issuer]
                           CN=DigiCert...
Status                 : Valid
StatusMessage          : Signature verified.
```

## CI/CD 集成

### GitHub Secrets 设置

为 Windows 代码签名添加这些 secrets：

1. **WINDOWS_CERTIFICATE**（可选）
   ```powershell
   # 将证书导出为 base64
   $bytes = [System.IO.File]::ReadAllBytes("certificate.pfx")
   $base64 = [Convert]::ToBase64String($bytes)
   $base64 | Set-Clipboard
   ```
   将 base64 字符串粘贴为 secret 值。

2. **WINDOWS_CERTIFICATE_PASSWORD**（可选）
   - .pfx 证书的密码

### 工作流行为

发布工作流（`.github/workflows/release.yml`）将：

1. **如果配置了签名 secrets**：
   - 构建安装程序
   - 解码证书
   - 使用 `signtool` 签名所有 `.msi` 和 `.exe` 文件
   - 使用 DigiCert 时间戳服务器
   - 清理证书文件

2. **如果未配置签名 secrets**：
   - 构建未签名的安装程序
   - 用户将看到 SmartScreen 警告

## 未签名构建

### 构建未签名

只需在不设置证书环境变量的情况下构建：

```bash
pnpm tauri build
```

安装程序将正常工作但会显示安全警告。

### 用户体验（未签名）

当用户运行未签名的安装程序时：

1. **SmartScreen 警告**：
   ```
   Windows 保护了你的电脑
   Microsoft Defender SmartScreen 阻止了一个无法识别的应用启动。
   ```

2. **绕过步骤**：
   - 点击"更多信息"
   - 点击"仍要运行"
   - 安装程序正常进行

3. **替代方案**：禁用 SmartScreen（不推荐）
   ```powershell
   # 临时禁用（需要管理员权限）
   Set-MpPreference -EnableNetworkProtection Disabled
   ```

### 用户文档

在 README 中为未签名构建包含此内容：

```markdown
## Windows 安装（未签名构建）

这是未签名构建。运行安装程序时：

1. Windows SmartScreen 将显示警告
2. 点击"更多信息"
3. 点击"仍要运行"
4. 按照安装向导操作

我们正在努力在未来提供签名构建。

**注意**：应用程序使用安全。警告出现是因为我们还没有代码签名证书。
```

## 测试

### 测试安装

1. **干净的 VM**：使用全新的 Windows 10/11 VM
2. **运行安装程序**：双击 `.exe` 文件
3. **验证**：
   - 应用程序成功安装
   - 开始菜单快捷方式有效
   - 右键菜单条目出现
   - `refinex-terminal` 命令在 CMD/PowerShell 中有效
   - 应用程序启动无错误

### 测试右键菜单

```powershell
# 在资源管理器中打开任何文件夹
# 右键点击 → "在此处打开 Refinex Terminal"
# 验证终端在该目录中打开
```

### 测试 PATH

```powershell
# 打开新的 PowerShell 窗口
refinex-terminal --version

# 应输出版本号
```

### 测试卸载

1. **卸载**：开始菜单 → Refinex Terminal → 卸载
2. **验证清理**：
   - 应用程序文件已删除
   - 开始菜单快捷方式已删除
   - 右键菜单条目已删除
   - PATH 条目已删除
   - 注册表条目已清理

```powershell
# 检查 PATH 是否已清理
$env:PATH -split ';' | Select-String "Refinex"

# 检查注册表条目是否已删除
Get-Item "HKCR:\Directory\shell\RefinexTerminal" -ErrorAction SilentlyContinue
```

## 安装程序配置

### tauri.conf.json

```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": "",
      "nsis": {
        "installMode": "perUser",
        "languages": ["en-US"],
        "compression": "lzma",
        "startMenuFolder": "Refinex Terminal",
        "installerHooks": "installer/installer-hooks.nsi",
        "allowToChangeInstallationDirectory": true
      }
    }
  }
}
```

### 自定义 NSIS 钩子

`installer-hooks.nsi` 文件提供：
- 右键菜单注册
- PATH 配置
- 卸载时清理

关键函数：
- `.onInstSuccess` - 安装后运行
- `un.onInit` - 卸载前运行

## 故障排除

### 安装程序无法运行

**错误**："Windows 保护了你的电脑"

**解决方案**：这是未签名构建的预期行为。点击"更多信息" → "仍要运行"。

### 右键菜单未出现

**原因**：未创建注册表条目

**解决方案**：
1. 以管理员身份运行安装程序
2. 手动导入注册表文件：
   ```powershell
   reg import "src-tauri\installer\context-menu.reg"
   ```

### PATH 未更新

**原因**：环境变量未刷新

**解决方案**：
1. 关闭并重新打开终端
2. 或重启资源管理器：
   ```powershell
   Stop-Process -Name explorer -Force
   ```

### CI 中签名失败

**错误**："SignTool Error: No certificates were found that met all the given criteria"

**解决方案**：
1. 验证 `WINDOWS_CERTIFICATE` 是有效的 base64
2. 检查 `WINDOWS_CERTIFICATE_PASSWORD` 是否正确
3. 确保证书未过期

### SmartScreen 仍显示警告（已签名）

**原因**：证书需要建立声誉

**解决方案**：
- 新证书最初会触发警告
- 声誉随着下载量的增加而建立
- EV 证书绕过此问题（即时信任）

## 最佳实践

1. **使用 EV 证书**以获得即时信任（无 SmartScreen 警告）
2. **时间戳签名**以在证书过期后保持有效
3. **在干净的 VM 上测试**后再发布
4. **清楚地记录未签名体验**给用户
5. **保护证书安全** - 永远不要提交到版本控制
6. **在过期前续订证书**
7. **为证书文件使用强密码**

## 成本考虑

- **代码签名证书**：$299-$474/年
- **EV 证书**（硬件令牌）：$474-$599/年
- **替代方案**：分发带有明确警告的未签名构建

## 参考资料

- [Microsoft 代码签名](https://docs.microsoft.com/en-us/windows/win32/seccrypto/cryptography-tools)
- [NSIS 文档](https://nsis.sourceforge.io/Docs/)
- [Tauri Windows 配置](https://v2.tauri.app/reference/config/#windows)
- [SignTool 文档](https://docs.microsoft.com/en-us/windows/win32/seccrypto/signtool)
- [SmartScreen 信息](https://docs.microsoft.com/en-us/windows/security/threat-protection/microsoft-defender-smartscreen/microsoft-defender-smartscreen-overview)

## 快速参考

### 本地签名安装程序

```powershell
signtool sign /f certificate.pfx /p password /tr http://timestamp.digicert.com /td sha256 /fd sha256 installer.exe
```

### 验证签名

```powershell
signtool verify /pa /v installer.exe
```

### 导出证书用于 CI

```powershell
$bytes = [System.IO.File]::ReadAllBytes("certificate.pfx")
[Convert]::ToBase64String($bytes) | Set-Clipboard
```

### 测试右键菜单

```powershell
# 手动添加
reg import src-tauri\installer\context-menu.reg

# 手动删除
reg import src-tauri\installer\uninstall-context-menu.reg
```
