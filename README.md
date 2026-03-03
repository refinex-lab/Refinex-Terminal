# Refinex Terminal

<div align="center">

<img src="assets/logo.png" alt="Refinex Terminal Logo" width="120" height="120" />

# Refinex Terminal

**⚡ The AI-First Terminal. Built for the Agentic Age.**

A high-performance, modern, lightweight terminal emulator purpose-built for AI CLI tools —  
Claude Code · Codex CLI · Copilot CLI · Gemini CLI — and beyond.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20ARM%20%7C%20Windows-lightgrey)](https://github.com/refinex-lab/Refinex-Terminal)
[![Built with Rust](https://img.shields.io/badge/built%20with-Rust-orange?logo=rust)](https://www.rust-lang.org/)
[![Stars](https://img.shields.io/github/stars/refinex-lab/Refinex-Terminal?style=social)](https://github.com/refinex-lab/Refinex-Terminal/stargazers)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Features](#-features) · [Architecture](#-architecture) · [Roadmap](#-roadmap) · [Getting Started](#-getting-started) · [Contributing](#-contributing)

</div>

---

## 🤔 Why Refinex Terminal?

Modern AI CLI tools like **Claude Code**, **OpenAI Codex CLI**, **GitHub Copilot CLI**, and **Gemini CLI** have fundamentally changed how developers write code. Yet we're still running them in terminals designed decades ago — terminals that have no idea what an AI agent is, what a diff block looks like, or why a "Press Y to confirm" prompt should never get lost in a wall of text.

**Refinex Terminal** is built from the ground up for the AI-first development workflow:

| Traditional Terminal | Refinex Terminal |
|---|---|
| Raw text stream, no structure | Structured AI output **Blocks** |
| No awareness of AI agent state | Native AI session management |
| Manual file navigation | Built-in workspace file tree |
| Fixed-width text wall | Collapsible thinking panels, rich diffs |
| Generic PTY settings | Per-CLI optimized environment |
| You search for the confirmation prompt | Confirmation prompts are **always visible** |

---

## ✨ Features

### 🤖 AI-First Design
- **Block-based output rendering** — Every AI response is a structured, navigable block
- **Claude Code integration** — Collapsible `<thinking>` panels, diff previews, file operation highlights
- **Per-CLI environment optimization** — Correct `TERM`, `COLORTERM`, and env vars auto-set for each AI tool
- **Workspace context injection** — Auto-detects `CLAUDE.md`, `.cursorrules`, CWD and feeds context to AI
- **AI session management** — Name, save, search, and replay AI sessions
- **Token usage estimation** — Live display of approximate token consumption

### 🖥️ Powerful Terminal Core
- **GPU-accelerated rendering** — Metal on Apple Silicon, DirectX 12 / Vulkan on Windows
- **True multi-pane splitting** — Infinite horizontal/vertical splits via tree data structure
- **Full VT100/VT220/ANSI compatibility** — Powered by `alacritty_terminal` crate
- **Cross-platform PTY** — Native PTY management via `portable-pty`
- **Font ligatures & Nerd Font icons** — Beautiful, readable code in the terminal
- **True color & emoji support** — 24-bit color, full emoji rendering

### 📁 Workspace Integration
- **Live file tree panel** — Sidebar file explorer with real-time change detection
- **Syntax-highlighted file viewer** — View any file with full syntax highlighting
- **Markdown renderer** — Rich Markdown preview inside the terminal
- **Git status indicators** — File tree shows modified / added / deleted states
- **AI file access highlights** — See exactly which files the AI agent is reading or modifying

### 🎨 Modern UX
- **Multi-line smart input** — Editor-like input bar (multi-cursor, history search)
- **Prompt templates** — Save and reuse common AI prompts with keyboard shortcuts
- **Background task notifications** — System alerts when long-running AI tasks complete
- **Theme system** — Dark / Light + Catppuccin, Tokyo Night, and custom themes
- **Configurable via TOML** — Clean, simple config file (no YAML hell)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Refinex Terminal (Rust)                       │
├──────────────────┬──────────────────┬───────────────────────────┤
│   UI Layer       │   Core Engine    │   AI Integration Layer     │
│  (GPUI / Iced)   │                  │                            │
│                  │  ┌────────────┐  │  ┌─────────────────────┐  │
│  ┌────────────┐  │  │ PTY Engine │  │  │ AI Process Manager  │  │
│  │ File Tree  │  │  │(portable-  │  │  │ Claude / Codex /    │  │
│  │  Panel     │  │  │   pty)     │  │  │ Copilot / Gemini    │  │
│  ├────────────┤  │  ├────────────┤  │  ├─────────────────────┤  │
│  │ Terminal   │  │  │VT Emulator │  │  │  Block Detector     │  │
│  │  Panes     │  │  │(alacritty_ │  │  │ (AI output → Block) │  │
│  ├────────────┤  │  ├────────────┤  │  ├─────────────────────┤  │
│  │ File       │  │  │ GPU Render │  │  │  Context Injector   │  │
│  │ Viewer     │  │  │  (wgpu)    │  │  │  (CWD / File tree / │  │
│  ├────────────┤  │  ├────────────┤  │  │   CLAUDE.md)        │  │
│  │ AI Output  │  │  │Font Render │  │  └─────────────────────┘  │
│  │ Block View │  │  │(swash)     │  │                            │
│  └────────────┘  │  └────────────┘  │                            │
└──────────────────┴──────────────────┴───────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|---|---|
| Language | **Rust** (2021 edition) |
| UI Framework | **GPUI** (Phase 2) / **Tauri v2 + xterm.js** (MVP) |
| VT Emulation | `alacritty_terminal` |
| PTY Management | `portable-pty` |
| GPU Rendering | `wgpu` (Metal · DirectX 12 · Vulkan) |
| Font Rendering | `swash` + `cosmic-text` |
| File Watching | `notify` |
| Async Runtime | `tokio` |
| Config Format | **TOML** |
| Scripting | **Lua** (via `mlua`) |

---

## 🗺️ Roadmap

### Phase 1 — MVP `v0.1` *(In Progress)*
- [ ] Basic PTY session management
- [ ] Multi-tab and pane splitting (horizontal / vertical)
- [ ] File tree panel with expand / collapse
- [ ] AI CLI process launch with optimized environment
- [ ] Basic Block detection for Claude Code output
- [ ] macOS ARM + Windows packaging (`.dmg` / `.exe`)

### Phase 2 — Core `v0.5`
- [ ] Full GPU-accelerated rendering (wgpu + Metal on Apple Silicon)
- [ ] File content viewer (syntax highlighting + Markdown)
- [ ] AI output Block rendering (diff view, code blocks, collapsible panels)
- [ ] Workspace context auto-injection (CLAUDE.md detection)
- [ ] AI session history and search
- [ ] Theme system (dark / light / custom)

### Phase 3 — Advanced `v1.0`
- [ ] AI Agent concurrent management panel
- [ ] Smart multi-line input editor with prompt templates
- [ ] Token usage estimation display
- [ ] Inline file editing (apply AI suggestions directly)
- [ ] Plugin / scripting system (Lua)
- [ ] Homebrew tap + winget package
- [ ] Full documentation site

---

## 🚀 Getting Started

> ⚠️ **Refinex Terminal is currently in early development (Phase 1 MVP).**  
> Pre-built binaries are not yet available. You can build from source.

### Prerequisites

- **macOS** 12+ (Apple Silicon M-series recommended) or **Windows** 10/11
- [Rust](https://rustup.rs/) 1.80+
- [Node.js](https://nodejs.org/) 18+ (for MVP / Tauri phase)
- [Git](https://git-scm.com/)

### Build from Source

```bash
# Clone the repository
git clone https://github.com/refinex-lab/Refinex-Terminal.git
cd Refinex-Terminal

# Install dependencies and run in development mode
cargo tauri dev

# Build for release
cargo tauri build
```

### Supported AI CLI Tools

Install the AI CLIs you want to use with Refinex Terminal:

```bash
# Claude Code
npm install -g @anthropic-ai/claude-code

# OpenAI Codex CLI
npm install -g @openai/codex

# GitHub Copilot CLI
gh extension install github/gh-copilot

# Gemini CLI
npm install -g @google/gemini-cli
```

---

## 📁 Project Structure

```
Refinex-Terminal/
├── crates/
│   ├── refinex-app/          # Main application entry point
│   ├── refinex-core/         # Terminal engine (PTY, VT, rendering)
│   ├── refinex-ai/           # AI CLI integration layer
│   ├── refinex-workspace/    # File tree & workspace management
│   └── refinex-ui/           # UI components
├── assets/
│   ├── fonts/                # Bundled fonts (JetBrains Mono Nerd Font)
│   └── themes/               # Built-in themes
├── docs/                     # Documentation
├── .github/
│   ├── ISSUE_TEMPLATE/       # Bug report & feature request templates
│   └── workflows/            # CI/CD (build, test, release)
├── CONTRIBUTING.md
├── CHANGELOG.md
└── README.md
```

---

## 🤝 Contributing

We welcome contributions of all kinds! Whether it's a bug report, a feature suggestion, a documentation improvement, or a code contribution — every bit helps.

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a pull request.

### Development Setup

```bash
# Fork and clone the repo
git clone https://github.com/<your-username>/Refinex-Terminal.git
cd Refinex-Terminal

# Install Rust components
rustup component add clippy rustfmt

# Run checks
cargo clippy
cargo fmt --check
cargo test
```

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgements

Refinex Terminal stands on the shoulders of giants:

- [Alacritty](https://github.com/alacritty/alacritty) — VT emulation core
- [WezTerm](https://github.com/wezterm/wezterm) — Architecture inspiration
- [Zed](https://github.com/zed-industries/zed) — GPUI framework
- [Warp](https://github.com/warpdotdev/Warp) — Block-based terminal UX concepts
- [Tauri](https://github.com/tauri-apps/tauri) — Cross-platform app framework

---

<div align="center">

**If Refinex Terminal helps your AI-powered development workflow, please consider giving it a ⭐**

Made with ❤️ and 🦀 Rust · [refinex-lab](https://github.com/refinex-lab)

</div>
