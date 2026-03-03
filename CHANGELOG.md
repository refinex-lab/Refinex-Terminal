# Changelog

All notable changes to **Refinex Terminal** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Initial repository setup
- Project architecture design and documentation
- README with full feature overview, roadmap, and tech stack
- MIT License
- GitHub Actions CI workflow (macOS ARM + Windows)
- Issue templates (Bug Report, Feature Request)
- Pull Request template
- Contributing guide
- VS Code workspace configuration
- **Phase 0.1**: Cargo Workspace structure with 5 crates:
  - `crates/refinex-app` (binary entry point)
  - `crates/refinex-core` (PTY engine, VT emulation)
  - `crates/refinex-ai` (AI CLI integration, Block detection)
  - `crates/refinex-workspace` (file tree, file watcher, git status)
  - `crates/refinex-ui` (shared UI types)
- **Phase 0.1**: Workspace-level `[workspace.dependencies]` for all shared crates
- **Phase 0.1**: MIT license headers on all Rust source files
- **Phase 0.1**: `tracing_subscriber` initialized in `refinex-app`
- **Phase 0.2**: Tauri v2 integration with `src-tauri/` at repo root
  - `tauri.conf.json`: productName, identifier, 1280×800 frameless window
  - `src-tauri/src/lib.rs` + `main.rs` wired to `app_lib::run()`
  - `src-tauri/capabilities/default.json` with core:default permissions
  - Platform icons generated via `cargo tauri icon`
- **Phase 0.2**: Vite 6 + React 19 + TypeScript frontend (`src/`)
- **Phase 0.2**: `@xterm/xterm` v5 with `addon-fit` and `addon-web-links` integrated
- **Phase 0.2**: Tokyo Night theme applied to xterm.js terminal
- **Phase 0.2**: `cargo tauri dev` launches window with xterm.js render area
- **Phase 0.3**: `rustfmt.toml` — edition 2021, max_width 100, import grouping
- **Phase 0.3**: `clippy.toml` — pedantic + nursery threshold config
- **Phase 0.3**: `.cargo/config.toml` — CN mirror stubs (commented), dev opt-level 2 for deps, release LTO/strip, platform linker flags
- **Phase 0.3**: `[workspace.lints]` in root `Cargo.toml` — pedantic + nursery enabled, `lints.workspace = true` in every crate
- **Phase 0.3**: All placeholder functions updated to `#[must_use] const fn`
- **Phase 0.3**: `cargo fmt --all --check` passes (exit 0)
- **Phase 0.3**: `cargo clippy --workspace -- -D warnings` passes (0 errors, 0 warnings)
- **Phase 0.4**: All workspace dependencies declared in `[workspace.dependencies]`:
  - `tokio`, `serde`, `serde_json`, `anyhow`, `thiserror`, `tracing`, `tracing-subscriber`
  - `toml`, `dirs`, `portable-pty`, `notify`, `ignore`
- **Phase 0.4**: `tracing_subscriber` with env-filter initialized in `refinex-app/src/main.rs`
- **Phase 0.5**: `cargo build --workspace` passes with zero errors and zero warnings
- **Phase 0.5**: `cargo tauri dev` verified launching on macOS ARM (window initialises successfully)
- **Phase 0.5**: GitHub Actions CI workflow rewritten:
  - `lint` job migrated from `ubuntu-latest` → `macos-14` (Apple Silicon runner)
  - All build jobs now include Node.js 20 setup and `npm ci` step
  - Clippy command corrected to `cargo clippy --workspace -- -D warnings`
  - Build commands updated to `cargo build --workspace --target <target>`
  - Added `concurrency` group to cancel stale runs
  - Improved Cargo cache path granularity (registry/index, registry/cache, git/db)
- **Phase 0.5**: `.cargo/config.toml` macOS linker flags cleaned up (removed invalid `-undefined dynamic_lookup` flags)
- **Phase 1.1**: `PtyManager` implemented in `refinex-core`:
  - `create(&str, &str, u16, u16)` — opens PTY pair, spawns shell, starts background read thread
  - `write(PtyId, &str)` — writes keystrokes to PTY stdin
  - `resize(PtyId, u16, u16)` — sends `TIOCSWINSZ` resize via `portable-pty`
  - `kill(PtyId)` — drops session; master PTY close sends SIGHUP to child
  - Background read thread reaps child process and emits `PtyEvent::Exit` on EOF
- **Phase 1.1**: `PtyEvent` enum (`Output { id, data: Vec<u8> }` | `Exit { id }`) for Rust→Tauri event bridging
- **Phase 1.1**: `crates/refinex-app/src-tauri/src/commands.rs` — four Tauri commands registered:
  - `create_pty` (optional shell/cwd/cols/rows, defaults: `$SHELL`/home/80/24)
  - `write_pty`, `resize_pty`, `kill_pty`
- **Phase 1.1**: PTY output forwarded as `pty-output` Tauri event (Base64-encoded bytes)
- **Phase 1.1**: PTY process exit forwarded as `pty-exit` Tauri event
- **Phase 1.1**: `base64 = "0.22"` added to workspace dependencies

---

## [0.1.0] - TBD

### Added
- Basic PTY session management
- Multi-tab support
- Horizontal and vertical pane splitting
- File tree panel
- AI CLI process launcher (Claude Code, Codex CLI, Copilot CLI)
- Basic Block detection for Claude Code output
- macOS ARM (Apple Silicon) build
- Windows build

---

[Unreleased]: https://github.com/refinex-lab/Refinex-Terminal/compare/HEAD...HEAD
[0.1.0]: https://github.com/refinex-lab/Refinex-Terminal/releases/tag/v0.1.0