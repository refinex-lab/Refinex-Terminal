# Windows Installer and Code Signing Guide

This document explains how to configure the Windows installer and code signing for Refinex Terminal.

## Overview

Refinex Terminal uses NSIS (Nullsoft Scriptable Install System) to create Windows installers. The installer includes:
- Start Menu shortcuts
- Explorer context menu integration ("Open Refinex Terminal here")
- PATH environment variable configuration
- Optional code signing for trusted installation

## Installer Features

### 1. Start Menu Integration

The installer automatically creates shortcuts in the Start Menu under "Refinex Terminal":
- Main application shortcut
- Uninstaller shortcut

Configuration in `tauri.conf.json`:
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

### 2. Explorer Context Menu

Right-click context menu entries are added to:
- **Folders**: Right-click any folder → "Open Refinex Terminal here"
- **Folder backgrounds**: Right-click empty space in Explorer → "Open Refinex Terminal here"
- **Drives**: Right-click any drive → "Open Refinex Terminal here"

Implementation:
- Registry entries in `src-tauri/installer/context-menu.reg`
- Automatic installation via NSIS hooks in `src-tauri/installer/installer-hooks.nsi`
- Automatic cleanup on uninstall

### 3. PATH Configuration

The installer adds the installation directory to the system PATH:
- **Per-user installation**: Adds to user PATH (HKCU)
- **System-wide installation**: Adds to system PATH (HKLM)
- Allows running `refinex-terminal` from any command prompt
- Automatically removed on uninstall

### 4. Installation Options

- **Installation directory**: User can choose (default: `%LOCALAPPDATA%\Programs\Refinex Terminal`)
- **Install mode**: Per-user (default) or system-wide
- **Start Menu folder**: Customizable
- **Desktop shortcut**: Optional (user choice during installation)

## Code Signing

### Why Sign?

Signed installers provide:
- ✅ No SmartScreen warnings
- ✅ Verified publisher identity
- ✅ Protection against tampering
- ✅ Professional appearance
- ✅ Higher user trust

### Obtaining a Code Signing Certificate

#### Option 1: Commercial Certificate Authority

Purchase from trusted CAs:
- **DigiCert** - $474/year (recommended)
- **Sectigo** - $299/year
- **GlobalSign** - $299/year

Requirements:
- Business verification (EV certificates require hardware token)
- Valid business registration
- 1-3 business days for verification

#### Option 2: Self-Signed Certificate (Testing Only)

For development/testing only (will show warnings to users):

```powershell
# Create self-signed certificate
$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject "CN=Refinex, O=Refinex, C=US" `
  -KeyAlgorithm RSA `
  -KeyLength 2048 `
  -Provider "Microsoft Enhanced RSA and AES Cryptographic Provider" `
  -KeyExportPolicy Exportable `
  -KeyUsage DigitalSignature `
  -CertStoreLocation "Cert:\CurrentUser\My"

# Export to PFX
$password = ConvertTo-SecureString -String "YourPassword" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "certificate.pfx" -Password $password

# Install to Trusted Root (for testing only!)
Import-Certificate -FilePath "certificate.cer" -CertStoreLocation "Cert:\LocalMachine\Root"
```

**Warning**: Self-signed certificates will trigger SmartScreen warnings for end users.

### Local Signing

#### Prerequisites

1. Install Windows SDK (includes `signtool.exe`)
2. Have your code signing certificate (.pfx file)

#### Sign the Installer

```powershell
# Set certificate path and password
$certPath = "path\to\certificate.pfx"
$certPassword = "your-password"

# Find the installer
$installer = Get-ChildItem -Path "src-tauri\target\release\bundle\nsis" -Filter "*.exe" | Select-Object -First 1

# Sign with timestamp
signtool sign `
  /f $certPath `
  /p $certPassword `
  /tr http://timestamp.digicert.com `
  /td sha256 `
  /fd sha256 `
  $installer.FullName

# Verify signature
signtool verify /pa /v $installer.FullName
```

#### Verify Signature

```powershell
# Check signature details
Get-AuthenticodeSignature "path\to\installer.exe" | Format-List *

# Verify with signtool
signtool verify /pa /v "path\to\installer.exe"
```

Expected output for signed installer:
```
SignerCertificate      : [Subject]
                           CN=Refinex, O=Refinex, C=US
                         [Issuer]
                           CN=DigiCert...
Status                 : Valid
StatusMessage          : Signature verified.
```

## CI/CD Integration

### GitHub Secrets Setup

Add these secrets for Windows code signing:

1. **WINDOWS_CERTIFICATE** (Optional)
   ```powershell
   # Export certificate to base64
   $bytes = [System.IO.File]::ReadAllBytes("certificate.pfx")
   $base64 = [Convert]::ToBase64String($bytes)
   $base64 | Set-Clipboard
   ```
   Paste the base64 string as the secret value.

2. **WINDOWS_CERTIFICATE_PASSWORD** (Optional)
   - Password for the .pfx certificate

### Workflow Behavior

The release workflow (`.github/workflows/release.yml`) will:

1. **If signing secrets are configured**:
   - Build the installer
   - Decode the certificate
   - Sign all `.msi` and `.exe` files with `signtool`
   - Use DigiCert timestamp server
   - Clean up certificate file

2. **If signing secrets are NOT configured**:
   - Build unsigned installer
   - Users will see SmartScreen warnings

## Unsigned Builds

### Building Unsigned

Simply build without setting certificate environment variables:

```bash
pnpm tauri build
```

The installer will work but show security warnings.

### User Experience (Unsigned)

When users run an unsigned installer:

1. **SmartScreen Warning**:
   ```
   Windows protected your PC
   Microsoft Defender SmartScreen prevented an unrecognized app from starting.
   ```

2. **Bypass Steps**:
   - Click "More info"
   - Click "Run anyway"
   - Installer proceeds normally

3. **Alternative**: Disable SmartScreen (not recommended)
   ```powershell
   # Temporarily disable (requires admin)
   Set-MpPreference -EnableNetworkProtection Disabled
   ```

### Documentation for Users

Include this in your README for unsigned builds:

```markdown
## Windows Installation (Unsigned Build)

This is an unsigned build. When you run the installer:

1. Windows SmartScreen will show a warning
2. Click "More info"
3. Click "Run anyway"
4. Follow the installation wizard

We're working on providing signed builds in the future.

**Note**: The application is safe to use. The warning appears because we don't have a code signing certificate yet.
```

## Testing

### Test Installation

1. **Clean VM**: Use a fresh Windows 10/11 VM
2. **Run installer**: Double-click the `.exe` file
3. **Verify**:
   - Application installs successfully
   - Start Menu shortcut works
   - Context menu entries appear
   - `refinex-terminal` command works in CMD/PowerShell
   - Application launches without errors

### Test Context Menu

```powershell
# Open any folder in Explorer
# Right-click → "Open Refinex Terminal here"
# Verify terminal opens in that directory
```

### Test PATH

```powershell
# Open new PowerShell window
refinex-terminal --version

# Should output version number
```

### Test Uninstallation

1. **Uninstall**: Start Menu → Refinex Terminal → Uninstall
2. **Verify cleanup**:
   - Application files removed
   - Start Menu shortcuts removed
   - Context menu entries removed
   - PATH entry removed
   - Registry entries cleaned up

```powershell
# Check if PATH is cleaned
$env:PATH -split ';' | Select-String "Refinex"

# Check if registry entries are removed
Get-Item "HKCR:\Directory\shell\RefinexTerminal" -ErrorAction SilentlyContinue
```

## Installer Configuration

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

### Custom NSIS Hooks

The `installer-hooks.nsi` file provides:
- Context menu registration
- PATH configuration
- Cleanup on uninstall

Key functions:
- `.onInstSuccess` - Runs after installation
- `un.onInit` - Runs before uninstallation

## Troubleshooting

### Installer Won't Run

**Error**: "Windows protected your PC"

**Solution**: This is expected for unsigned builds. Click "More info" → "Run anyway".

### Context Menu Not Appearing

**Cause**: Registry entries not created

**Solution**:
1. Run installer as administrator
2. Manually import registry file:
   ```powershell
   reg import "src-tauri\installer\context-menu.reg"
   ```

### PATH Not Updated

**Cause**: Environment variables not refreshed

**Solution**:
1. Close and reopen terminal
2. Or restart Explorer:
   ```powershell
   Stop-Process -Name explorer -Force
   ```

### Signing Fails in CI

**Error**: "SignTool Error: No certificates were found that met all the given criteria"

**Solution**:
1. Verify `WINDOWS_CERTIFICATE` is valid base64
2. Check `WINDOWS_CERTIFICATE_PASSWORD` is correct
3. Ensure certificate hasn't expired

### SmartScreen Still Shows Warning (Signed)

**Cause**: Certificate needs to build reputation

**Solution**:
- New certificates trigger warnings initially
- Reputation builds over time with downloads
- EV certificates bypass this (instant trust)

## Best Practices

1. **Use EV certificates** for immediate trust (no SmartScreen warnings)
2. **Timestamp signatures** to remain valid after certificate expires
3. **Test on clean VMs** before releasing
4. **Document unsigned experience** clearly for users
5. **Keep certificates secure** - never commit to version control
6. **Renew certificates** before expiration
7. **Use strong passwords** for certificate files

## Cost Considerations

- **Code Signing Certificate**: $299-$474/year
- **EV Certificate** (hardware token): $474-$599/year
- **Alternative**: Distribute unsigned builds with clear warnings

## References

- [Microsoft Code Signing](https://docs.microsoft.com/en-us/windows/win32/seccrypto/cryptography-tools)
- [NSIS Documentation](https://nsis.sourceforge.io/Docs/)
- [Tauri Windows Configuration](https://v2.tauri.app/reference/config/#windows)
- [SignTool Documentation](https://docs.microsoft.com/en-us/windows/win32/seccrypto/signtool)
- [SmartScreen Information](https://docs.microsoft.com/en-us/windows/security/threat-protection/microsoft-defender-smartscreen/microsoft-defender-smartscreen-overview)

## Quick Reference

### Sign Installer Locally

```powershell
signtool sign /f certificate.pfx /p password /tr http://timestamp.digicert.com /td sha256 /fd sha256 installer.exe
```

### Verify Signature

```powershell
signtool verify /pa /v installer.exe
```

### Export Certificate for CI

```powershell
$bytes = [System.IO.File]::ReadAllBytes("certificate.pfx")
[Convert]::ToBase64String($bytes) | Set-Clipboard
```

### Test Context Menu

```powershell
# Add manually
reg import src-tauri\installer\context-menu.reg

# Remove manually
reg import src-tauri\installer\uninstall-context-menu.reg
```
