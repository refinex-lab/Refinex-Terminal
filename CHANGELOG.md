# Changelog

All notable changes to Refinex Terminal will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-01-XX

### 🎉 Initial Release

Refinex Terminal v0.1.0 is the first public release of an AI-first terminal emulator designed for modern development workflows.

### ✨ Core Features

#### Terminal Emulation
- **Full-featured terminal** powered by xterm.js with WebGL rendering
- **Multi-tab support** with drag-and-drop reordering
- **Split panes** (horizontal and vertical) for multi-terminal workflows
- **Terminal search** with regex support and match navigation
- **Copy/paste** with configurable copy-on-select
- **Context menu** with common terminal actions
- **Scrollback buffer** with configurable line limit
- **Shell detection** (zsh, bash, PowerShell, cmd)
- **Environment variable** management

#### AI CLI Integration
- **Automatic detection** of AI coding assistants:
  - Claude Code
  - GitHub Copilot CLI
  - Codex CLI
  - Gemini CLI
- **AI CLI setup wizard** with detection, configuration, and testing
- **Shell integration** for easy AI CLI access
- **Settings panels** for each AI CLI with full configuration support

#### Project Management
- **Multi-project sidebar** with file tree navigation
- **File preview** with syntax highlighting
- **Built-in code editor** with CodeMirror 6
- **File system watcher** for real-time updates
- **Fuzzy file finder** (Cmd/Ctrl + P)
- **Quick project switch** (Cmd/Ctrl + Shift + O)
- **Global search and replace** across project files

#### Git Integration
- **Git status panel** with staged/unstaged/untracked files
- **Diff viewer** with syntax highlighting
- **Branch management** with create, switch, and delete
- **Commit workflow** with message editor
- **Git graph visualization** with commit history
- **Push/pull/fetch** operations
- **Stash management**

#### SSH Support
- **SSH connection manager** with saved hosts
- **SFTP file browser** with upload/download
- **Multiple SSH sessions** in tabs
- **SSH key management**
- **Connection testing** and diagnostics

#### Customization
- **5 built-in themes**:
  - Refinex Dark (default)
  - Refinex Light
  - Tokyo Night
  - Catppuccin Mocha
  - GitHub Dark
- **Font customization** with system font detection
- **Configurable keybindings**
- **Window opacity and vibrancy** (macOS)
- **TOML-based configuration** with hot-reload

#### User Interface
- **Command palette** (Cmd/Ctrl + Shift + P) for quick actions
- **Settings panel** with organized sections
- **Status bar** with Git branch and file info
- **Keyboard-driven workflow** with comprehensive shortcuts
- **Responsive layout** with resizable panels
- **macOS native title bar** with traffic lights

#### Developer Experience
- **TypeScript** with strict mode
- **React 19** with hooks
- **Tailwind CSS v4** for styling
- **shadcn/ui** components (New York style)
- **Zustand** for state management
- **Tauri 2** for native performance

### 🔧 Configuration

- **Config file location**: `~/.refinex/config.toml`
- **Hot-reload support**: Changes apply immediately
- **Comprehensive settings**: Appearance, terminal, AI, Git, keybindings
- **Per-project settings**: Project-specific configurations

### 🚀 Performance

- **60fps rendering** during terminal output
- **WebGL acceleration** for smooth scrolling
- **Lazy loading** for large file trees
- **Efficient PTY management** with Rust backend
- **Memory-efficient** scrollback buffer
- **Fast startup** (< 500ms on Apple Silicon)

### 📦 Distribution

#### macOS
- **Native .dmg installer**
- **Apple Silicon optimized** (ARM64)
- **Code signing support** (optional)
- **Notarization support** (optional)
- **Minimum version**: macOS 10.15 (Catalina)

#### Windows
- **NSIS installer** with full integration
- **Start Menu shortcuts**
- **Explorer context menu** ("Open Refinex Terminal here")
- **PATH configuration** (automatic)
- **Code signing support** (optional)
- **Minimum version**: Windows 10

### 🔄 Auto-Updates

- **Background update checks** on app launch
- **Non-intrusive notifications** for available updates
- **One-click update and restart**
- **Manual update check** via command palette
- **Signed updates** with verification

### 📚 Documentation

- **Comprehensive README** with features and installation
- **Auto-updater guide** (`docs/AUTO_UPDATER.md`)
- **macOS signing guide** (`docs/MACOS_SIGNING.md`)
- **Windows installer guide** (`docs/WINDOWS_INSTALLER.md`)
- **Implementation plan** (`docs/PLAN.md`)
- **Commit conventions** (`.github/COMMIT_CONVENTION.md`)

### 🛠️ CI/CD

- **GitHub Actions** for automated builds
- **Multi-platform builds** (macOS ARM64, Windows x64)
- **Automated testing** (TypeScript, Rust)
- **Code quality checks** (clippy, tsc)
- **Automated releases** on version tags
- **Binary artifacts** uploaded to GitHub Releases

### 🔐 Security

- **Sandboxed execution** with Tauri capabilities
- **Secure credential storage** for SSH keys
- **No telemetry or tracking**
- **Open source** and auditable

### 🐛 Known Issues

- **Windows**: First launch may show SmartScreen warning (unsigned builds)
- **macOS**: Unsigned builds require right-click → Open on first launch
- **Large projects**: File tree may be slow with 10,000+ files (virtualization planned)

### 📝 Notes

This is the initial release of Refinex Terminal. We're actively developing new features and improvements. Please report any issues on [GitHub Issues](https://github.com/refinex/refinex-terminal/issues).

### 🙏 Acknowledgments

Built with:
- [Tauri](https://tauri.app/) - Native app framework
- [xterm.js](https://xtermjs.org/) - Terminal emulator
- [React](https://react.dev/) - UI framework
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [CodeMirror](https://codemirror.net/) - Code editor
- [Zustand](https://zustand-demo.pmnd.rs/) - State management

---

## [Unreleased]

### Planned Features

- **AI output block detection** with visual indicators
- **Agent status tracking** (thinking, writing, waiting)
- **Streaming output optimization** for large AI responses
- **File tree virtualization** for large projects
- **Custom themes** with theme editor
- **Plugin system** for extensibility
- **Linux support** (Ubuntu, Fedora, Arch)
- **Portable mode** (no installation required)
- **Session persistence** across restarts
- **Terminal recording** and playback

---

[0.1.0]: https://github.com/refinex/refinex-terminal/releases/tag/v0.1.0
