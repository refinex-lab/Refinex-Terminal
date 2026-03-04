# 环境配置指南

> 语言切换：**中文** · [English](SETUP.md)

本文档详细介绍在 macOS（主要针对 Apple Silicon）和 Windows 上从源码构建和开发 Refinex Terminal 所需的全部前置条件。

---

## macOS（Apple Silicon / ARM）

### 1. Xcode 命令行工具

C/C++ 编译所必需（Rust、原生插件和系统库均依赖此工具）。

```bash
xcode-select --install
```

验证安装：

```bash
xcode-select -p
# 期望输出：/Library/Developer/CommandLineTools
```

### 2. Homebrew

macOS 包管理器，若未安装请执行：

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

安装完成后，将 Homebrew 添加到 PATH（Apple Silicon 默认路径）：

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

验证：

```bash
brew --version
```

### 3. Rust（通过 rustup 安装）

Refinex Terminal 后端使用 Rust 编写，请安装官方工具链管理器：

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

选择选项 1（默认安装），然后重新加载 shell 环境：

```bash
source "$HOME/.cargo/env"
```

验证安装并确认版本为 stable 1.82+：

```bash
rustc --version
# 期望输出：rustc 1.82.x 或更高版本

cargo --version
```

添加 macOS ARM 目标（Apple Silicon 环境下应为默认值）：

```bash
rustup target list --installed
# 应包含：aarch64-apple-darwin
```

### 4. Node.js（通过 fnm 安装）

推荐使用 `fnm`（Fast Node Manager）管理 Node.js 版本：

```bash
brew install fnm
```

将 fnm 添加到 shell 配置：

```bash
# 针对 zsh（macOS 默认 shell）：
echo 'eval "$(fnm env --use-on-cd --shell zsh)"' >> ~/.zshrc
source ~/.zshrc
```

安装 Node.js 20 LTS：

```bash
fnm install 20
fnm use 20
fnm default 20
```

验证：

```bash
node --version
# 期望输出：v20.x.x

npm --version
```

### 5. pnpm

启用随 Node.js 附带的 corepack 并激活 pnpm：

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

验证：

```bash
pnpm --version
# 期望输出：9.x 或更高版本
```

### 6. Git

macOS 通过 Xcode 命令行工具自带 Git，但建议安装更新版本：

```bash
brew install git
```

验证：

```bash
git --version
# 期望输出：git version 2.40+（推荐 2.44+）
```

配置 Git 身份信息（如未设置）：

```bash
git config --global user.name "你的名字"
git config --global user.email "you@example.com"
```

### 7. Tauri 2 系统依赖

macOS 上的 Tauri 主要依赖 Xcode CLT（已安装）和 Rust（已安装），无需额外系统库 —— macOS 原生内置 WebKit（WebView）。

通过 npx 验证 Tauri CLI 可用：

```bash
pnpm dlx @tauri-apps/cli info
```

该命令会打印系统信息并确认 Tauri 前置条件均已满足。

### 8. （可选）其他工具

以下工具非必需，但推荐在开发时安装：

```bash
# IDE 支持的 Rust 分析器
rustup component add rust-analyzer

# Rust 代码检查工具
rustup component add clippy

# Rust 代码格式化工具
rustup component add rustfmt

# cargo-watch：Rust 开发时自动重新构建
cargo install cargo-watch

# sccache：加快 Rust 编译速度（缓存编译产物）
brew install sccache
echo 'export RUSTC_WRAPPER=sccache' >> ~/.zshrc
```

---

## Windows

### 1. Visual Studio 生成工具

Windows 上的 Rust 需要 MSVC C++ 生成工具，下载并安装：

**Visual Studio Build Tools 2022**：https://visualstudio.microsoft.com/visual-cpp-build-tools/

安装时选择以下工作负载：

- **使用 C++ 的桌面开发**

在"单个组件"中确保勾选：

- MSVC v143（或最新版） —— C++ 生成工具（ARM64/x64）
- Windows 11 SDK（最新版）
- 用于 Windows 的 C++ CMake 工具

### 2. WebView2 运行时

Windows 上的 Tauri 使用 Microsoft Edge WebView2。Windows 10（1809+）和 Windows 11 已预装。若未安装，请下载：

https://developer.microsoft.com/en-us/microsoft-edge/webview2/

在"添加或删除程序"中检索"Microsoft Edge WebView2 Runtime"以验证是否已安装。

### 3. Rust（通过 rustup 安装）

下载并运行 rustup 安装程序：

https://rustup.rs/

安装过程中：

- 选择选项 1（默认）
- 安装程序会自动检测 MSVC 并进行相应配置

打开**新的**终端（PowerShell 或 Windows Terminal）并验证：

```powershell
rustc --version
cargo --version
```

### 4. Node.js（通过 fnm 安装）

使用官方 Windows 安装方式安装 fnm：

```powershell
# 使用 winget（推荐）
winget install Schniz.fnm
```

或使用 PowerShell：

```powershell
# 添加 fnm 到 PowerShell 配置文件
fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression
```

安装 Node.js：

```powershell
fnm install 20
fnm use 20
fnm default 20
```

验证：

```powershell
node --version
npm --version
```

### 5. pnpm

```powershell
corepack enable
corepack prepare pnpm@latest --activate
```

验证：

```powershell
pnpm --version
```

### 6. Git for Windows

下载并安装：https://git-scm.com/download/win

安装过程中：

- 选择"Git from the command line and also from 3rd-party software"（在命令行和第三方软件中使用 Git）
- 选择"Checkout as-is, commit Unix-style line endings"（推荐跨平台协作）
- 选择"Use Windows' default console window"或"Use Windows Terminal"（如已安装）

验证：

```powershell
git --version
```

### 7. （可选）Windows Terminal

为获得最佳 Windows 开发体验，安装 Windows Terminal：

```powershell
winget install Microsoft.WindowsTerminal
```

### 8. （可选）其他工具

```powershell
# Rust 分析器、clippy、rustfmt
rustup component add rust-analyzer clippy rustfmt

# cargo-watch
cargo install cargo-watch
```

---

## 克隆仓库与首次构建

所有前置条件安装完成后：

```bash
# 克隆仓库
git clone https://github.com/refinex-lab/refinex-terminal.git
cd refinex-terminal

# 安装前端依赖
pnpm install

# 验证 Tauri 配置
pnpm dlx @tauri-apps/cli info

# 以开发模式运行
pnpm tauri dev
```

首次构建需要 3–5 分钟，Rust 会编译所有依赖项。后续构建（增量编译）速度会快得多（10–30 秒）。

若 `pnpm tauri dev` 成功运行并弹出带有终端的应用窗口，说明环境配置正确。

---

## 常见问题排查

### macOS："xcrun: error: invalid active developer path"

重新安装 Xcode 命令行工具：

```bash
sudo rm -rf /Library/Developer/CommandLineTools
xcode-select --install
```

### macOS：Rust 编译报错，提示缺少 `cc`

确保 Xcode CLT 已安装并接受许可协议：

```bash
sudo xcodebuild -license accept
```

### Windows："LINK : fatal error LNK1181: cannot open input file 'advapi32.lib'"

Windows SDK 未安装。重新运行 Visual Studio Build Tools 安装程序，确保在"桌面 C++ 开发"工作负载下勾选"Windows 11 SDK"。

### Windows：未找到 WebView2

从以下链接下载并安装 WebView2 常青版运行时：https://developer.microsoft.com/en-us/microsoft-edge/webview2/

### 两平台通用："error: failed to run custom build command for `portable-pty`"

确保 C 编译器可用。macOS 请重新安装 Xcode CLT；Windows 请确保已安装带有 MSVC 的 Visual Studio Build Tools。

### pnpm："ERR_PNPM_NO_MATCHING_VERSION"

清除 pnpm 缓存并重试：

```bash
pnpm store prune
pnpm install
```

### Tauri："failed to get webview2 version"

Windows 上出现此错误表示 WebView2 未安装，请通过上方链接安装。

---

## 推荐 IDE 配置

推荐使用 **VS Code**（或 Cursor），安装以下扩展：

- `rust-analyzer` —— Rust 语言支持
- `Tauri` —— Tauri 框架支持
- `ESLint` —— JavaScript/TypeScript 代码检查
- `Tailwind CSS IntelliSense` —— Tailwind 类名自动补全
- `Pretty TypeScript Errors` —— 可读性更强的 TS 错误提示

**VS Code 配置**（`.vscode/settings.json`）：

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
