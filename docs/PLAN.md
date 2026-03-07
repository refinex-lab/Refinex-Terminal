# Refinex Terminal — Implementation Plan (PPLAN)

> **Purpose**: This document is the single source of truth for the entire Refinex Terminal build process, from project initialization to production release. Each phase is broken down into discrete tasks designed to be completed in a single Claude Code session. Every task includes a ready-to-use AI prompt.
>
> **Rule**: After completing each task, Claude Code **must** update this file by changing `[ ]` to `[x]` for the completed items.

---

## Phase 0: Project Initialization & Scaffolding

**Goal**: Set up the Tauri 2 + React 19 + TypeScript monorepo structure, install all dependencies, verify the app launches with an empty window on macOS and Windows.

### Tasks

- [x] **0.1 — Initialize Tauri 2 project with React frontend**

  > **Prompt**: Create a new Tauri 2 project in the current directory. Use `pnpm create tauri-app` with the following options: package name `refinex-terminal`, identifier `com.refinex.terminal`, frontend language TypeScript, frontend framework React (with Vite). After scaffolding, verify the project structure includes `src/` (frontend) and `src-tauri/` (backend). Update `src-tauri/tauri.conf.json` to set the window title to "Refinex Terminal", default size 1280x800, minSize 800x600, and `decorations: true`. Run `pnpm install` and `pnpm tauri dev` to confirm the empty app launches successfully. Fix any issues.

- [x] **0.2 — Configure TypeScript strict mode and path aliases**

  > **Prompt**: Update `tsconfig.json` to enable strict mode (`strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`). Add path aliases: `@/*` mapping to `./src/*`. Update `vite.config.ts` to resolve these path aliases. Create `src/types/index.ts` as the central type export file. Verify no TypeScript errors exist with `pnpm tsc --noEmit`.

- [x] **0.3 — Install and configure Tailwind CSS v4**

  > **Prompt**: Install Tailwind CSS v4 and its Vite plugin (`@tailwindcss/vite`). Configure `vite.config.ts` to include the Tailwind plugin. Create `src/styles/globals.css` with `@import "tailwindcss"` and any base layer customizations (reset box-sizing, smooth scrolling, custom scrollbar styles for the terminal). Import this CSS in `src/main.tsx`. Verify Tailwind utilities work by adding a test class to `App.tsx` and confirming it renders. Remove the test class after verification.

- [x] **0.4 — Install shadcn/ui and configure component library**

  > **Prompt**: Initialize shadcn/ui in the project by running the appropriate init command for the React + Vite + Tailwind v4 setup. Configure it to use the "new-york" style, slate base color, and CSS variables for theming. Install these initial components: `button`, `dialog`, `dropdown-menu`, `input`, `scroll-area`, `separator`, `tooltip`, `tabs`, `badge`, `command` (for command palette). Install `lucide-react` for icons. Verify a Button component renders correctly. Ensure all shadcn components are placed under `src/components/ui/`.

- [x] **0.5 — Install Zustand and create initial store structure**

  > **Prompt**: Install `zustand` and create the following store files under `src/stores/`:
  >
  > - `terminal-store.ts` — manages terminal sessions (tabs, active tab, PTY ids). Define types: `TerminalSession = { id: string, title: string, cwd: string, ptyId: number | null, isActive: boolean }`. Export initial empty store with actions: `addSession`, `removeSession`, `setActiveSession`, `updateSessionTitle`.
  > - `sidebar-store.ts` — manages sidebar state (open/closed, active project, file tree). Define types: `Project = { path: string, name: string }`. Export store with `isOpen`, `projects`, `activeProject`, `toggleSidebar`, `addProject`, `removeProject`, `setActiveProject`.
  > - `config-store.ts` — manages user configuration loaded from TOML. Define the `AppConfig` type matching the config.toml schema from README (appearance, terminal, ai, git, keybindings). Export store with `config`, `updateConfig`, `resetConfig`.
  > - `git-store.ts` — manages Git state. Define types: `GitStatus = { branch: string, ahead: number, behind: number, staged: FileChange[], unstaged: FileChange[], untracked: string[] }`, `FileChange = { path: string, status: 'added' | 'modified' | 'deleted' | 'renamed' }`. Export store.
  >
  > Use TypeScript strict types, no `any`. Verify all stores compile without errors.

- [x] **0.6 — Configure Tauri capabilities and permissions**

  > **Prompt**: In `src-tauri/capabilities/`, create a `default.json` capability file that grants the following permissions: shell execution (for PTY), file system read/write (scoped to user-selected project directories and the app config directory), window management, event emission/listening, path resolution, dialog (for folder picker), and clipboard access. Follow Tauri v2 capability-based permission model — only grant what is needed. Verify the app still launches after adding capabilities.

- [x] **0.7 — Set up application icons and window chrome**

  > **Prompt**: Create a minimal placeholder icon for Refinex Terminal (a simple SVG lightning bolt ⚡ in a rounded square, exported as .ico and .icns). Place the icons in `src-tauri/icons/` with the correct filenames expected by Tauri (`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`, `icon.png`). Update `src-tauri/tauri.conf.json` to reference them. On macOS, configure the window to use `titleBarStyle: "overlay"` for a native-feeling title bar with traffic lights. On Windows, use the default title bar. Add the Refinex logo as a small SVG component in `src/components/ui/Logo.tsx` that can be used in the sidebar header. Verify the app launches with the correct icon and window chrome.

- [x] **0.8 — Verify full build pipeline**

  > **Prompt**: Run `pnpm tauri build` to produce a production binary. On macOS, verify the `.dmg` or `.app` bundle is generated in `src-tauri/target/release/bundle/`. Verify the binary launches correctly, window renders, and no console errors exist. If any build warnings appear, fix them. Document the final binary size. Ensure `pnpm tsc --noEmit` passes, `pnpm build` (Vite) passes, and `cargo check` (in src-tauri) passes with zero warnings.

---

## Phase 1: Core Terminal Emulation

**Goal**: Implement a fully functional terminal emulator that can spawn a shell, handle input/output, support tabs, and render at 60fps.

### Tasks

- [x] **1.1 — Implement Rust PTY manager**

  > **Prompt**: In `src-tauri/src/pty/`, create a PTY manager module. Add `portable-pty` to Cargo.toml. Implement a `PtyManager` struct that:
  >
  > - Stores active PTY sessions in a `HashMap<u32, PtySession>` wrapped in `Arc<Mutex<>>`.
  > - `spawn(cwd: String, cols: u16, rows: u16) -> u32`: spawns a new PTY process (using the user's default shell), returns a session ID.
  > - `write(id: u32, data: Vec<u8>)`: writes data to a PTY session.
  > - `resize(id: u32, cols: u16, rows: u16)`: resizes a PTY.
  > - `kill(id: u32)`: terminates a PTY session and cleans up.
  > - Spawns a reader thread per PTY that reads output and emits Tauri events (`pty-output-{id}`) to the frontend.
  >
  > Register the PtyManager as Tauri managed state. Expose Tauri commands: `pty_spawn`, `pty_write`, `pty_resize`, `pty_kill`. Compile and verify with `cargo check`.

- [x] **1.2 — Integrate xterm.js with WebGL addon**

  > **Prompt**: Install `@xterm/xterm`, `@xterm/addon-webgl`, `@xterm/addon-fit`, `@xterm/addon-search`, `@xterm/addon-web-links`, `@xterm/addon-unicode11`. Create `src/components/terminal/TerminalView.tsx`:
  >
  > - Initialize an xterm.js `Terminal` instance with the WebGL addon for GPU rendering, fit addon for auto-resize, search addon, web-links addon, and unicode11 addon.
  > - Use a `useEffect` to open the terminal in a container div and load all addons.
  > - On mount, call the Tauri `pty_spawn` command to get a PTY session ID.
  > - Listen for `pty-output-{id}` Tauri events and write received data to xterm.
  > - On xterm `onData`, call `pty_write` to send input to the PTY.
  > - On container resize (use ResizeObserver), call `fit addon.fit()` then `pty_resize`.
  > - On unmount, call `pty_kill` and dispose xterm instance.
  >
  > Create a wrapper `src/lib/tauri-pty.ts` with typed invoke functions for all PTY commands. Verify typing `ls` in the terminal produces correct output. Verify colors and cursor work.

- [x] **1.3 — Implement tab management system**

  > **Prompt**: Create `src/components/tabs/TabBar.tsx` — a horizontal tab bar at the top of the terminal area. Each tab shows the session title (initially "Terminal 1", "Terminal 2", etc.) and a close button (X icon from lucide-react). The active tab is visually highlighted. Implement:
  >
  > - "New tab" button (`+` icon) at the end of the tab bar — calls `addSession` from terminal-store and spawns a new PTY.
  > - Click a tab to switch active session — hides other terminal views (do NOT destroy them), shows the selected one.
  > - Close button kills the PTY and removes the session from the store.
  > - `Cmd/Ctrl + T` shortcut to create new tab, `Cmd/Ctrl + W` to close current tab, `Cmd/Ctrl + 1-9` to switch tabs.
  > - Tabs are draggable to reorder (use a simple drag handler, no external lib needed).
  >
  > Update `App.tsx` to compose TabBar above a TerminalView area. Verify multi-tab workflow: open 3 tabs, type different commands in each, switch between them, close one, verify others are intact.

- [x] **1.4 — Handle shell detection and environment setup**

  > **Prompt**: In `src-tauri/src/pty/shell.rs`, implement shell detection logic:
  >
  > - macOS: Read `$SHELL` env var, fallback to `/bin/zsh`, then `/bin/bash`.
  > - Windows: Try `powershell.exe`, fallback to `cmd.exe`.
  > - When spawning a PTY, inject the user's `PATH`, `HOME`, `LANG=en_US.UTF-8`, and `TERM=xterm-256color` into the environment.
  > - Support a config option to override the shell path (read from config.toml `terminal.shell` field).
  > - Detect and set correct `TERM_PROGRAM=RefinexTerminal` and `TERM_PROGRAM_VERSION` env vars so CLI tools can detect they're running inside Refinex.
  >
  > Verify that on macOS, zsh launches with correct prompt, and on Windows, PowerShell launches correctly. Verify `echo $TERM` outputs `xterm-256color`.

- [x] **1.5 — Implement terminal search**

  > **Prompt**: Create `src/components/terminal/TerminalSearch.tsx` — a search overlay that appears when `Cmd/Ctrl + F` is pressed while a terminal is focused. It should have:
  >
  > - A text input for the search query.
  > - "Previous" and "Next" navigation buttons (with up/down arrow icons).
  > - A "Match case" toggle and "Regex" toggle.
  > - Uses xterm.js `SearchAddon` to highlight matches and navigate.
  > - `Escape` closes the search bar.
  > - Display match count (e.g., "3 of 12").
  >
  > Verify: type a command with repeated output (e.g., `cat` a file), open search, type a term, verify highlights appear and navigation works.

- [x] **1.6 — Implement copy/paste and selection**

  > **Prompt**: Configure xterm.js to support:
  >
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

- [x] **2.1 — Implement Rust config manager**

  > **Prompt**: In `src-tauri/src/config/`, create a configuration module. Add `toml` and `serde` to Cargo.toml. Define Rust structs mirroring the `config.toml` schema (AppConfig, Appearance, Terminal, AI, Git, Keybindings — all with `#[derive(Serialize, Deserialize, Clone, Default)]`). Implement:
  >
  > - `load_config(path: PathBuf) -> AppConfig`: reads and parses TOML, returns defaults for missing fields.
  > - `save_config(config: &AppConfig, path: PathBuf)`: serializes to TOML and writes.
  > - `get_config_path() -> PathBuf`: returns platform-specific config directory.
  > - `watch_config(path: PathBuf, tx: Sender)`: uses `notify` crate to watch the config file for external changes and emit updates.
  >
  > Expose Tauri commands: `get_config`, `update_config`, `reset_config`, `get_config_path`. On app startup, load config and inject into managed state. Verify with `cargo check`.

- [x] **2.2 — Build theme engine**

  > **Prompt**: Create `src/lib/theme-engine.ts` that:
  >
  > - Defines a `Theme` type with all terminal colors (background, foreground, cursor, selection, ansi 0-15, plus UI colors for sidebar, tabs, borders).
  > - Implements `applyTheme(theme: Theme)` which sets CSS custom properties on `:root`.
  > - Implements `loadBuiltinTheme(name: string)` which imports from `themes/` directory.
  > - Implements `loadCustomTheme(path: string)` which calls a Tauri command to read the TOML file.
  >
  > Create 5 built-in themes as TOML files in `themes/`: `refinex-dark.toml` (default — deep blue-gray), `refinex-light.toml`, `tokyo-night.toml`, `catppuccin-mocha.toml`, `github-dark.toml`. Each theme must define all required color fields. Apply the theme to both xterm.js options and the UI CSS variables. Verify theme switching works live without restart.

- [x] **2.3 — Implement font management**

  > **Prompt**: Create `src/lib/font-manager.ts` that:
  >
  > - Queries available system fonts via a Tauri command (implement `list_fonts` in Rust using the `font-kit` crate or by reading system font directories).
  > - Provides `applyFont(family: string, size: number, lineHeight: number, ligatures: boolean)` which updates xterm.js terminal options and UI CSS.
  > - Validates that the requested font exists, falling back to `"JetBrains Mono", "Fira Code", "Cascadia Code", monospace`.
  > - Handles dynamic font size changes (Cmd/Ctrl + Plus/Minus to zoom, Cmd/Ctrl + 0 to reset).
  >
  > Verify font changes apply immediately to the terminal without reconnecting the PTY.

- [x] **2.4 — Create settings UI panel**

  > **Prompt**: Create `src/components/settings/SettingsPanel.tsx` — a full-screen modal (triggered by `Cmd/Ctrl + ,`) with a left-nav sidebar containing sections: Appearance, Terminal, AI, Git, Keybindings. Each section renders form controls:
  >
  > - **Appearance**: theme dropdown, font family dropdown, font size slider, line height slider, ligatures toggle, opacity slider, vibrancy toggle, cursor style radio group.
  > - **Terminal**: shell path input, scrollback lines input, copy-on-select toggle, bell mode radio group, environment variable editor (key-value pairs).
  > - **AI**: detect CLI toggle, block mode toggle, streaming throttle slider.
  > - **Git**: enabled toggle, auto-fetch interval input, show diff toggle.
  > - **Keybindings**: table of all shortcuts with editable hotkey inputs.
  >
  > All changes update the Zustand config store and call `update_config` Tauri command to persist. Changes apply live (no restart needed). Use shadcn/ui form components throughout. Verify the panel opens, changes persist across restarts.

---

# Phase 3: AI-First Features

**Goal**: 实现智能 AI 输出处理、CLI 检测、Agent 感知 UI 元素。

**支持的 AI CLI 工具**(精确到二进制名与包名):

| CLI 工具           | 二进制/命令名          | npm 包名                                             | 官方仓库                                                                | 官方安装文档                                                                                                           |
| ------------------ | ---------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Claude Code        | `claude`               | `@anthropic-ai/claude-code` (已废弃，改用原生二进制) | [anthropics/claude-code](https://github.com/anthropics/claude-code)     | [code.claude.com/docs/en/setup](https://code.claude.com/docs/en/setup)                                                 |
| Codex CLI          | `codex`                | — (Rust 二进制，通过 GitHub Releases 分发)           | [openai/codex](https://github.com/openai/codex)                         | [github.com/openai/codex/blob/main/codex-cli/README.md](https://github.com/openai/codex/blob/main/codex-cli/README.md) |
| Gemini CLI         | `gemini`               | `@google/gemini-cli`                                 | [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli) | [github.com/google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli)                                     |
| GitHub Copilot CLI | `gh copilot` (gh 扩展) | — (gh extension)                                     | [github/gh-copilot](https://github.com/github/gh-copilot)               | [docs.github.com/en/copilot/github-copilot-in-the-cli](https://docs.github.com/en/copilot/github-copilot-in-the-cli)   |

---

## 3.1 — AI 输出块检测 (`src/lib/ai-block-detector.ts`)

### 数据结构

```typescript
interface AIBlock {
  id: string; // 唯一标识，uuid
  cliType: "claude" | "codex" | "gemini" | "copilot" | "generic";
  startLine: number; // 块起始行号（终端 buffer 行号）
  endLine: number; // 块结束行号（-1 表示仍在流式输出）
  isCollapsed: boolean;
  isStreaming: boolean; // 块尚未关闭
  blockKind:
    | "message"
    | "thinking"
    | "tool_call"
    | "approval_request"
    | "plan"
    | "diff"
    | "generic";
}
```

### 3.1.1 Claude Code 块检测规则

**来源**: Claude Code 使用 Ink (React for CLI) 渲染终端 UI，输出使用 Unicode 圆角 box-drawing 字符绘制边框。

**块边界检测**:

| 规则 ID  | 模式       | 正则表达式 | 说明                                                            |
| -------- | ---------- | ---------- | --------------------------------------------------------------- |
| CC-START | 圆角上边框 | `/^╭─/`    | 块起始：行首为 `╭` + `─`，这是 Claude Code 所有输出框的顶部边界 |
| CC-END   | 圆角下边框 | `/^╰─/`    | 块结束：行首为 `╰` + `─`，这是 Claude Code 输出框的底部边界     |
| CC-BODY  | 左侧竖线   | `/^│\s/`   | 块体内容行：行首为 `│` + 空格                                   |

**CLI 身份识别** (确认当前进程是 Claude Code):

| 规则 ID | 模式       | 正则表达式                           | 说明                              |
| ------- | ---------- | ------------------------------------ | --------------------------------- |
| CC-ID-1 | 进程名匹配 | 检测 PTY 子进程名是否为 `claude`     | 最可靠的识别方式                  |
| CC-ID-2 | 头部标记   | `/Claude\s+Code/` 或 `/claude\s+>/i` | 启动时 Claude Code 会打印品牌标识 |
| CC-ID-3 | 版本输出   | `/Claude Code CLI version/`          | `claude --version` 的输出格式     |

**Thinking 状态检测**:

Claude Code 在思考时并不输出纯文本 "Thinking..."，而是在 box 框内使用 ANSI spinner 动画 + 光标控制序列。检测方式:

| 规则 ID    | 模式                                                                          | 说明                    |
| ---------- | ----------------------------------------------------------------------------- | ----------------------- |
| CC-THINK-1 | 块已打开（检测到 `╭─`）但尚未收到 `╰─` 关闭，且最近 2 秒内无新可见文本输出    | 推断为 thinking 状态    |
| CC-THINK-2 | 检测连续的 ANSI 光标移动序列 (`\x1b[?25l`, `\x1b[A`, `\x1b[K`) 且无可打印字符 | Ink 的 spinner 重绘特征 |

### 3.1.2 Codex CLI 块检测规则

**来源**: Codex CLI 是 Rust 编写的 TUI 应用 (仓库 `openai/codex`)。其终端输出通过 `owo-colors` 进行着色，使用特定的文本标记和颜色方案来区分不同类型的输出。**Codex 不使用 box-drawing 字符绘制边框**，而是使用带时间戳的结构化文本行。

**块边界检测** (基于 `codex-rs/exec/src/event_processor_with_human_output.rs` 源码):

| 规则 ID       | 模式         | 正则表达式                                                     | 说明                                                   |
| ------------- | ------------ | -------------------------------------------------------------- | ------------------------------------------------------ |
| CX-SESSION    | 会话开始     | `/codex session\s+[0-9a-f-]+/`                                 | 带品红色的 "codex session" + UUID，标志会话开始        |
| CX-MODEL      | 模型声明     | `/^model:\s+\S+/`                                              | 紧随会话标记后的模型名声明行                           |
| CX-THINKING   | 思考块       | `/^thinking$/` (品红+斜体样式)                                 | AgentReasoning 事件输出，以斜体品红 "thinking" 为标记  |
| CX-PLAN       | 计划更新     | `/^Plan update$/` (品红色)                                     | 后续行以 `✓`(绿)/ `→`(青)/ `•`(灰) 开头的步骤列表      |
| CX-EXEC-START | 命令执行开始 | 检测 ANSI 着色的命令行，通常为灰色或青色的 shell 命令文本      | ExecCommandBegin 事件                                  |
| CX-EXEC-END   | 命令执行结束 | `/exited \d+( in .+)?:/`                                       | 如 `apply_patch(auto_approved=true) exited 0 in 1.2s:` |
| CX-DIFF       | 差异输出     | `/^file update:/` (品红+斜体)                                  | TurnDiff 事件，后续行为 unified diff 格式              |
| CX-APPROVAL   | 审批请求     | 检测到 `ExecApprovalRequest` 模式：显示命令内容 + 等待用户确认 | 用户输入等待状态                                       |
| CX-MESSAGE    | Agent 消息   | 非以上任何标记的连续文本输出块                                 | AgentMessage 事件                                      |

**CLI 身份识别**:

| 规则 ID | 模式       | 说明                                          |
| ------- | ---------- | --------------------------------------------- |
| CX-ID-1 | 进程名匹配 | 检测 PTY 子进程名是否为 `codex`               |
| CX-ID-2 | 会话标记   | 检测到 `codex session` + UUID 模式            |
| CX-ID-3 | 版本输出   | `codex --version` 输出含 Codex CLI 版本字符串 |

**状态检测**:

| 状态                 | 检测方式                                                  |
| -------------------- | --------------------------------------------------------- |
| Thinking             | 出现 "thinking" 斜体标记行（AgentReasoning 事件）         |
| Writing              | 持续接收到新行输出（AgentMessage/AgentMessageDelta 事件） |
| Waiting for approval | 出现 ExecApprovalRequest 模式后无后续输出                 |
| Executing tool       | 出现命令执行开始但未出现执行结束标记                      |

### 3.1.3 Gemini CLI 块检测规则

**来源**: Gemini CLI 使用 Ink (React for CLI) 渲染，与 Claude Code 类似使用 `╭─` / `╰─` 圆角 box-drawing 字符。但关键区别：**Gemini CLI 的 box 边框用于包裹工具调用 (tool call) 结果**，而非整个 Agent 回复。

**块边界检测** (基于 `google-gemini/gemini-cli` 源码快照):

| 规则 ID          | 模式       | 正则表达式                     | 说明                 |
| ---------------- | ---------- | ------------------------------ | -------------------- | ---------- | -------------------------------------------------- |
| GM-TOOLBOX-START | 工具框顶部 | `/^╭─+╮$/`                     | 工具调用结果的上边框 |
| GM-TOOLBOX-END   | 工具框底部 | `/^╰─+╯$/`                     | 工具调用结果的下边框 |
| GM-TOOLBOX-BODY  | 工具框内容 | `/^│\s/`                       | 框内行首 `│`         |
| GM-TOOL-HEADER   | 工具名标记 | `/^│\s+(✓                      | x                    | ⊶)\s+\S+/` | 框内工具状态指示符：`✓` 成功、`x` 失败、`⊶` 执行中 |
| GM-SEPARATOR     | 框内分隔线 | `/^│─+│$/` 或 `/^──+$/` (框内) | sticky header 分隔线 |

**CLI 身份识别**:

| 规则 ID | 模式      | 正则表达式              | 说明                                    |
| ------- | --------- | ----------------------- | --------------------------------------- |
| GM-ID-1 | 进程名    | PTY 子进程名为 `gemini` | 最可靠                                  |
| GM-ID-2 | 品牌 Logo | `/▝▜▄\s+Gemini CLI/`    | Gemini CLI 启动时的 ASCII art logo 标识 |
| GM-ID-3 | 版本      | `/Gemini CLI v[\d.]+/`  | 品牌 logo 旁的版本号                    |

**状态检测** (基于 `StreamingState` 枚举和 `LoadingIndicator` 组件源码):

| 状态                   | 检测方式                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| Idle                   | 无 spinner 输出，用户输入提示符可见                                                                |
| Thinking/Responding    | spinner 动画活跃 (`dots` 类型的 Braille spinner: `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`)，可能伴随 `💬` emoji 和思考主题文字 |
| WaitingForConfirmation | 静态字符 `⠏` 显示，并且出现确认提示文本                                                            |
| Executing tool         | 工具框 (`╭─╮`) 已打开，内部显示 `⊶` + 工具名 + "Running command..." / "Searching..." 等文字        |
| Error                  | 工具框内出现 `x` 状态指示符                                                                        |

**Gemini CLI 与 Claude Code 的 box 区分**:

两者都使用 `╭─` / `╰─`，通过以下方式区分:

1. **优先检测 CLI 进程名** (`gemini` vs `claude`)
2. **Gemini 特有标识**: 框内出现 `✓` / `x` / `⊶` 工具状态指示符
3. **Gemini ASCII Logo**: `▝▜▄` 字符序列

### 3.1.4 GitHub Copilot CLI 块检测规则

**来源**: GitHub Copilot CLI 是 `gh` CLI 的扩展 (`github/gh-copilot`)，通过 `gh copilot suggest` 和 `gh copilot explain` 子命令工作。其输出格式相对简单，主要是纯文本 + 交互式选择器。

**块边界检测**:

| 规则 ID      | 模式     | 正则表达式                                   | 说明                    |
| ------------ | -------- | -------------------------------------------- | ----------------------- | ----------- | -------- | ---------- | ---------------------------- |
| GC-SUGGEST   | 建议标记 | `/^▸\s+Suggestion/` 或 `/^▸\s+/`             | Copilot 建议块起始      |
| GC-EXPLAIN   | 解释标记 | `/^▸\s+Explanation/`                         | 解释结果块起始          |
| GC-SEPARATOR | 分隔线   | `/^-{20,}$/`                                 | 代码/文本块的上下分隔线 |
| GC-ACTION    | 操作栏   | `/^\[Accept\]                                | \[Next                  | \[Explain\] | \[Quit\] | \[Done\]/` | 交互操作行，也作为块结束标记 |
| GC-END       | 块结束   | 遇到下一个 `▸` 标记或 shell 提示符 `$` / `>` | 块结束                  |

**CLI 身份识别**:

| 规则 ID | 模式     | 说明                                             |
| ------- | -------- | ------------------------------------------------ |
| GC-ID-1 | 进程名   | PTY 子进程树中包含 `gh` 且参数含 `copilot`       |
| GC-ID-2 | 扩展标记 | 输出中包含 `gh copilot` 或 `GitHub Copilot` 字样 |

### 3.1.5 通用 (Generic) 块检测规则

当无法确认具体 CLI 类型时的回退检测:

| 规则 ID       | 模式              | 正则表达式                                                     | 说明                          |
| ------------- | ----------------- | -------------------------------------------------------------- | ----------------------------- |
| GN-FENCE      | Markdown 代码围栏 | `/^```\w*$/`                                                   | 匹配开始和结束的 ``` 围栏     |
| GN-LONGBLOCK  | 长文本块          | 连续 >20 行无 shell 提示符 (`$`, `>`, `#`, `%`) 的输出         | 可能是 AI 输出                |
| GN-ANSI-HEAVY | ANSI 密集段       | 短时间内 ANSI 转义序列 (`\x1b[`) 的密度显著高于正常 shell 使用 | AI CLI 通常重度使用 ANSI 着色 |

### 3.1.6 BlockTracker 类

```typescript
class BlockTracker {
  private blocks: Map<string, AIBlock> = new Map();
  private activeCLI: AIBlock["cliType"] | null = null;

  /**
   * 在每次新的 PTY 输出到达时调用。
   * @param sessionId - 终端会话 ID
   * @param lineNumber - 当前行号
   * @param lineContent - 行的纯文本内容（已剥离 ANSI）
   * @param rawContent - 行的原始内容（含 ANSI）
   */
  processLine(
    sessionId: string,
    lineNumber: number,
    lineContent: string,
    rawContent: string,
  ): void;

  /** 获取当前会话的所有检测到的块 */
  getBlocks(): AIBlock[];

  /** 获取当前活跃（正在流式输出）的块 */
  getStreamingBlock(): AIBlock | null;

  /** 通过进程名设置当前 CLI 类型（最可靠） */
  setActiveCLI(cliType: AIBlock["cliType"]): void;
}
```

**检测优先级**: 进程名检测 > 品牌标识检测 > 块边界模式检测 > 通用回退

**导出 Hook**:

```typescript
function useAIBlocks(sessionId: string): {
  blocks: AIBlock[];
  streamingBlock: AIBlock | null;
  activeCLI: AIBlock["cliType"] | null;
};
```

---

## 3.2 — AI 块覆盖 UI (`src/components/terminal/AIBlockOverlay.tsx`)

在终端视口上方渲染覆盖层，为检测到的 AI 块添加视觉指示:

**颜色编码** (严格绑定 CLI 类型):

| CLI 类型    | 左边框颜色                   | 色值      |
| ----------- | ---------------------------- | --------- |
| Claude Code | 橙色 (Anthropic 品牌色)      | `#D97706` |
| Codex CLI   | 绿色 (OpenAI 品牌色)         | `#10A37F` |
| Gemini CLI  | 蓝色 (Google 品牌色)         | `#4285F4` |
| Copilot CLI | 紫色 (GitHub Copilot 品牌色) | `#8B5CF6` |
| Generic     | 灰色                         | `#6B7280` |

**功能要求**:

- 每个块左侧 3px 宽的颜色条
- 块右上角折叠/展开按钮
- 折叠状态显示: `"{CLI名称} — {行数} lines (collapsed)"` + 展开按钮
- "Copy block" 按钮复制整块内容到剪贴板
- 流式输出时用户向上滚动后显示 "Scroll to bottom" 浮动按钮
- 覆盖层不得拦截终端输入事件 (`pointer-events: none`，仅按钮区域设为 `pointer-events: auto`)

**验证**: 使用 500+ 行的模拟 AI 输出流，确认流式输出期间无卡顿，折叠/展开正常，复制功能正常。

---

## 3.3 — 流式安全渲染管线

在 `src/components/terminal/TerminalView.tsx` 中优化终端渲染:

- **输出批处理**: 收集所有 `pty-output` 事件到缓冲区，使用 `requestAnimationFrame` 以最多每 16ms（60fps 一帧）刷新到 xterm.js
- **背压控制**: 当 xterm.js 写入队列超过 10,000 字节时，延迟一帧再刷新
- **配置项**: `ai.streaming_throttle_ms`（默认 16）控制刷新间隔
- **超大块自动折叠**: 当 AI block 模式激活且块超过 `ai.max_block_lines`（默认 50,000）行时，自动折叠并显示 "Block is very large — click to expand"
- **虚拟化回滚**: 配置 xterm.js `scrollback` 为用户的 `terminal.scrollback_lines` 设置，启用 `OverviewRulerAddon` 作为滚动条缩略图

**基准测试**: 通过终端 pipe 100,000 行（`seq 100000`），验证无丢帧，内存 < 200MB，终端始终响应输入。

---

## 3.4 — AI CLI 配置向导

### 3.4.1 前端: `src/components/ai/CLISetupWizard.tsx`

**步骤 1: 检测 (Detection)**

调用 Tauri 命令 `detect_ai_clis`，展示结果表格:

| CLI 工具    | 状态                  | 路径                    | 版本    | 安装链接                                                             |
| ----------- | --------------------- | ----------------------- | ------- | -------------------------------------------------------------------- |
| Claude Code | ✅ 已安装 / ❌ 未找到 | `/usr/local/bin/claude` | `2.1.x` | [安装](https://code.claude.com/docs/en/setup)                        |
| Codex CLI   | ✅ / ❌               | `/usr/local/bin/codex`  | `0.x.x` | [安装](https://github.com/openai/codex)                              |
| Gemini CLI  | ✅ / ❌               | `~/.npm/.../gemini`     | `1.x.x` | [安装](https://github.com/google-gemini/gemini-cli)                  |
| Copilot CLI | ✅ / ❌               | (gh extension)          | `1.x.x` | [安装](https://docs.github.com/en/copilot/github-copilot-in-the-cli) |

**步骤 2: 配置 (Configuration)**

针对每个已检测到的 CLI 展示认证状态与配置指引:

| CLI 工具    | 认证检测方式                                                    | 所需环境变量/配置                                                 | 文档链接                                                                           |
| ----------- | --------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Claude Code | 运行 `claude doctor`，检查退出码与输出                          | `ANTHROPIC_API_KEY` 或 OAuth 登录 (`~/.claude/` 目录下的凭据文件) | [code.claude.com/docs/en/setup](https://code.claude.com/docs/en/setup)             |
| Codex CLI   | 运行 `codex login --status` 或检查 `~/.codex/` 下的凭据         | `OPENAI_API_KEY` 或 OpenAI OAuth                                  | [github.com/openai/codex](https://github.com/openai/codex)                         |
| Gemini CLI  | 检查 `GEMINI_API_KEY` 环境变量，或 `~/.gemini/` 下的 OAuth 凭据 | `GEMINI_API_KEY` 或 Google OAuth                                  | [github.com/google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli) |
| Copilot CLI | 运行 `gh auth status`，检查 GitHub 认证状态                     | GitHub CLI 已认证 (`gh auth login`)                               | [docs.github.com](https://docs.github.com/en/copilot/github-copilot-in-the-cli)    |

**步骤 3: Shell 集成 (Shell Integration)**

提供选项将路径/别名添加到 shell 配置文件 (`.zshrc`, `.bashrc`, PowerShell `$PROFILE`)。

**步骤 4: 测试 (Test)**

对每个 CLI 运行测试命令并显示结果:

| CLI 工具    | 测试命令               | 成功判断               |
| ----------- | ---------------------- | ---------------------- |
| Claude Code | `claude --version`     | 退出码 0，输出含版本号 |
| Codex CLI   | `codex --version`      | 退出码 0，输出含版本号 |
| Gemini CLI  | `gemini --version`     | 退出码 0，输出含版本号 |
| Copilot CLI | `gh copilot --version` | 退出码 0，输出含版本号 |

### 3.4.2 后端: `src-tauri/src/cli/detector.rs`

```rust
/// 单个 AI CLI 的检测结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CLIDetectionResult {
    pub name: String,           // "claude" | "codex" | "gemini" | "gh-copilot"
    pub found: bool,
    pub path: Option<String>,   // 二进制完整路径
    pub version: Option<String>,
    pub authenticated: Option<bool>,
    pub error: Option<String>,
}
```

**检测逻辑** (Rust, 暴露为 Tauri command `detect_ai_clis`):

```rust
// 检测策略（按 CLI）:
//
// 1. Claude Code:
//    - 搜索 PATH 中的 `claude` 二进制
//    - 备选: 检查 ~/.claude/bin/claude (原生安装默认路径)
//    - 版本: 执行 `claude --version`
//    - 认证: 检查 ~/.claude/ 目录下是否存在凭据文件
//
// 2. Codex CLI:
//    - 搜索 PATH 中的 `codex` 二进制
//    - 版本: 执行 `codex --version`
//    - 认证: 检查 OPENAI_API_KEY 环境变量或 ~/.codex/ 下凭据
//
// 3. Gemini CLI:
//    - 搜索 PATH 中的 `gemini` 二进制
//    - 备选: npm global bin 目录下查找
//    - 版本: 执行 `gemini --version`
//    - 认证: 检查 GEMINI_API_KEY 环境变量或 ~/.gemini/ 下凭据
//
// 4. GitHub Copilot CLI:
//    - 先检测 `gh` 是否在 PATH 中
//    - 再执行 `gh extension list` 检查是否包含 `github/gh-copilot`
//    - 版本: 执行 `gh copilot --version`
//    - 认证: 执行 `gh auth status` 检查退出码
```

在首次启动或通过设置触发向导。

---

## 3.5 — Agent 状态指示器 (`src/components/terminal/AgentStatus.tsx`)

在标签栏和终端右下角显示状态徽标:

### 状态定义与检测规则

| 状态                  | 显示     | 颜色      | 动画                      |
| --------------------- | -------- | --------- | ------------------------- |
| **Idle**              | 灰色圆点 | `#6B7280` | 无                        |
| **Thinking**          | 黄色圆点 | `#EAB308` | 脉冲动画 (pulse)          |
| **Writing**           | 绿色圆点 | `#22C55E` | 流式动画 (streaming dots) |
| **Error**             | 红色圆点 | `#EF4444` | 无                        |
| **Waiting for input** | 蓝色圆点 | `#3B82F6` | 闪烁 (blink)              |

### 每个 CLI 的状态推断规则

**Claude Code**:

| 目标状态          | 检测条件                                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Idle              | `claude` 进程存在但无 box 块打开，无输出活动                                                                                 |
| Thinking          | 检测到 `╭─` 块打开后 >1.5 秒无可见文本输出（仅有 ANSI 光标控制序列）；或 Ink spinner 的 Braille 字符 (`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`) 循环出现 |
| Writing           | 检测到 `╭─` 块打开后，持续接收到可见文本内容（排除 ANSI 控制序列）                                                           |
| Error             | `claude` 进程以非零退出码退出                                                                                                |
| Waiting for input | 块已关闭（`╰─` 出现），且出现输入提示符（`claude >`）或 `[Y/n]` 样式的确认提示                                               |

**Codex CLI**:

| 目标状态          | 检测条件                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| Idle              | `codex` 进程存在，输出含 `codex session` 标记但当前无活跃 turn                                 |
| Thinking          | 输出中出现品红色斜体 `thinking` 标记行（AgentReasoning 事件）                                  |
| Writing           | 持续接收 AgentMessage 文本输出（非 thinking、非命令执行）                                      |
| Error             | `codex` 进程非零退出，或输出中出现 `Error` 事件标记                                            |
| Waiting for input | 出现 ExecApprovalRequest 模式（命令 + 等待审批）；或出现 Plan 模式下的 `RequestUserInput` 提示 |

**Gemini CLI**:

| 目标状态          | 检测条件                                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Idle              | 检测到 Gemini Logo (`▝▜▄`) 后无 spinner 活动                                                                                        |
| Thinking          | 检测到 Ink `dots` spinner 的 Braille 字符循环 (`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`)，可能伴随 `💬` emoji 和思考主题文本，以及 "(esc to cancel, Ns)" 倒计时 |
| Writing           | 工具框内容持续增长，或工具框外接收到持续的 markdown 文本流                                                                          |
| Error             | 工具框内出现 `x` 状态指示符，或 `gemini` 进程非零退出                                                                               |
| Waiting for input | 检测到静态 `⠏` 字符（`WaitingForConfirmation` 状态的非响应显示），伴随确认提示文本                                                  |

**Copilot CLI**:

| 目标状态          | 检测条件                                                         |
| ----------------- | ---------------------------------------------------------------- |
| Idle              | `gh` 进程存在但无 Copilot 相关输出                               |
| Thinking          | 出现 `▸ Suggestion` 标记但内容尚未完成输出                       |
| Writing           | `▸` 标记后持续接收文本内容                                       |
| Error             | `gh copilot` 命令非零退出                                        |
| Waiting for input | 出现 `[Accept]` / `[Next Suggestion]` / `[Explain]` 等交互选项行 |

### 状态更新机制

```typescript
// 由 ai-block-detector.ts 的 BlockTracker 驱动
// 每次 processLine 后重新计算当前 agent 状态
function deriveAgentStatus(
  tracker: BlockTracker,
  processInfo: { exitCode?: number; isRunning: boolean },
): AgentStatusType {
  if (!processInfo.isRunning) {
    return processInfo.exitCode !== 0 ? "error" : "idle";
  }
  // ... 基于上表规则推断
}
```

验证: 在实际 Claude Code / Codex CLI / Gemini CLI 会话中确认状态实时更新

---

## Phase 4: Multi-Project Sidebar & File System

**Goal**: Build the sidebar with project navigation, file tree, and file preview/edit capabilities.

### Tasks

- [x] **4.1 — Implement sidebar layout and project navigator**

  > **Prompt**: Create the sidebar layout in `src/components/sidebar/Sidebar.tsx`:
  >
  > - A collapsible left panel (default width 260px, resizable via drag handle, min 200px, max 400px).
  > - `Cmd/Ctrl + B` toggles sidebar visibility.
  > - Header section: Refinex logo (from Logo.tsx) + "Projects" label + "Add project" button (folder icon).
  > - Project list: Each project shows a folder icon, project name (basename of path), and a right-click context menu (Open in terminal, Remove from sidebar, Copy path).
  > - Clicking a project sets it as `activeProject` in the sidebar store and expands its file tree.
  > - "Add project" opens a native folder picker dialog (Tauri dialog API) to select a directory.
  > - Projects are persisted in config.toml `projects.paths` array.
  >
  > Integrate the sidebar into `App.tsx` alongside the terminal area. Verify: add a project, see it in the list, click to activate, remove it.

- [x] **4.2 — Build file tree component**

  > **Prompt**: Create `src/components/sidebar/FileTree.tsx` — a recursive tree view of the active project's file system:
  >
  > - Implement `read_directory(path: string) -> Vec<FileEntry>` Tauri command in `src-tauri/src/fs/` that returns `{ name, path, isDirectory, isSymlink, size, modified }` entries, sorted: directories first (alphabetical), then files (alphabetical).
  > - Ignore entries matching common patterns: `.git`, `node_modules`, `.DS_Store`, `__pycache__`, `.next`, `target`, `dist`, `build` (configurable).
  > - **Lazy loading**: Only load directory contents when expanded (do not recursively read the whole tree).
  > - File type icons: Use lucide-react icons mapped by extension (`.ts`→TypeScript icon, `.rs`→Rust icon, `.md`→markdown icon, etc., with a generic file icon fallback).
  > - AI change indicators: Files modified by AI agents (tracked via `git-store` diff data) show a small dot indicator (orange for modified, green for added, red for deleted).
  > - Right-click context menu: Open in terminal, Copy path, Copy relative path, Rename, Delete.
  >
  > Verify: add a real project (e.g., the refinex-terminal repo itself), expand directories, see correct file listing, verify lazy loading.

- [x] **4.3 — Implement file preview and editor**

  > **Prompt**: Create `src/components/sidebar/FilePreview.tsx` — when a file is clicked in the file tree:
  >
  > - For text files (<1MB): Read the file content via Tauri command `read_file(path: string) -> String` and display in a syntax-highlighted read-only view. Use a `<pre>` block with basic syntax highlighting (detect language from extension, apply appropriate CSS classes). Show line numbers.
  > - For image files (`.png`, `.jpg`, `.gif`, `.svg`): Display inline preview.
  > - For binary/large files: Show file metadata (size, modified date) and an "Open with system editor" button.
  > - Add an "Edit" button that opens the file in an editable `<textarea>` with monospace font and line numbers. "Save" button writes back via `write_file(path: string, content: string)` Tauri command. `Cmd/Ctrl + S` saves.
  > - File preview opens as a panel that replaces the file tree area (with a breadcrumb back-nav).
  >
  > Verify: click a `.ts` file, see syntax-highlighted content, click Edit, make a change, save, re-open and verify the change persisted.

- [x] **4.4 — Implement file system watcher**

  > **Prompt**: In `src-tauri/src/fs/watcher.rs`, implement a file system watcher using the `notify` crate:
  >
  > - Watch the active project's directory recursively for file changes.
  > - Debounce events by 200ms to avoid rapid-fire updates.
  > - Emit Tauri events: `fs-changed` with payload `{ path: string, kind: "create" | "modify" | "remove" }`.
  > - On the frontend, listen for `fs-changed` events and update the file tree accordingly (add, update, or remove nodes) without collapsing expanded directories.
  > - When a watched project is changed/removed from the sidebar, unwatch and rewatch as needed.
  >
  > Verify: open a project, create a new file from the terminal, see it appear in the file tree within 1 second. Delete a file, see it disappear.

- [x] **4.5 — Implement quick project switch and fuzzy file finder**

  > **Prompt**: Create two overlay components:
  >
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
  >
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
  >
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
  >
  > - Line numbers (old and new) in the gutter.
  > - Red background for removed lines, green background for added lines.
  > - Syntax highlighting within diff lines (basic: detect language from file extension).
  > - A toggle between "Unified" and "Split" (side-by-side) view modes.
  > - File header showing the file path and change type.
  > - "Open file" button to jump to the file in the file preview panel.
  > - "Discard changes" button for unstaged changes (with confirmation dialog).
  >
  > The diff viewer opens in the main content area (replacing the terminal temporarily, with a tab). Clicking a file in the Git panel opens it here. Verify with a file that has multiple hunks of changes.

- [x] **5.4 — Implement branch management UI**

  > **Prompt**: Create `src/components/git/BranchManager.tsx` — a dropdown/popover triggered by clicking the branch name in the Git panel:
  >
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

- [x] **6.1 — Implement global keybinding system**

  > **Prompt**: Create `src/lib/keybinding-manager.ts`:
  >
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

- [x] **6.2 — Build command palette**

  > **Prompt**: Create `src/components/command-palette/CommandPalette.tsx` using shadcn/ui's `Command` component:
  >
  > - Opens with `Cmd/Ctrl + Shift + P`.
  > - Lists all available actions grouped by category: Terminal, View, Git, Settings, Navigation.
  > - Each action shows its name, description, and keybinding (if any).
  > - Fuzzy search filters the list as the user types.
  > - Selecting an action executes it and closes the palette.
  > - Recent actions appear at the top.
  > - Available actions include: New Terminal, Close Terminal, Split Horizontal, Split Vertical, Toggle Sidebar, Open Settings, Toggle Full Screen, Clear Terminal, Reset Zoom, Open Folder, Git Commit, Git Push, Git Pull, Toggle Git Panel, Focus Terminal, etc.
  >
  > Verify: open palette, search "git", select "Git Push", verify it triggers the push action.

- [x] **6.3 — Implement split panes**

  > **Prompt**: Create `src/components/terminal/SplitContainer.tsx` — a container that supports splitting the terminal area horizontally and vertically:
  >
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
  >
  > 1. **Terminal output batching**: Ensure the PTY reader thread in Rust uses a ring buffer and sends data in chunks (8KB minimum) to avoid excessive IPC overhead. Measure and log the IPC message rate.
  > 2. **React rendering**: Add `React.memo` to all components that receive stable props. Use `useMemo` and `useCallback` where appropriate in terminal, file tree, and git panel components. Verify with React DevTools Profiler that no unnecessary re-renders occur during terminal output.
  > 3. **File tree virtualization**: For projects with 10,000+ files in expanded directories, implement windowed rendering (only render visible items) using `react-window` or a manual IntersectionObserver approach.
  > 4. **Memory management**: Ensure killed PTY sessions release all resources. Test opening and closing 50 tabs in succession — verify memory returns to baseline.
  > 5. **Startup time**: Measure cold start time. Implement lazy loading for settings panel, diff viewer, and command palette (only loaded when opened). Target < 500ms to first interactive terminal on Apple Silicon.
  >
  > Document all measurements before and after optimizations in a comment at the top of this task.

- [ ] **7.2 — Window management and transparency**

  > **Prompt**: Implement window appearance features:
  >
  > - **Opacity control**: Apply `window.setEffects()` Tauri API for macOS vibrancy (NSVisualEffectView with `.underWindowBackground`) and Windows acrylic/mica backdrop. Read opacity from config.
  > - **Full screen**: `Cmd/Ctrl + Enter` or `F11` toggles full screen via Tauri window API.
  > - **Always on top**: Toggle via command palette.
  > - **Window state persistence**: Save window position, size, and maximized state. Restore on next launch.
  > - **macOS traffic lights**: Position them correctly relative to the tab bar when `titleBarStyle: overlay` is used. Ensure they work correctly with sidebar open/closed.
  >
  > Verify: set opacity to 0.8, toggle vibrancy, verify the terminal is semi-transparent with desktop blur. Resize window, close app, reopen — verify position/size is restored.

- [ ] **7.3 — Accessibility and keyboard navigation**

  > **Prompt**: Audit and fix accessibility:
  >
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
  >
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
  >
  > - Triggers on push to `main` and on pull requests.
  > - Matrix: macOS (ARM runner), Windows (latest).
  > - Steps: checkout, setup Rust (stable), setup Node.js (20), install pnpm, install dependencies, run `cargo check`, run `cargo clippy -- -D warnings`, run `pnpm tsc --noEmit`, run `pnpm build`, run `pnpm tauri build`.
  > - Cache: Rust target directory, pnpm store.
  > - Artifact: Upload the built binaries as GitHub Actions artifacts.
  >
  > Create `.github/workflows/release.yml` that triggers on Git tag `v*`, builds for both platforms, creates a GitHub Release with the binaries attached. Verify the CI workflow passes on a test push.

- [ ] **8.2 — Configure auto-updater**

  > **Prompt**: Enable Tauri's built-in updater plugin:
  >
  > - Add `@tauri-apps/plugin-updater` to the project.
  > - Configure the updater endpoint to check GitHub Releases for new versions.
  > - On app launch, check for updates in the background. If a new version is available, show a non-intrusive notification "Update available: v0.2.0 — Restart to update".
  > - Implement a manual "Check for updates" action in the command palette and settings.
  > - Verify the update flow works end-to-end with a test release.

- [ ] **8.3 — macOS code signing and notarization**

  > **Prompt**: Document and configure macOS code signing:
  >
  > - Update `src-tauri/tauri.conf.json` to include signing identity environment variables.
  > - Create a CI step that signs the `.app` bundle with a Developer ID certificate and notarizes it with Apple (using `notarytool`).
  > - If no signing identity is available (open-source builds), skip signing and document that unsigned builds require right-click > Open on first launch.
  > - Verify the signed .dmg installs cleanly without Gatekeeper warnings.

- [ ] **8.4 — Windows installer and code signing**

  > **Prompt**: Configure the Windows build:
  >
  > - Tauri produces an `.msi` or `.nsis` installer by default. Verify it works.
  > - Configure the installer to: add a Start Menu shortcut, offer "Open Refinex Terminal here" in the Explorer context menu (via registry), and add `refinex` to PATH.
  > - If a code signing certificate is available, sign the installer. Otherwise, document the unsigned experience.
  > - Verify clean install and uninstall on a fresh Windows 10/11 VM.

- [ ] **8.5 — First release preparation**

  > **Prompt**: Prepare for v0.1.0 release:
  >
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
