# Auto-Updater Setup Guide

This document explains how to configure the Tauri auto-updater for Refinex Terminal.

## Overview

The auto-updater is configured to check GitHub Releases for new versions. When a new version is available, users will see a non-intrusive notification in the bottom-right corner of the app.

## Configuration

### 1. Generate Signing Keys (Optional but Recommended)

For production releases, you should sign your updates to ensure authenticity:

```bash
# Install Tauri CLI if not already installed
cargo install tauri-cli

# Generate a new keypair
cargo tauri signer generate -w ~/.tauri/myapp.key

# This will output:
# - Private key saved to: ~/.tauri/myapp.key
# - Public key: <your-public-key>
```

**Important**: Keep the private key (`~/.tauri/myapp.key`) secure and never commit it to version control!

### 2. Update tauri.conf.json

Add the public key to `src-tauri/tauri.conf.json`:

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

### 3. Sign Releases in CI/CD

Update `.github/workflows/release.yml` to sign the release:

```yaml
- name: Build Tauri app
  env:
    TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
  run: pnpm tauri build
```

Add the private key to GitHub Secrets:
1. Go to your repository → Settings → Secrets and variables → Actions
2. Add `TAURI_SIGNING_PRIVATE_KEY` with the contents of `~/.tauri/myapp.key`
3. Add `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` if you set a password

## How It Works

### On App Launch

1. The app checks for updates in the background (non-blocking)
2. If an update is available, a notification appears in the bottom-right corner
3. The notification shows:
   - New version number
   - Release notes
   - "Update & Restart" button
   - Dismiss button

### Update Process

1. User clicks "Update & Restart"
2. The update is downloaded with a progress bar
3. Once downloaded, the app automatically restarts with the new version

### Manual Check

Users can manually check for updates via:
- Command Palette (`Cmd/Ctrl + Shift + P`) → "Check for Updates"
- Settings → About → "Check for Updates" button

## Testing

### Local Testing

1. Build a release version:
   ```bash
   pnpm tauri build
   ```

2. Create a test release on GitHub with a higher version number

3. Run the built app and verify the update notification appears

### CI/CD Testing

1. Create a test tag:
   ```bash
   git tag v0.1.1-test
   git push origin v0.1.1-test
   ```

2. The release workflow will automatically build and publish

3. Download and run the previous version to test the update flow

## Update Manifest

Tauri automatically generates a `latest.json` file during the build process. This file contains:

```json
{
  "version": "0.1.1",
  "notes": "Release notes from GitHub",
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

This file must be uploaded to the GitHub Release as `latest.json`.

## Troubleshooting

### Update Check Fails

- Verify the endpoint URL in `tauri.conf.json` is correct
- Check that `latest.json` exists in the GitHub Release
- Ensure the app has internet connectivity

### Signature Verification Fails

- Verify the public key in `tauri.conf.json` matches the private key used for signing
- Ensure the private key was available during the build process
- Check that `TAURI_SIGNING_PRIVATE_KEY` is set correctly in CI/CD

### Update Download Fails

- Check GitHub Release assets are publicly accessible
- Verify the download URLs in `latest.json` are correct
- Ensure sufficient disk space for the update

## Security Considerations

1. **Always sign releases** in production to prevent tampering
2. **Use HTTPS** for update endpoints
3. **Keep private keys secure** - never commit them to version control
4. **Rotate keys** if compromised
5. **Test updates** in a staging environment before production release

## Disabling Auto-Updates

To disable auto-updates, set `active: false` in `tauri.conf.json`:

```json
{
  "plugins": {
    "updater": {
      "active": false
    }
  }
}
```

## References

- [Tauri Updater Plugin Documentation](https://v2.tauri.app/plugin/updater/)
- [Tauri Signing Guide](https://v2.tauri.app/distribute/sign/)
- [GitHub Releases Documentation](https://docs.github.com/en/repositories/releasing-projects-on-github)
