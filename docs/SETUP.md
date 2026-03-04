# Environment Setup Guide

> Language: **English** · [中文](SETUP.zh-CN.md)

This document walks through every prerequisite needed to build and develop Refinex Terminal from source on macOS (Apple Silicon primary) and Windows.

---

## macOS (Apple Silicon / ARM)

### 1. Xcode Command Line Tools

Required for C/C++ compilation (used by Rust, native addons, and system libraries).

```bash
xcode-select --install
```

Verify:

```bash
xcode-select -p
# Expected: /Library/Developer/CommandLineTools
```

### 2. Homebrew

Package manager for macOS. Install if not present:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

After installation, add Homebrew to your PATH (Apple Silicon default path):

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

Verify:

```bash
brew --version
```

### 3. Rust (via rustup)

Refinex Terminal's backend is written in Rust. Install the official toolchain manager:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Select option 1 (default installation). Then reload your shell:

```bash
source "$HOME/.cargo/env"
```

Verify the installation and ensure you're on stable 1.82+:

```bash
rustc --version
# Expected: rustc 1.82.x or higher

cargo --version
```

Add the macOS ARM target (should be the default on Apple Silicon):

```bash
rustup target list --installed
# Should include: aarch64-apple-darwin
```

### 4. Node.js (via fnm)

We recommend `fnm` (Fast Node Manager) for managing Node.js versions:

```bash
brew install fnm
```

Add fnm to your shell profile:

```bash
# For zsh (default on macOS):
echo 'eval "$(fnm env --use-on-cd --shell zsh)"' >> ~/.zshrc
source ~/.zshrc
```

Install Node.js 20 LTS:

```bash
fnm install 20
fnm use 20
fnm default 20
```

Verify:

```bash
node --version
# Expected: v20.x.x

npm --version
```

### 5. pnpm

Enable corepack (ships with Node.js) and activate pnpm:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

Verify:

```bash
pnpm --version
# Expected: 9.x or higher
```

### 6. Git

macOS ships with Git via Xcode Command Line Tools, but you may want a newer version:

```bash
brew install git
```

Verify:

```bash
git --version
# Expected: git version 2.40+ (2.44+ recommended)
```

Configure Git identity (if not already set):

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

### 7. Tauri 2 System Dependencies

Tauri on macOS primarily needs the Xcode CLT (already installed) and Rust (already installed). No additional system libraries are required — macOS ships with WebKit (WebView) natively.

Verify Tauri CLI is available via npx:

```bash
pnpm dlx @tauri-apps/cli info
```

This command prints your system info and confirms Tauri prerequisites are met.

### 8. (Optional) Additional Tools

These are not required but recommended for development:

```bash
# Rust analyzer for IDE support
rustup component add rust-analyzer

# Clippy for Rust linting
rustup component add clippy

# Rust formatter
rustup component add rustfmt

# cargo-watch for auto-rebuild during Rust development
cargo install cargo-watch

# sccache for faster Rust compilation (caches compiled artifacts)
brew install sccache
echo 'export RUSTC_WRAPPER=sccache' >> ~/.zshrc
```

---

## Windows

### 1. Visual Studio Build Tools

Rust on Windows requires the MSVC C++ build tools. Download and install:

**Visual Studio Build Tools 2022**: https://visualstudio.microsoft.com/visual-cpp-build-tools/

During installation, select the following workload:

- **Desktop development with C++**

Under "Individual components", ensure these are checked:

- MSVC v143 (or latest) — C++ build tools (ARM64/x64)
- Windows 11 SDK (latest)
- C++ CMake tools for Windows

### 2. WebView2 Runtime

Tauri on Windows uses Microsoft Edge WebView2. It's pre-installed on Windows 10 (1809+) and Windows 11. If missing, download:

https://developer.microsoft.com/en-us/microsoft-edge/webview2/

Verify it's installed by checking `Add or Remove Programs` for "Microsoft Edge WebView2 Runtime".

### 3. Rust (via rustup)

Download and run the rustup installer:

https://rustup.rs/

During installation:

- Select option 1 (default)
- The installer will detect MSVC and configure accordingly

Open a **new** terminal (PowerShell or Windows Terminal) and verify:

```powershell
rustc --version
cargo --version
```

### 4. Node.js (via fnm)

Install fnm using the official Windows installer:

```powershell
# Using winget (recommended)
winget install Schniz.fnm
```

Or using PowerShell:

```powershell
# Add fnm to your PowerShell profile
fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression
```

Install Node.js:

```powershell
fnm install 20
fnm use 20
fnm default 20
```

Verify:

```powershell
node --version
npm --version
```

### 5. pnpm

```powershell
corepack enable
corepack prepare pnpm@latest --activate
```

Verify:

```powershell
pnpm --version
```

### 6. Git for Windows

Download and install: https://git-scm.com/download/win

During installation:

- Choose "Git from the command line and also from 3rd-party software"
- Choose "Checkout as-is, commit Unix-style line endings" (recommended for cross-platform)
- Choose "Use Windows' default console window" or "Use Windows Terminal" if available

Verify:

```powershell
git --version
```

### 7. (Optional) Windows Terminal

For the best development experience on Windows, install Windows Terminal:

```powershell
winget install Microsoft.WindowsTerminal
```

### 8. (Optional) Additional Tools

```powershell
# Rust analyzer, clippy, rustfmt
rustup component add rust-analyzer clippy rustfmt

# cargo-watch
cargo install cargo-watch
```

---

## Clone and First Build

Once all prerequisites are installed on your platform:

```bash
# Clone the repository
git clone https://github.com/refinex-lab/refinex-terminal.git
cd refinex-terminal

# Install frontend dependencies
pnpm install

# Verify the Tauri setup
pnpm dlx @tauri-apps/cli info

# Run in development mode
pnpm tauri dev
```

The first build will take 3–5 minutes as Rust compiles all dependencies. Subsequent builds (with incremental compilation) are much faster (10–30 seconds).

If `pnpm tauri dev` succeeds and an application window opens with a terminal, your environment is correctly set up.

---

## Troubleshooting

### macOS: "xcrun: error: invalid active developer path"

Re-install Xcode Command Line Tools:

```bash
sudo rm -rf /Library/Developer/CommandLineTools
xcode-select --install
```

### macOS: Rust compilation error about missing `cc`

Ensure Xcode CLT is installed and the license is accepted:

```bash
sudo xcodebuild -license accept
```

### Windows: "LINK : fatal error LNK1181: cannot open input file 'advapi32.lib'"

The Windows SDK is not installed. Re-run Visual Studio Build Tools installer and ensure "Windows 11 SDK" is checked under Desktop C++ workload.

### Windows: WebView2 not found

Download and install the WebView2 Evergreen Runtime from: https://developer.microsoft.com/en-us/microsoft-edge/webview2/

### Both platforms: "error: failed to run custom build command for `portable-pty`"

Ensure you have a C compiler available. On macOS, reinstall Xcode CLT. On Windows, ensure Visual Studio Build Tools with MSVC are installed.

### pnpm: "ERR_PNPM_NO_MATCHING_VERSION"

Clear the pnpm cache and retry:

```bash
pnpm store prune
pnpm install
```

### Tauri: "failed to get webview2 version"

On Windows, this means WebView2 is not installed. Install it from the link above.

---

## Recommended IDE Setup

**VS Code** (or Cursor) with these extensions:

- `rust-analyzer` — Rust language support
- `Tauri` — Tauri framework support
- `ESLint` — JavaScript/TypeScript linting
- `Tailwind CSS IntelliSense` — Tailwind class autocomplete
- `Pretty TypeScript Errors` — Readable TS errors

**VS Code settings** (`.vscode/settings.json`):

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[rust]": {
    "editor.defaultFormatter": "rust-lang.rust-analyzer",
    "editor.formatOnSave": true
  },
  "rust-analyzer.check.command": "clippy",
  "typescript.preferences.importModuleSpecifier": "non-relative"
}
```
