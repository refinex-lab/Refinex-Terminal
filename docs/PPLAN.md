# Refinex Terminal — Implementation Plan (PPLAN)

> **Purpose**: This document is the single source of truth for the entire Refinex Terminal build process, from project initialization to production release. Each phase is broken down into discrete tasks designed to be completed in a single Claude Code session. Every task includes a ready-to-use AI prompt.
>
> **Rule**: After completing each task, Claude Code **must** update this file by changing `[ ]` to `[x]` for the completed items.

---

## Phase 0: Project Initialization & Scaffolding

**Goal**: Set up the Tauri 2 + React 19 + TypeScript monorepo structure, install all dependencies, verify the app launches with an empty window on macOS and Windows.

### Tasks

- [ ] **0.1 — Initialize Tauri 2 project with React frontend**

  > **Prompt**: Create a new Tauri 2 project in the current directory. Use `pnpm create tauri-app` with the following options: package name `refinex-terminal`, identifier `com.refinex.terminal`, frontend language TypeScript, frontend framework React (with Vite). After scaffolding, verify the project structure includes `src/` (frontend) and `src-tauri/` (backend). Update `src-tauri/tauri.conf.json` to set the window title to "Refinex Terminal", default size 1280x800, minSize 800x600, and `decorations: true`. Run `pnpm install` and `pnpm tauri dev` to confirm the empty app launches successfully. Fix any issues.

- [ ] **0.2 — Configure TypeScript strict mode and path aliases**

  > **Prompt**: Update `tsconfig.json` to enable strict mode (`strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`). Add path aliases: `@/*` mapping to `./src/*`. Update `vite.config.ts` to resolve these path aliases. Create `src/types/index.ts` as the central type export file. Verify no TypeScript errors exist with `pnpm tsc --noEmit`.

- [ ] **0.3 — Install and configure Tailwind CSS v4**

  > **Prompt**: Install Tailwind CSS v4 and its Vite plugin (`@tailwindcss/vite`). Configure `vite.config.ts` to include the Tailwind plugin. Create `src/styles/globals.css` with `@import "tailwindcss"` and any base layer customizations (reset box-sizing, smooth scrolling, custom scrollbar styles for the terminal). Import this CSS in `src/main.tsx`. Verify Tailwind utilities work by adding a test class to `App.tsx` and confirming it renders. Remove the test class after verification.

- [ ] **0.4 — Install shadcn/ui and configure component library**

  > **Prompt**: Initialize shadcn/ui in the project by running the appropriate init command for the React + Vite + Tailwind v4 setup. Configure it to use the "new-york" style, slate base color, and CSS variables for theming. Install these initial components: `button`, `dialog`, `dropdown-menu`, `input`, `scroll-area`, `separator`, `tooltip`, `tabs`, `badge`, `command` (for command palette). Install `lucide-react` for icons. Verify a Button component renders correctly. Ensure all shadcn components are placed under `src/components/ui/`.

- [ ] **0.5 — Install Zustand and create initial store structure**

  > **Prompt**: Install `zustand` and create the following store files under `src/stores/`:
  > - `terminal-store.ts` — manages terminal sessions (tabs, active tab, PTY ids). Define types: `TerminalSession = { id: string, title: string, cwd: string, ptyId: number | null, isActive: boolean }`. Export initial empty store with actions: `addSession`, `removeSession`, `setActiveSession`, `updateSessionTitle`.
  > - `sidebar-store.ts` — manages sidebar state (open/closed, active project, file tree). Define types: `Project = { path: string, name: string }`. Export store with `isOpen`, `projects`, `activeProject`, `toggleSidebar`, `addProject`, `removeProject`, `setActiveProject`.
  > - `config-store.ts` — manages user configuration loaded from TOML. Define the `AppConfig` type matching the config.toml schema from README (appearance, terminal, ai, git, keybindings). Export store with `config`, `updateConfig`, `resetConfig`.
  > - `git-store.ts` — manages Git state. Define types: `GitStatus = { branch: string, ahead: number, behind: number, staged: FileChange[], unstaged: FileChange[], untracked: string[] }`, `FileChange = { path: string, status: 'added' | 'modified' | 'deleted' | 'renamed' }`. Export store.
  >
  > Use TypeScript strict types, no `any`. Verify all stores compile without errors.

- [ ] **0.6 — Configure Tauri capabilities and permissions**

  > **Prompt**: In `src-tauri/capabilities/`, create a `default.json` capability file that grants the following permissions: shell execution (for PTY), file system read/write (scoped to user-selected project directories and the app config directory), window management, event emission/listening, path resolution, dialog (for folder picker), and clipboard access. Follow Tauri v2 capability-based permission model — only grant what is needed. Verify the app still launches after adding capabilities.

- [ ] **0.7 — Set up application icons and window chrome**

  > **Prompt**: Create a minimal placeholder icon for Refinex Terminal (a simple SVG lightning bolt ⚡ in a rounded square, exported as .ico and .icns). Place the icons in `src-tauri/icons/` with the correct filenames expected by Tauri (`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`, `icon.png`). Update `src-tauri/tauri.conf.json` to reference them. On macOS, configure the window to use `titleBarStyle: "overlay"` for a native-feeling title bar with traffic lights. On Windows, use the default title bar. Add the Refinex logo as a small SVG component in `src/components/ui/Logo.tsx` that can be used in the sidebar header. Verify the app launches with the correct icon and window chrome.

- [ ] **0.8 — Verify full build pipeline**

  > **Prompt**: Run `pnpm tauri build` to produce a production binary. On macOS, verify the `.dmg` or `.app` bundle is generated in `src-tauri/target/release/bundle/`. Verify the binary launches correctly, window renders, and no console errors exist. If any build warnings appear, fix them. Document the final binary size. Ensure `pnpm tsc --noEmit` passes, `pnpm build` (Vite) passes, and `cargo check` (in src-tauri) passes with zero warnings.

---

## Phase 1: Core Terminal Emulation

**Goal**: Implement a fully functional terminal emulator that can spawn a shell, handle input/output, support tabs, and render at 60fps.

### Tasks

- [ ] **1.1 — Implement Rust PTY manager**

  > **Prompt**: In `src-tauri/src/pty/`, create a PTY manager module. Add `portable-pty` to Cargo.toml. Implement a `PtyManager` struct that:
  > - Stores active PTY sessions in a `HashMap<u32, PtySession>` wrapped in `Arc<Mutex<>>`.
  > - `spawn(cwd: String, cols: u16, rows: u16) -> u32`: spawns a new PTY process (using the user's default shell), returns a session ID.
  > - `write(id: u32, data: Vec<u8>)`: writes data to a PTY session.
  > - `resize(id: u32, cols: u16, rows: u16)`: resizes a PTY.
  > - `kill(id: u32)`: terminates a PTY session and cleans up.
  > - Spawns a reader thread per PTY that reads output and emits Tauri events (`pty-output-{id}`) to the frontend.
  >
  > Register the PtyManager as Tauri managed state. Expose Tauri commands: `pty_spawn`, `pty_write`, `pty_resize`, `pty_kill`. Compile and verify with `cargo check`.

- [ ] **1.2 — Integrate xterm.js with WebGL addon**

  > **Prompt**: Install `@xterm/xterm`, `@xterm/addon-webgl`, `@xterm/addon-fit`, `@xterm/addon-search`, `@xterm/addon-web-links`, `@xterm/addon-unicode11`. Create `src/components/terminal/TerminalView.tsx`:
  > - Initialize an xterm.js `Terminal` instance with the WebGL addon for GPU rendering, fit addon for auto-resize, search addon, web-links addon, and unicode11 addon.
  > - Use a `useEffect` to open the terminal in a container div and load all addons.
  > - On mount, call the Tauri `pty_spawn` command to get a PTY session ID.
  > - Listen for `pty-output-{id}` Tauri events and write received data to xterm.
  > - On xterm `onData`, call `pty_write` to send input to the PTY.
  > - On container resize (use ResizeObserver), call `fit addon.fit()` then `pty_resize`.
  > - On unmount, call `pty_kill` and dispose xterm instance.
  >
  > Create a wrapper `src/lib/tauri-pty.ts` with typed invoke functions for all PTY commands. Verify typing `ls` in the terminal produces correct output. Verify colors and cursor work.

- [ ] **1.3 — Implement tab management system**

  > **Prompt**: Create `src/components/tabs/TabBar.tsx` — a horizontal tab bar at the top of the terminal area. Each tab shows the session title (initially "Terminal 1", "Terminal 2", etc.) and a close button (X icon from lucide-react). The active tab is visually highlighted. Implement:
  > - "New tab" button (`+` icon) at the end of the tab bar — calls `addSession` from terminal-store and spawns a new PTY.
  > - Click a tab to switch active session — hides other terminal views (do NOT destroy them), shows the selected one.
  > - Close button kills the PTY and removes the session from the store.
  > - `Cmd/Ctrl + T` shortcut to create new tab, `Cmd/Ctrl + W` to close current tab, `Cmd/Ctrl + 1-9` to switch tabs.
  > - Tabs are draggable to reorder (use a simple drag handler, no external lib needed).
  >
  > Update `App.tsx` to compose TabBar above a TerminalView area. Verify multi-tab workflow: open 3 tabs, type different commands in each, switch between them, close one, verify others are intact.

- [ ] **1.4 — Handle shell detection and environment setup**

  > **Prompt**: In `src-tauri/src/pty/shell.rs`, implement shell detection logic:
  > - macOS: Read `$SHELL` env var, fallback to `/bin/zsh`, then `/bin/bash`.
  > - Windows: Try `powershell.exe`, fallback to `cmd.exe`.
  > - When spawning a PTY, inject the user's `PATH`, `HOME`, `LANG=en_US.UTF-8`, and `TERM=xterm-256color` into the environment.
  > - Support a config option to override the shell path (read from config.toml `terminal.shell` field).
  > - Detect and set correct `TERM_PROGRAM=RefinexTerminal` and `TERM_PROGRAM_VERSION` env vars so CLI tools can detect they're running inside Refinex.
  >
  > Verify that on macOS, zsh launches with correct prompt, and on Windows, PowerShell launches correctly. Verify `echo $TERM` outputs `xterm-256color`.

- [ ] **1.5 — Implement terminal search**

  > **Prompt**: Create `src/components/terminal/TerminalSearch.tsx` — a search overlay that appears when `Cmd/Ctrl + F` is pressed while a terminal is focused. It should have:
  > - A text input for the search query.
  > - "Previous" and "Next" navigation buttons (with up/down arrow icons).
  > - A "Match case" toggle and "Regex" toggle.
  > - Uses xterm.js `SearchAddon` to highlight matches and navigate.
  > - `Escape` closes the search bar.
  > - Display match count (e.g., "3 of 12").
  >
  > Verify: type a command with repeated output (e.g., `cat` a file), open search, type a term, verify highlights appear and navigation works.

- [ ] **1.6 — Implement copy/paste and selection**

  > **Prompt**: Configure xterm.js to support:
  > - **Copy on select**: When text is selected in the terminal, automatically copy to clipboard (configurable via `terminal.copy_on_select`).
  > - `Cmd/Ctrl + C` when text is selected copies the selection (when no text is selected, send SIGINT as normal).
  > - `Cmd/Ctrl + V` pastes from clipboard into the terminal.
  > - `Cmd/Ctrl + Shift + C` always copies selection.
  > - `Cmd/Ctrl + Shift + V` always pastes.
  > - Right-click context menu with Copy, Paste, Select All, Clear Terminal options.
  >
  > Create `src/components/terminal/TerminalContextMenu.tsx` using shadcn/ui DropdownMenu. Verify all copy/paste operations work correctly with multi-line content.

---

## Phase 2: Configuration System

**Goal**: Implement the TOML-based configuration system with hot-reload, theme engine, and font management.

### Tasks

- [ ] **2.1 — Implement Rust config manager**

  > **Prompt**: In `src-tauri/src/config/`, create a configuration module. Add `toml` and `serde` to Cargo.toml. Define Rust structs mirroring the `config.toml` schema (AppConfig, Appearance, Terminal, AI, Git, Keybindings — all with `#[derive(Serialize, Deserialize, Clone, Default)]`). Implement:
  > - `load_config(path: PathBuf) -> AppConfig`: reads and parses TOML, returns defaults for missing fields.
  > - `save_config(config: &AppConfig, path: PathBuf)`: serializes to TOML and writes.
  > - `get_config_path() -> PathBuf`: returns platform-specific config directory.
  > - `watch_config(path: PathBuf, tx: Sender)`: uses `notify` crate to watch the config file for external changes and emit updates.
  >
  > Expose Tauri commands: `get_config`, `update_config`, `reset_config`, `get_config_path`. On app startup, load config and inject into managed state. Verify with `cargo check`.

- [ ] **2.2 — Build theme engine**

  > **Prompt**: Create `src/lib/theme-engine.ts` that:
  > - Defines a `Theme` type with all terminal colors (background, foreground, cursor, selection, ansi 0-15, plus UI colors for sidebar, tabs, borders).
  > - Implements `applyTheme(theme: Theme)` which sets CSS custom properties on `:root`.
  > - Implements `loadBuiltinTheme(name: string)` which imports from `themes/` directory.
  > - Implements `loadCustomTheme(path: string)` which calls a Tauri command to read the TOML file.
  >
  > Create 5 built-in themes as TOML files in `themes/`: `refinex-dark.toml` (default — deep blue-gray), `refinex-light.toml`, `tokyo-night.toml`, `catppuccin-mocha.toml`, `github-dark.toml`. Each theme must define all required color fields. Apply the theme to both xterm.js options and the UI CSS variables. Verify theme switching works live without restart.

- [ ] **2.3 — Implement font management**

  > **Prompt**: Create `src/lib/font-manager.ts` that:
  > - Queries available system fonts via a Tauri command (implement `list_fonts` in Rust using the `font-kit` crate or by reading system font directories).
  > - Provides `applyFont(family: string, size: number, lineHeight: number, ligatures: boolean)` which updates xterm.js terminal options and UI CSS.
  > - Validates that the requested font exists, falling back to `"JetBrains Mono", "Fira Code", "Cascadia Code", monospace`.
  > - Handles dynamic font size changes (Cmd/Ctrl + Plus/Minus to zoom, Cmd/Ctrl + 0 to reset).
  >
  > Verify font changes apply immediately to the terminal without reconnecting the PTY.

- [ ] **2.4 — Create settings UI panel**

  > **Prompt**: Create `src/components/settings/SettingsPanel.tsx` — a full-screen modal (triggered by `Cmd/Ctrl + ,`) with a left-nav sidebar containing sections: Appearance, Terminal, AI, Git, Keybindings. Each section renders form controls:
  > - **Appearance**: theme dropdown, font family dropdown, font size slider, line height slider, ligatures toggle, opacity slider, vibrancy toggle, cursor style radio group.
  > - **Terminal**: shell path input, scrollback lines input, copy-on-select toggle, bell mode radio group, environment variable editor (key-value pairs).
  > - **AI**: detect CLI toggle, block mode toggle, streaming throttle slider.
  > - **Git**: enabled toggle, auto-fetch interval input, show diff toggle.
  > - **Keybindings**: table of all shortcuts with editable hotkey inputs.
  >
  > All changes update the Zustand config store and call `update_config` Tauri command to persist. Changes apply live (no restart needed). Use shadcn/ui form components throughout. Verify the panel opens, changes persist across restarts.

---

## Phase 3: AI-First Features

**Goal**: Implement intelligent AI output handling, CLI detection, and agent-aware UI elements.

### Tasks

- [ ] **3.1 — Implement AI output block detection**

  > **Prompt**: Create `src/lib/ai-block-detector.ts` — a module that analyzes terminal output streams to detect AI CLI output boundaries. Implement heuristics for:
  > - **Claude Code**: Detect the `╭─` / `╰─` box-drawing boundaries, `Claude` header markers, and thinking indicators.
  > - **Codex CLI**: Detect Codex prompt markers, tool-use blocks, and code output fences.
  > - **Generic**: Detect markdown-style code fences, long unbroken text blocks (>20 lines without shell prompt), and ANSI sequences common to AI CLIs.
  >
  > Define `AIBlock = { id: string, cliType: string, startLine: number, endLine: number, isCollapsed: boolean, isStreaming: boolean }`. Create a `BlockTracker` class that maintains a list of detected blocks for a terminal session, updated as new output arrives. Export hooks: `useAIBlocks(sessionId: string)`.

- [ ] **3.2 — Build AI block overlay UI**

  > **Prompt**: Create `src/components/terminal/AIBlockOverlay.tsx` — an overlay rendered on top of the terminal viewport that adds visual indicators to detected AI blocks:
  > - A thin colored left-border on AI output blocks (color-coded by CLI type: blue for Claude, green for Codex, purple for Copilot).
  > - A collapse/expand toggle button at the top-right of each block.
  > - When collapsed, show a summary line: "Claude Code — 247 lines (collapsed)" with expand button.
  > - A "Copy block" button to copy the entire block content to clipboard.
  > - A "Scroll to bottom" floating button when the user scrolls up during streaming.
  >
  > The overlay must not interfere with terminal input. Use absolute positioning and pointer-events management. Verify with a mock AI output stream of 500+ lines — confirm no jank during streaming, collapse/expand works, and copy works.

- [ ] **3.3 — Implement streaming-safe rendering pipeline**

  > **Prompt**: Optimize the terminal rendering pipeline for high-throughput AI output:
  > - In `src/components/terminal/TerminalView.tsx`, implement output batching: collect all `pty-output` events in a buffer, flush to xterm.js at most every 16ms (one frame at 60fps) using `requestAnimationFrame`.
  > - Implement backpressure: if xterm.js write queue exceeds 10,000 bytes, delay the next flush by an additional frame.
  > - Add a config option `ai.streaming_throttle_ms` (default 16) to control the flush interval.
  > - When AI block mode is active and a block exceeds `ai.max_block_lines` (default 50,000), auto-collapse it and show a "Block is very large — click to expand" message.
  > - Implement virtualized scrollback: configure xterm.js `scrollback` to the user's `terminal.scrollback_lines` setting, and enable the `OverviewRulerAddon` for scrollbar minimap.
  >
  > Benchmark: pipe 100,000 lines through the terminal (e.g., `seq 100000`) and verify no frame drops, memory stays under 200MB, and the terminal remains responsive to input throughout.

- [ ] **3.4 — Build AI CLI configuration wizard**

  > **Prompt**: Create `src/components/ai/CLISetupWizard.tsx` — a step-by-step dialog that helps users configure their AI CLI tools. It should:
  > 1. **Detection step**: Scan the system PATH for known CLI binaries (`claude`, `codex`, `gh copilot`, `gemini`). Display which are found and which are missing with install links.
  > 2. **Configuration step**: For each detected CLI, show its current config status (e.g., is Claude Code authenticated? Is Codex API key set?). Provide "Open docs" links for each CLI's setup.
  > 3. **Shell integration step**: Offer to add shell aliases or PATH modifications to the user's shell profile (`.zshrc`, `.bashrc`, PowerShell profile).
  > 4. **Test step**: Run a simple test command for each CLI (e.g., `claude --version`) and show the result.
  >
  > Also implement `src-tauri/src/cli/detector.rs` — a Rust module that scans PATH for known binaries and returns their paths and versions. Expose as Tauri command `detect_ai_clis`. Trigger the wizard on first launch or via settings.

- [ ] **3.5 — Implement agent status indicator**

  > **Prompt**: Create `src/components/terminal/AgentStatus.tsx` — a small status badge shown in the tab bar and terminal bottom-right corner that indicates the current AI agent state:
  > - **Idle** (gray dot): No AI CLI is running.
  > - **Thinking** (pulsing yellow dot): AI CLI is processing (detected by output patterns like spinner characters, "Thinking..." text, or lack of output after prompt submission).
  > - **Writing** (green dot with animation): AI is actively streaming output.
  > - **Error** (red dot): AI CLI exited with non-zero code.
  > - **Waiting for input** (blue dot): AI CLI is asking for user confirmation.
  >
  > The detection is based on output pattern analysis from `ai-block-detector.ts`. Verify the status updates in real-time during a Claude Code session.

---

## Phase 4: Multi-Project Sidebar & File System

**Goal**: Build the sidebar with project navigation, file tree, and file preview/edit capabilities.

### Tasks

- [ ] **4.1 — Implement sidebar layout and project navigator**

  > **Prompt**: Create the sidebar layout in `src/components/sidebar/Sidebar.tsx`:
  > - A collapsible left panel (default width 260px, resizable via drag handle, min 200px, max 400px).
  > - `Cmd/Ctrl + B` toggles sidebar visibility.
  > - Header section: Refinex logo (from Logo.tsx) + "Projects" label + "Add project" button (folder icon).
  > - Project list: Each project shows a folder icon, project name (basename of path), and a right-click context menu (Open in terminal, Remove from sidebar, Copy path).
  > - Clicking a project sets it as `activeProject` in the sidebar store and expands its file tree.
  > - "Add project" opens a native folder picker dialog (Tauri dialog API) to select a directory.
  > - Projects are persisted in config.toml `projects.paths` array.
  >
  > Integrate the sidebar into `App.tsx` alongside the terminal area. Verify: add a project, see it in the list, click to activate, remove it.

- [ ] **4.2 — Build file tree component**

  > **Prompt**: Create `src/components/sidebar/FileTree.tsx` — a recursive tree view of the active project's file system:
  > - Implement `read_directory(path: string) -> Vec<FileEntry>` Tauri command in `src-tauri/src/fs/` that returns `{ name, path, isDirectory, isSymlink, size, modified }` entries, sorted: directories first (alphabetical), then files (alphabetical).
  > - Ignore entries matching common patterns: `.git`, `node_modules`, `.DS_Store`, `__pycache__`, `.next`, `target`, `dist`, `build` (configurable).
  > - **Lazy loading**: Only load directory contents when expanded (do not recursively read the whole tree).
  > - File type icons: Use lucide-react icons mapped by extension (`.ts`→TypeScript icon, `.rs`→Rust icon, `.md`→markdown icon, etc., with a generic file icon fallback).
  > - AI change indicators: Files modified by AI agents (tracked via `git-store` diff data) show a small dot indicator (orange for modified, green for added, red for deleted).
  > - Right-click context menu: Open in terminal, Copy path, Copy relative path, Rename, Delete.
  >
  > Verify: add a real project (e.g., the refinex-terminal repo itself), expand directories, see correct file listing, verify lazy loading.

- [ ] **4.3 — Implement file preview and editor**

  > **Prompt**: Create `src/components/sidebar/FilePreview.tsx` — when a file is clicked in the file tree:
  > - For text files (<1MB): Read the file content via Tauri command `read_file(path: string) -> String` and display in a syntax-highlighted read-only view. Use a `<pre>` block with basic syntax highlighting (detect language from extension, apply appropriate CSS classes). Show line numbers.
  > - For image files (`.png`, `.jpg`, `.gif`, `.svg`): Display inline preview.
  > - For binary/large files: Show file metadata (size, modified date) and an "Open with system editor" button.
  > - Add an "Edit" button that opens the file in an editable `<textarea>` with monospace font and line numbers. "Save" button writes back via `write_file(path: string, content: string)` Tauri command. `Cmd/Ctrl + S` saves.
  > - File preview opens as a panel that replaces the file tree area (with a breadcrumb back-nav).
  >
  > Verify: click a `.ts` file, see syntax-highlighted content, click Edit, make a change, save, re-open and verify the change persisted.

- [ ] **4.4 — Implement file system watcher**

  > **Prompt**: In `src-tauri/src/fs/watcher.rs`, implement a file system watcher using the `notify` crate:
  > - Watch the active project's directory recursively for file changes.
  > - Debounce events by 200ms to avoid rapid-fire updates.
  > - Emit Tauri events: `fs-changed` with payload `{ path: string, kind: "create" | "modify" | "remove" }`.
  > - On the frontend, listen for `fs-changed` events and update the file tree accordingly (add, update, or remove nodes) without collapsing expanded directories.
  > - When a watched project is changed/removed from the sidebar, unwatch and rewatch as needed.
  >
  > Verify: open a project, create a new file from the terminal, see it appear in the file tree within 1 second. Delete a file, see it disappear.

- [ ] **4.5 — Implement quick project switch and fuzzy file finder**

  > **Prompt**: Create two overlay components:
  > 1. `src/components/sidebar/QuickProjectSwitch.tsx` — `Cmd/Ctrl + Shift + O` opens a fuzzy-searchable list of all pinned projects. Selecting one sets it as active and opens a new terminal tab in that directory. Use the shadcn/ui `Command` component (cmdk-style).
  > 2. `src/components/sidebar/FuzzyFileFinder.tsx` — `Cmd/Ctrl + P` opens a fuzzy file finder for the active project. Implement `list_all_files(root: string, ignorePatterns: Vec<String>) -> Vec<String>` in Rust that recursively lists all files (respecting `.gitignore` via the `ignore` crate). The frontend filters results with fuzzy matching (use a simple scoring algorithm). Selecting a file opens it in the file preview panel.
  >
  > Both overlays should open centered, have keyboard navigation (arrow keys, Enter to select, Escape to close), and close automatically after selection. Verify both work with a project containing 1000+ files.

---

## Phase 5: Git Integration

**Goal**: Build a comprehensive Git integration panel using the locally installed Git binary, with status, diff, commit, push, and branch management.

### Tasks

- [ ] **5.1 — Implement Rust Git module**

  > **Prompt**: In `src-tauri/src/git/`, implement a Git operations module using the `git2` crate (Rust bindings to libgit2). Implement these functions:
  > - `git_status(repo_path: String) -> GitStatus`: Returns branch name, ahead/behind counts, staged/unstaged/untracked files with their change type.
  > - `git_diff(repo_path: String, file_path: String, staged: bool) -> String`: Returns the unified diff for a specific file (staged or unstaged).
  > - `git_log(repo_path: String, limit: u32) -> Vec<CommitInfo>`: Returns recent commits with hash, message, author, date.
  > - `git_stage(repo_path: String, paths: Vec<String>)`: Stage files.
  > - `git_unstage(repo_path: String, paths: Vec<String>)`: Unstage files.
  > - `git_commit(repo_path: String, message: String) -> String`: Create a commit, return hash.
  > - `git_push(repo_path: String) -> Result<(), String>`: Push to remote (shells out to `git push` for SSH key support).
  > - `git_pull(repo_path: String) -> Result<(), String>`: Pull from remote.
  > - `git_fetch(repo_path: String)`: Fetch from remote.
  > - `git_branches(repo_path: String) -> Vec<BranchInfo>`: List local and remote branches.
  > - `git_checkout(repo_path: String, branch: String)`: Switch branches.
  > - `git_stash(repo_path: String)` / `git_stash_pop(repo_path: String)`: Stash management.
  >
  > Expose all as Tauri commands. For operations requiring SSH auth (push, pull, fetch), shell out to the system `git` binary to leverage the user's SSH agent. Verify with `cargo check`.

- [ ] **5.2 — Build Git status panel**

  > **Prompt**: Create `src/components/git/GitPanel.tsx` — a panel in the sidebar (toggled via a Git branch icon in the sidebar header) that shows:
  > - **Branch indicator**: Current branch name with ahead/behind badge (e.g., "main ↑2 ↓1").
  > - **Staged changes** section: List of staged files with their change type icon (green + for added, blue M for modified, red - for deleted). Each file is clickable to show diff.
  > - **Unstaged changes** section: Same format. Click a file to show unstaged diff. Each file has a "+" button to stage it.
  > - **Untracked files** section: List with a "Stage all" button.
  > - **Action buttons** at the bottom: "Stage All", "Commit" (opens message input), "Push", "Pull", "Fetch", "Stash".
  > - The commit input is a text area with placeholder "Commit message..." and a "Commit" button. `Cmd/Ctrl + Enter` submits.
  > - Auto-refresh: Poll `git_status` every 5 seconds, or on `fs-changed` events from the watcher.
  >
  > Verify: make changes to a file in the active project, see them appear as unstaged, stage one, commit with a message, verify the commit is created.

- [ ] **5.3 — Build diff viewer**

  > **Prompt**: Create `src/components/git/DiffViewer.tsx` — a component that renders unified diffs with:
  > - Line numbers (old and new) in the gutter.
  > - Red background for removed lines, green background for added lines.
  > - Syntax highlighting within diff lines (basic: detect language from file extension).
  > - A toggle between "Unified" and "Split" (side-by-side) view modes.
  > - File header showing the file path and change type.
  > - "Open file" button to jump to the file in the file preview panel.
  > - "Discard changes" button for unstaged changes (with confirmation dialog).
  >
  > The diff viewer opens in the main content area (replacing the terminal temporarily, with a tab). Clicking a file in the Git panel opens it here. Verify with a file that has multiple hunks of changes.

- [ ] **5.4 — Implement branch management UI**

  > **Prompt**: Create `src/components/git/BranchManager.tsx` — a dropdown/popover triggered by clicking the branch name in the Git panel:
  > - Lists all local branches (current branch highlighted with a checkmark).
  > - Lists remote branches in a separate section.
  > - Search/filter input at the top.
  > - Click a branch to check out (with confirmation if there are uncommitted changes — offer to stash).
  > - "New branch" button: input for branch name, creates from current HEAD and checks out.
  > - "Delete branch" option in each branch's context menu (with confirmation).
  >
  > Verify: create a new branch, switch to it, make a commit, switch back to main, verify all state updates correctly.

---

## Phase 6: Keyboard Shortcuts, Command Palette & Split Panes

**Goal**: Implement power-user features for keyboard-driven workflow.

### Tasks

- [ ] **6.1 — Implement global keybinding system**

  > **Prompt**: Create `src/lib/keybinding-manager.ts`:
  > - Define a `KeybindingMap` type: `Record<string, string>` mapping key combos (e.g., "Cmd+Shift+P") to action identifiers (e.g., "command_palette").
  > - Implement a `KeybindingManager` class that:
  >   - Registers a global `keydown` event listener.
  >   - Normalizes key events to a canonical string (handling Cmd vs Ctrl for cross-platform).
  >   - Looks up the action in the current keybinding map.
  >   - Dispatches the action via a central action bus (a simple EventEmitter or Zustand store).
  > - Default keybindings are defined in `src/lib/default-keybindings.ts`.
  > - User overrides from config.toml are merged on top.
  > - Keybindings are context-aware: terminal-focused bindings vs global bindings.
  > - Ensure Ctrl+C, Ctrl+Z, Ctrl+D pass through to the terminal correctly when terminal is focused.
  >
  > Verify: open the app, press Cmd+Shift+P (should open command palette once built), press Cmd+T (should open new tab).

- [ ] **6.2 — Build command palette**

  > **Prompt**: Create `src/components/command-palette/CommandPalette.tsx` using shadcn/ui's `Command` component:
  > - Opens with `Cmd/Ctrl + Shift + P`.
  > - Lists all available actions grouped by category: Terminal, View, Git, Settings, Navigation.
  > - Each action shows its name, description, and keybinding (if any).
  > - Fuzzy search filters the list as the user types.
  > - Selecting an action executes it and closes the palette.
  > - Recent actions appear at the top.
  > - Available actions include: New Terminal, Close Terminal, Split Horizontal, Split Vertical, Toggle Sidebar, Open Settings, Toggle Full Screen, Clear Terminal, Reset Zoom, Open Folder, Git Commit, Git Push, Git Pull, Toggle Git Panel, Focus Terminal, etc.
  >
  > Verify: open palette, search "git", select "Git Push", verify it triggers the push action.

- [ ] **6.3 — Implement split panes**

  > **Prompt**: Create `src/components/terminal/SplitContainer.tsx` — a container that supports splitting the terminal area horizontally and vertically:
  > - `Cmd/Ctrl + D`: Split the active pane horizontally (side by side).
  > - `Cmd/Ctrl + Shift + D`: Split the active pane vertically (top/bottom).
  > - Each pane contains its own independent terminal session (new PTY).
  > - Panes have draggable resizable dividers.
  > - `Cmd/Ctrl + Alt + Arrow` keys to navigate between panes.
  > - Closing a pane's terminal collapses the split.
  > - Maximum 4 panes per tab.
  >
  > Use a recursive tree structure for the split layout: `SplitNode = { type: 'terminal', sessionId } | { type: 'split', direction: 'horizontal' | 'vertical', children: [SplitNode, SplitNode], ratio: number }`. Store the layout in the terminal-store per tab. Verify: create a 2x2 grid of terminals, type in each, resize dividers, close one pane, verify layout adjusts.

---

## Phase 7: Performance Optimization & Polish

**Goal**: Profile and optimize for production-quality performance, accessibility, and visual polish.

### Tasks

- [ ] **7.1 — Performance profiling and optimization**

  > **Prompt**: Profile the application and implement the following optimizations:
  > 1. **Terminal output batching**: Ensure the PTY reader thread in Rust uses a ring buffer and sends data in chunks (8KB minimum) to avoid excessive IPC overhead. Measure and log the IPC message rate.
  > 2. **React rendering**: Add `React.memo` to all components that receive stable props. Use `useMemo` and `useCallback` where appropriate in terminal, file tree, and git panel components. Verify with React DevTools Profiler that no unnecessary re-renders occur during terminal output.
  > 3. **File tree virtualization**: For projects with 10,000+ files in expanded directories, implement windowed rendering (only render visible items) using `react-window` or a manual IntersectionObserver approach.
  > 4. **Memory management**: Ensure killed PTY sessions release all resources. Test opening and closing 50 tabs in succession — verify memory returns to baseline.
  > 5. **Startup time**: Measure cold start time. Implement lazy loading for settings panel, diff viewer, and command palette (only loaded when opened). Target < 500ms to first interactive terminal on Apple Silicon.
  >
  > Document all measurements before and after optimizations in a comment at the top of this task.

- [ ] **7.2 — Window management and transparency**

  > **Prompt**: Implement window appearance features:
  > - **Opacity control**: Apply `window.setEffects()` Tauri API for macOS vibrancy (NSVisualEffectView with `.underWindowBackground`) and Windows acrylic/mica backdrop. Read opacity from config.
  > - **Full screen**: `Cmd/Ctrl + Enter` or `F11` toggles full screen via Tauri window API.
  > - **Always on top**: Toggle via command palette.
  > - **Window state persistence**: Save window position, size, and maximized state. Restore on next launch.
  > - **macOS traffic lights**: Position them correctly relative to the tab bar when `titleBarStyle: overlay` is used. Ensure they work correctly with sidebar open/closed.
  >
  > Verify: set opacity to 0.8, toggle vibrancy, verify the terminal is semi-transparent with desktop blur. Resize window, close app, reopen — verify position/size is restored.

- [ ] **7.3 — Accessibility and keyboard navigation**

  > **Prompt**: Audit and fix accessibility:
  > - All interactive elements have correct ARIA roles and labels.
  > - Focus management: Tab key navigates between sidebar, terminal, and panels in a logical order.
  > - Screen reader support: Announce tab switches, git status changes, and search results.
  > - High contrast mode: Ensure all themes meet WCAG AA contrast ratios for text.
  > - Reduced motion: Respect `prefers-reduced-motion` media query — disable animations for collapse/expand, transitions, and status indicators.
  > - Keyboard-only navigation: Verify every action can be performed without a mouse.
  >
  > Test with macOS VoiceOver and verify basic navigation works.

- [ ] **7.4 — Error handling and crash resilience**

  > **Prompt**: Implement robust error handling throughout the app:
  > - **PTY crash recovery**: If a PTY process dies unexpectedly, show a "Session ended" message in the terminal with a "Restart" button. Don't crash the whole app.
  > - **Git errors**: All git operations should show user-friendly error messages in a toast notification (use shadcn/ui's toast). Common errors: "Not a git repository", "Merge conflicts", "Authentication failed".
  > - **Config errors**: If config.toml is malformed, log the error, use defaults, and show a notification "Config file has errors — using defaults".
  > - **IPC errors**: Wrap all Tauri invoke calls in try/catch with typed error handling. Create a global error boundary component in React.
  > - **Logging**: Add `tracing` crate logging in Rust backend. Log PTY events, git operations, and config changes at debug level. Logs go to `~/.refinex/logs/`.
  >
  > Verify: kill a PTY process externally (e.g., `kill -9`), verify the app shows the error and allows restart.

---

## Phase 8: Build, Package & Release

**Goal**: Set up CI/CD, code signing, auto-updates, and produce release binaries.

### Tasks

- [ ] **8.1 — Configure CI/CD with GitHub Actions**

  > **Prompt**: Create `.github/workflows/ci.yml` that:
  > - Triggers on push to `main` and on pull requests.
  > - Matrix: macOS (ARM runner), Windows (latest).
  > - Steps: checkout, setup Rust (stable), setup Node.js (20), install pnpm, install dependencies, run `cargo check`, run `cargo clippy -- -D warnings`, run `pnpm tsc --noEmit`, run `pnpm build`, run `pnpm tauri build`.
  > - Cache: Rust target directory, pnpm store.
  > - Artifact: Upload the built binaries as GitHub Actions artifacts.
  >
  > Create `.github/workflows/release.yml` that triggers on Git tag `v*`, builds for both platforms, creates a GitHub Release with the binaries attached. Verify the CI workflow passes on a test push.

- [ ] **8.2 — Configure auto-updater**

  > **Prompt**: Enable Tauri's built-in updater plugin:
  > - Add `@tauri-apps/plugin-updater` to the project.
  > - Configure the updater endpoint to check GitHub Releases for new versions.
  > - On app launch, check for updates in the background. If a new version is available, show a non-intrusive notification "Update available: v0.2.0 — Restart to update".
  > - Implement a manual "Check for updates" action in the command palette and settings.
  > - Verify the update flow works end-to-end with a test release.

- [ ] **8.3 — macOS code signing and notarization**

  > **Prompt**: Document and configure macOS code signing:
  > - Update `src-tauri/tauri.conf.json` to include signing identity environment variables.
  > - Create a CI step that signs the `.app` bundle with a Developer ID certificate and notarizes it with Apple (using `notarytool`).
  > - If no signing identity is available (open-source builds), skip signing and document that unsigned builds require right-click > Open on first launch.
  > - Verify the signed .dmg installs cleanly without Gatekeeper warnings.

- [ ] **8.4 — Windows installer and code signing**

  > **Prompt**: Configure the Windows build:
  > - Tauri produces an `.msi` or `.nsis` installer by default. Verify it works.
  > - Configure the installer to: add a Start Menu shortcut, offer "Open Refinex Terminal here" in the Explorer context menu (via registry), and add `refinex` to PATH.
  > - If a code signing certificate is available, sign the installer. Otherwise, document the unsigned experience.
  > - Verify clean install and uninstall on a fresh Windows 10/11 VM.

- [ ] **8.5 — First release preparation**

  > **Prompt**: Prepare for v0.1.0 release:
  > - Update all version numbers: `package.json`, `Cargo.toml`, `tauri.conf.json`.
  > - Write `CHANGELOG.md` with all features in v0.1.0.
  > - Create `CONTRIBUTING.md` with: development setup, code style guidelines, PR process, issue templates.
  > - Verify README is accurate and all links work.
  > - Create GitHub issue templates (bug report, feature request).
  > - Tag the release: `git tag v0.1.0 && git push --tags`.
  > - Verify the release workflow produces binaries and publishes them.

---

## Appendix: Task Completion Protocol

After completing each task:

1. **Test**: Run the relevant verification steps described in the task prompt.
2. **Build check**: Ensure `pnpm tauri build` still succeeds with zero errors.
3. **Lint check**: Ensure `cargo clippy -- -D warnings` and `pnpm tsc --noEmit` pass.
4. **Update this file**: Change `[ ]` to `[x]` for the completed task.
5. **Commit**: Follow the commit convention in `.github/COMMIT_CONVENTION.md`.
