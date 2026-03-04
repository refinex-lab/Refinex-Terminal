# CLAUDE.md — Refinex Terminal

## What

Refinex Terminal is an AI-first terminal emulator for macOS (Apple Silicon primary) and Windows, built to provide the best experience for AI coding CLI tools (Claude Code, Codex CLI, Copilot CLI, Gemini CLI).

## Stack

- **Desktop shell**: Tauri 2.x (Rust backend + system WebView)
- **Frontend**: React 19, TypeScript 5.6, Vite 6
- **Terminal emulator**: xterm.js 5.x with WebGL addon
- **PTY**: portable-pty (Rust crate, cross-platform)
- **Styling**: Tailwind CSS v4, shadcn/ui (New York style), Lucide icons
- **State**: Zustand
- **Git**: git2-rs (Rust bindings to libgit2) + system `git` for SSH operations
- **Config**: TOML format, parsed with `serde` in Rust
- **Package manager**: pnpm 9+

## Project Structure

```
src/                    → Frontend (React + TypeScript)
  components/           → UI components organized by feature
    terminal/           → Terminal emulator, search, AI blocks, split panes
    sidebar/            → Project navigator, file tree, file preview
    git/                → Git panel, diff viewer, branch manager
    tabs/               → Tab bar
    command-palette/    → Command palette overlay
    settings/           → Settings panel
    ai/                 → AI CLI wizard, agent status
    ui/                 → shadcn/ui base components
  hooks/                → Custom React hooks
  stores/               → Zustand state stores
  lib/                  → Utility functions, Tauri IPC wrappers
  styles/               → CSS (Tailwind imports)
  types/                → TypeScript type definitions

src-tauri/              → Backend (Rust / Tauri 2)
  src/
    main.rs             → Tauri entry point
    lib.rs              → Library root
    pty/                → PTY spawn, write, resize, kill
    git/                → Git operations (status, diff, commit, push, etc.)
    fs/                 → File system read, write, watch
    config/             → TOML config load, save, watch
    cli/                → AI CLI detection
    commands/           → Tauri IPC command handlers

themes/                 → Built-in theme TOML files
docs/                   → Documentation
  PPLAN.md              → Implementation plan (the source of truth for tasks)
```

## Build Commands

```bash
pnpm install            # Install frontend dependencies
pnpm tauri dev          # Run in dev mode with hot-reload
pnpm tauri build        # Build production binary
pnpm tsc --noEmit       # TypeScript type check
cargo check             # Rust compile check (run from src-tauri/)
cargo clippy -- -D warnings   # Rust lint (run from src-tauri/)
```

## Implementation Plan

**Read `docs/PPLAN.md`** — it contains the full phased implementation plan with every task and its AI prompt. Tasks are organized into numbered phases (0–8). Work through them sequentially. **After completing each task, update `docs/PPLAN.md` to mark it as done** by changing `[ ]` to `[x]`.

## Code Style

### TypeScript / React
- Strict mode: no `any` types, no `@ts-ignore`. Use proper generics and type narrowing.
- Functional components only. Use hooks, not class components.
- Named exports (not default) for components and utilities. Default export only for page-level components.
- File naming: `PascalCase.tsx` for components, `kebab-case.ts` for utilities and stores.
- Use `@/` path alias for imports (e.g., `import { Button } from "@/components/ui/button"`).
- Prefer `const` over `let`. Never use `var`.
- Destructure props in function parameters.
- React hooks at the top of component body. Custom hooks in `src/hooks/`.
- Error handling: wrap all Tauri `invoke()` calls in try/catch.

### Rust
- Follow Rust 2021 edition idioms. Use `clippy` with `-D warnings`.
- All public functions must have doc comments (`///`).
- Use `Result<T, E>` for fallible operations, never `unwrap()` in production code (only in tests).
- Use `thiserror` for custom error types per module.
- Tauri commands: use `#[tauri::command]` attribute, return `Result<T, String>` for commands that can fail.
- Module naming: `snake_case` for files and modules.
- Prefer `Arc<Mutex<>>` for shared state, `tokio::sync` for async locks.

### CSS / Styling
- Use Tailwind utility classes. No custom CSS unless absolutely necessary (e.g., xterm.js overrides).
- shadcn/ui components for all standard UI elements (buttons, inputs, dialogs, etc.).
- Responsive-aware where applicable, but primarily optimized for desktop viewport.
- Dark mode as the primary/default mode. Light mode as an alternative.

## Git Commit Convention

**Follow `.github/COMMIT_CONVENTION.md`** for all commits. Summary:

- Format: `type(scope): message`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`
- Scope: module name (e.g., `pty`, `terminal`, `git`, `sidebar`, `config`)
- Message: imperative, lowercase, no period, max 72 chars
- Example: `feat(pty): implement PTY spawn and resize commands`
- One logical change per commit. Do not mix unrelated changes.

## Important Constraints

- **No Electron**: We use Tauri 2. Never import or reference Electron APIs.
- **No node-pty**: We use the Rust `portable-pty` crate. Never use node-pty.
- **No localStorage/sessionStorage**: Use Zustand stores and Tauri file-based persistence.
- **System WebView only**: Do not bundle Chromium. Tauri uses the OS-native WebView.
- **Cross-platform awareness**: All Rust PTY/fs/git code must work on both macOS and Windows. Use conditional compilation (`#[cfg(target_os)]`) where platform-specific behavior is needed.
- **Performance budget**: Terminal must render at 60fps during streaming. Startup < 500ms on Apple Silicon.
- **Binary size**: Keep final bundle < 15MB (excluding system WebView).

## Testing & Verification

After every significant change:

1. `pnpm tsc --noEmit` — must pass with zero errors
2. `cargo clippy -- -D warnings` (in `src-tauri/`) — must pass
3. `pnpm tauri dev` — app must launch and function correctly
4. If modifying terminal: test by running a real shell command and verifying output
5. If modifying git: test with an actual git repository
6. If modifying config: test that changes persist across app restart

## Debugging Tips

- Frontend: Open WebView DevTools with `Cmd+Alt+I` (macOS) or `F12` (Windows) in dev mode.
- Rust backend: Logs via `tracing` crate, visible in the terminal where `pnpm tauri dev` is running.
- PTY issues: Check `TERM` env var is `xterm-256color`, verify shell path is correct.
- IPC issues: Check Tauri capability permissions in `src-tauri/capabilities/`.

## Do NOT

- Do not generate placeholder/demo code. Every implementation must be functional and complete.
- Do not skip error handling. Every Tauri command must handle errors gracefully.
- Do not use `unwrap()` in Rust production code.
- Do not introduce new dependencies without justification. Prefer the existing stack.
- Do not modify `docs/PPLAN.md` structure — only update task completion checkboxes.
- Do not commit code that fails `tsc` or `clippy` checks.
