# macOS Code Signing and Notarization Guide

This document explains how to configure code signing and notarization for Refinex Terminal on macOS.

## Overview

macOS requires apps to be signed and notarized to run without Gatekeeper warnings. This guide covers:
- Code signing with a Developer ID certificate
- Notarization with Apple's notary service
- CI/CD integration for automated signing
- Handling unsigned builds for open-source development

## Prerequisites

### For Signed Builds

1. **Apple Developer Account** ($99/year)
   - Enroll at https://developer.apple.com/programs/

2. **Developer ID Application Certificate**
   - Log in to https://developer.apple.com/account/
   - Go to Certificates, Identifiers & Profiles
   - Create a new "Developer ID Application" certificate
   - Download and install in Keychain Access

3. **App-Specific Password**
   - Go to https://appleid.apple.com/account/manage
   - Generate an app-specific password for notarization

## Configuration

### 1. Update tauri.conf.json

The configuration is already set up in `src-tauri/tauri.conf.json`:

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

**Note**: `signingIdentity: null` means Tauri will auto-detect the certificate from your keychain.

### 2. Local Signing (Development)

To sign locally during development:

```bash
# Set environment variables
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAM_ID)"

# Build with signing
pnpm tauri build
```

Tauri will automatically:
1. Find the certificate in your keychain
2. Sign the `.app` bundle
3. Create a signed `.dmg`

### 3. Notarization (Local)

After building, notarize the app:

```bash
# Set credentials
export APPLE_ID="your@email.com"
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # App-specific password
export APPLE_TEAM_ID="XXXXXXXXXX"

# Find the app bundle
APP_PATH="src-tauri/target/release/bundle/macos/Refinex Terminal.app"

# Create zip for notarization
ditto -c -k --keepParent "$APP_PATH" "$APP_PATH.zip"

# Submit for notarization
xcrun notarytool submit "$APP_PATH.zip" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait

# Staple the notarization ticket
xcrun stapler staple "$APP_PATH"

# Verify
spctl -a -vvv -t install "$APP_PATH"
```

## CI/CD Integration

### GitHub Secrets Setup

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

1. **APPLE_CERTIFICATE** (Required for signing)
   ```bash
   # Export certificate from Keychain as .p12
   # Then encode to base64
   base64 -i certificate.p12 | pbcopy
   ```
   Paste the base64 string as the secret value.

2. **APPLE_CERTIFICATE_PASSWORD** (Required)
   - Password you set when exporting the .p12 certificate

3. **KEYCHAIN_PASSWORD** (Required)
   - Any secure password for the temporary keychain (e.g., generate with `openssl rand -base64 32`)

4. **APPLE_SIGNING_IDENTITY** (Required)
   - Your signing identity name, e.g., `"Developer ID Application: Your Name (TEAM_ID)"`
   - Find it with: `security find-identity -v -p codesigning`

5. **APPLE_ID** (Required for notarization)
   - Your Apple ID email

6. **APPLE_PASSWORD** (Required for notarization)
   - App-specific password from https://appleid.apple.com/account/manage

7. **APPLE_TEAM_ID** (Required for notarization)
   - Your 10-character Team ID
   - Find it at https://developer.apple.com/account/ (Membership section)

8. **TAURI_SIGNING_PRIVATE_KEY** (Optional, for update signing)
   - Private key for Tauri updater (see AUTO_UPDATER.md)

9. **TAURI_SIGNING_PRIVATE_KEY_PASSWORD** (Optional)
   - Password for the Tauri signing key

### Workflow Behavior

The release wor`.github/workflows/release.yml`) will:

1. **If secrets are configured**:
   - Import the certificate into a temporary keychain
   - Build and sign the app with your Developer ID
   - Submit the app for notarization
   - Wait for notarization to complete
   - Staple the notarization ticket to the app
   - Create a signed, notarized `.dmg`

2. **If secrets are NOT configured**:
   - Build an unsigned app
   - Users will need to right-click → Open on first launch

## Unsigned Builds (Open Source)

For open-source development without a paid Apple Developer account:

### Building Unsigned

Simply build without setting any signing environment variables:

```bash
pnpm tauri build
```

The app will be unsigned but fully functional.

### Installing Unsigned Apps

Users must bypass Gatekeeper on first launch:

1. **Method 1: Right-click → Open**
   - Locate the app in Finder
   - Right-click (or Control-click) the app
   - Select "Open" from the menu
   - Click "Open" in the dialog

2. **Method 2: System Settings**
   - Try to open the app normally (it will be blocked)
   - Go to System Settings → Privacy & Security
   - Click "Open Anyway" next to the blocked app message
   - Click "Open" in the confirmation dialog

3. **Method 3: Remove quarantine attribute**
   ```bash
   xattr -d com.apple.quarantine "/Applications/Refinex Terminal.app"
   ```

### Documentation for Users

Include this in your README for unsigned builds:

```markdown
## macOS Installation (Unsigned Build)

This is an unsigned build. On first launch:

1. Right-click the app and select "Open"
2. Click "Open" in the security dialog
3. The app will open and remember this choice

Alternatively, run:
```bash
xattr -d com.apple.quarantine "/Applications/Refinex Terminal.app"
```

We're working on proving signed builds in the future.
```

## Verification

### Verify Code Signature

```bash
# Check if app is signed
codesign -dv --verbose=4 "Refinex Terminal.app"

# Verify signature
codesign --verify --deep --strict --verbose=2 "Refinex Terminal.app"

# Check Gatekeeper assessment
spctl -a -vvv -t install "Refinex Terminal.app"
```

Expected output for signed app:
```
Refinex Terminal.app: accepted
source=Notarized Developer ID
```

### Verify Notarization

```bash
# Check notarization ticket
stapler validate "Refinex Terminal.app"

# Check extended attributes
xattr -l "Refinex Terminal.app"
```

Expected output:
```
Processing: Refinex Terminal.app
The validate action worked!
```

## Troubleshooting

### Certificate Not Found

**Error**: `No signing identity found`

**Solution**:
1. Verify certificate is installed: `security find-identity -v -p codesigning`
2. Ensure certificate is valid (not expired)
3. Check that `APPLE_SIGNING_IDENTITY` matches exactly

### Notarization Failed

**Error**: `The software asset has not been notarized`

**Common causes**:
1. **Hardened Runtime not enabled** - Tauri enables this by default
2. **Invalid entitlements** - Check `tauri.conf.json` entitlements
3. **Unsigned dependencies** - All embedded frameworks must be signed

**Check notarization log**:
```bash
xcrun notarytool log <submission-id> \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID"
```

### Gatekeeper Still Blocks App

**Error**: `"Refinex Terminal" cannot be opened because the developer cannot be verified`

**Solutions**:
1. Verify notarization: `stapler validate "Refinex Terminal.app"`
2. Check if ticket is stapled: `xcrun stapler validate "Refinex Terminal.app"`
3. Re-download the app (Safari may add quarantine attribute)
4. Remove quarantine: `xattr -d com.apple.quarantine "Refinex Terminal.app"`

### CI Build Fails

**Error**: `security: SecKeychainItemImport: The specified item already exists in the keychain`

**Solution**: The keychain cleanup step failed in a previous run. This is handled by the `always()` condition in the workflow.

**Error**: `xcrun: error: unable to find utility "notarytool"`

**Solution**: Ensure Xcode Command Line Tools are installed:
```bash
xcode-select --install
```

## Best Practices

1. **Never commit certificates or passwords** to version control
2. **Use app-specific passwords** for notarization (not your main Apple ID password)
3. **Rotate certificates** before they expire (check expiration with `security find-identity`)
4. **Test signed builds** on a clean macOS system before release
5. **Monitor notarization** - Apple may reject apps for policy violations
6. **Keep Xcode updated** - notarytool requires recent Xcode versions

## Cost Considerations

- **Apple Developer Program**: $99/year (required for signing and notarization)
- **Alternative**: Distribute unsigned builds with clear installation instructions
- **Open Source**: Consider applying for a free Apple Developer account (limited features)

## References

- [Apple Code Signing Guide](https://developer.apple.com/support/code-signing/)
- [Notarizing macOS Software](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Tauri macOS Signing](https://v2.tauri.app/distribute/sign/macos/)
- [notarytool Documentation](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution/customizing_the_notarization_workflow)

## Quick Reference

### Export Certificate for CI

```bash
# Find your certificate
security find-identity -v -p codesigning

# Export as .p12 (you'll be prompted for a password)
security export -k ~/Library/Keychains/login.keychain-db \
  -t identities \
  -f pkcs12 \
  -o certificate.p12

# Encode to base64 for GitHub Secrets
base64 -i certificate.p12 | pbcopy

# Clean up
rm certificate.p12
```

### Test Notarization Locally

```bash
# Quick test script
./scripts/notarize.sh "src-tauri/target/release/bundle/macos/Refinex Terminal.app"
```

Create `scripts/notarize.sh`:
```bash
#!/bin/bash
set -e

APP_PATH="$1"
ZIP_PATH="$APP_PATH.zip"

echo "Creating archive..."
ditto -c -k --keepParent "$APP_PATH" "$ZIP_PATH"

echo "Submitting for notarization..."
xcrun notarytool submit "$ZIP_PATH" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait

echo "Stapling ticket..."
xcrun stapler staple "$APP_PATH"

echo "Verifying..."
spctl -a -vvv -t install "$APP_PATH"

echo "Done! App is signed and notarized."
rm "$ZIP_PATH"
```
