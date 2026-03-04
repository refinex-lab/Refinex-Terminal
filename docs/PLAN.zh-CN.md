# Refinex Terminal — 实施计划 (PPLAN)

> **目的**：本文档是整个 Refinex Terminal 构建过程的唯一真实来源，从项目初始化到生产发布。每个阶段都分解为离散的任务，设计为可在单个 Claude Code 会话中完成。每个任务都包含一个可直接使用的 AI 提示。
>
> **规则**：完成每��任务后，Claude Code **必须**通过将 `[ ]` 更改为 `[x]` 来更新此文件以标记已完成的项目。

---

## 阶段 0：项目初始化与脚手架搭建

**目标**：建立 Tauri 2 + React 19 + TypeScript monorepo 结构，安装所有依赖项，验证应用程序在 macOS 和 Windows 上可以启动并显示空窗口。

### 任务

- [ ] **0.1 — 使用 React 前端初始化 Tauri 2 项目**

  > **提示词**：在当前目录中创建一个新的 Tauri 2 项目。使用 `pnpm create tauri-app`，并使用以下选项：包名 `refinex-terminal`，标识符 `com.refinex.terminal`，前端语言 TypeScript，前端框架 React（使用 Vite）。脚手架搭建后，验证项目结构包括 `src/`（前端）和 `src-tauri/`（后端）。更新 `src-tauri/tauri.conf.json` 以将窗口标题设置为 "Refinex Terminal"，默认大小 1280x800，最小尺寸 800x600，以及 `decorations: true`。运行 `pnpm install` 和 `pnpm tauri dev` 以确认空应用程序成功启动。修复任何问题。

- [ ] **0.2 — 配置 TypeScript 严格模式和路径别名**

  > **提示词**：更新 `tsconfig.json` 以启用严格模式（`strict: true`，`noUncheckedIndexedAccess: true`，`exactOptionalPropertyTypes: true`）。添加路径别名：`@/*` 映射到 `./src/*`。更新 `vite.config.ts` 以解析这些路径别名。创建 `src/types/index.ts` 作为中央类型导出文件。使用 `pnpm tsc --noEmit` 验证不存在 TypeScript 错误。

- [ ] **0.3 — 安装并配置 Tailwind CSS v4**

  > **提示词**：安装 Tailwind CSS v4 及其 Vite 插件（`@tailwindcss/vite`）。配置 `vite.config.ts` 以包含 Tailwind 插件。创建 `src/styles/globals.css`，内容为 `@import "tailwindcss"` 以及任何基础层自定义（重置 box-sizing，平滑滚动，终端的自定义滚动条样式）。在 `src/main.tsx` 中导入此 CSS。通过向 `App.tsx` 添加测试类并确认其呈现来验证 Tailwind 实用工具是否有效。验证后删除测试类。

- [ ] **0.4 — 安装 shadcn/ui 并配置组件库**

  > **提示词**：通过为 React + Vite + Tailwind v4 设置运行相应的 init 命令来初始化 shadcn/ui。将其配置为使用 "new-york" 样式、slate 基础色和 CSS 变量进行主题设置。安装这些初始组件：`button`、`dialog`、`dropdown-menu`、`input`、`scroll-area`、`separator`、`tooltip`、`tabs`、`badge`、`command`（用于命令面板）。安装 `lucide-react` 用于图标。验证 Button 组件正确呈现。确保所有 shadcn 组件都放置在 `src/components/ui/` 下。

- [ ] **0.5 — 安装 Zustand 并创建初始 store 结构**

  > **提示词**：安装 `zustand` 并在 `src/stores/` 下创建以下 store 文件：
  > - `terminal-store.ts` — 管理终端会话（选项卡、活动选项卡、PTY ID）。定义类型：`TerminalSession = { id: string, title: string, cwd: string, ptyId: number | null, isActive: boolean }`。导出初始空 store，包含操作：`addSession`、`removeSession`、`setActiveSession`、`updateSessionTitle`。
  > - `sidebar-store.ts` — 管理侧边栏状态（打开/关闭、活动项目、文件树）。定义类型：`Project = { path: string, name: string }`。导出 store，包含 `isOpen`、`projects`、`activeProject`、`toggleSidebar`、`addProject`、`removeProject`、`setActiveProject`。
  > - `config-store.ts` — 管理从 TOML 加载的用户配置。定义与 README 中 config.toml 模式匹配的 `AppConfig` 类型（appearance、terminal、ai、git、keybindings）。导出 store，包含 `config`、`updateConfig`、`resetConfig`。
  > - `git-store.ts` — 管理 Git 状态。定义类型：`GitStatus = { branch: string, ahead: number, behind: number, staged: FileChange[], unstaged: FileChange[], untracked: string[] }`，`FileChange = { path: string, status: 'added' | 'modified' | 'deleted' | 'renamed' }`。导出 store。
  >
  > 使用 TypeScript 严格类型，不使用 `any`。验证所有 store 编译无错误。

- [ ] **0.6 — 配置 Tauri 能力和权限**

  > **提示词**：在 `src-tauri/capabilities/` 中创建一个 `default.json` 能力文件，授予以下权限：shell 执行（用于 PTY）、文件系统读写（范围限定为用户选择的项目目录和应用程序配置目录）、窗口管理、事件发射/监听、路径解析、对话框（用于文件夹选择��）和剪贴板访问。遵循 Tauri v2 基于能力的权限模型——仅授予所需的权限。验证添加能力后应用程序仍能启动。

- [ ] **0.7 — 设置应用程序图标和窗口外观**

  > **提示词**：为 Refinex Terminal 创建一个最小的占位符图标（圆角正方形中的简单 SVG 闪电 ⚡，导出为 .ico 和 .icns）。将图标放置在 `src-tauri/icons/` 中，文件名符合 Tauri 预期（`32x32.png`、`128x128.png`、`128x128@2x.png`、`icon.icns`、`icon.ico`、`icon.png`）。更新 `src-tauri/tauri.conf.json` 以引用它们。在 macOS 上，将窗口配置为使用 `titleBarStyle: "overlay"` 以获得带有红绿灯按钮的原生感觉标题栏。在 Windows 上，使用默认标题栏。将 Refinex 徽标添加为 `src/components/ui/Logo.tsx` 中的小型 SVG 组件，可在侧边栏标题中使用。验证应用程序使用正确的图标和窗口外观启动。

- [ ] **0.8 — 验证完整的构建管道**

  > **提示词**：运行 `pnpm tauri build` 以生成生产二进制文件。在 macOS 上，验证在 `src-tauri/target/release/bundle/` 中生成了 `.dmg` 或 `.app` 包。验证二进制文件正确启动、窗口呈现且不存在控制台错误。如果出现任何构建警告，请修复它们。记录最终二进制文件大小。确保 `pnpm tsc --noEmit` 通过，`pnpm build`（Vite）通过，`cargo check`（在 src-tauri 中）通过且没有警告。

---

## 阶段 1：核心终端模拟

**目标**：实现一个功能齐全的终端模拟器，可以生成 shell、处理输入/输出、支持选项卡，并以 60fps 渲染。

### 任务

- [ ] **1.1 — 实现 Rust PTY 管理器**

  > **提示词**：在 `src-tauri/src/pty/` 中创建一个 PTY 管理器模块。将 `portable-pty` 添加到 Cargo.toml。实现一个 `PtyManager` 结构体，它：
  > - 在 `Arc<Mutex<>>` 包装的 `HashMap<u32, PtySession>` 中存储活动的 PTY 会话。
  > - `spawn(cwd: String, cols: u16, rows: u16) -> u32`：生成一个新的 PTY 进程（使用用户的默认 shell），返回会话 ID。
  > - `write(id: u32, data: Vec<u8>)`：向 PTY 会话写入数据。
  > - `resize(id: u32, cols: u16, rows: u16)`：调整 PTY 大小。
  > - `kill(id: u32)`：终止 PTY 会话并清理。
  > - 为每个 PTY 生成一个读取器线程，读取输出并向前端发射 Tauri 事件（`pty-output-{id}`）。
  >
  > 将 PtyManager 注册为 Tauri 托管状态。公开 Tauri 命令：`pty_spawn`、`pty_write`、`pty_resize`、`pty_kill`。使用 `cargo check` 编译并验证。

- [ ] **1.2 — 集成 xterm.js 与 WebGL 插件**

  > **提示词**：安装 `@xterm/xterm`、`@xterm/addon-webgl`、`@xterm/addon-fit`、`@xterm/addon-search`、`@xterm/addon-web-links`、`@xterm/addon-unicode11`。创建 `src/components/terminal/TerminalView.tsx`：
  > - 使用 WebGL 插件进行 GPU 渲染、fit 插件进行自动调整大小、search 插件、web-links 插件和 unicode11 插件初始化 xterm.js `Terminal` 实例。
  > - 使用 `useEffect` 在容器 div 中打开终端并加载所有插件。
  > - 在挂载时，调用 Tauri `pty_spawn` 命令以获取 PTY 会话 ID。
  > - 监听 `pty-output-{id}` Tauri 事件并将接收到的数据写入 xterm。
  > - 在 xterm `onData` 上，调用 `pty_write` 将输入发送到 PTY。
  > - 在容器调整大小时（使用 ResizeObserver），调用 `fit addon.fit()` 然后调用 `pty_resize`。
  > - 在卸载时，调用 `pty_kill` 并释放 xterm 实例。
  >
  > 创建一个包装器 `src/lib/tauri-pty.ts`，为所有 PTY 命令提供类型化的调���函数。验证在终端中键入 `ls` 会产生正确的输出。验证颜色和光标是否正常工作。

- [ ] **1.3 — 实现选项卡管理系统**

  > **提示词**：创建 `src/components/tabs/TabBar.tsx` — 终端区域顶部的水平选项卡栏。每个选项卡显示会话标题（最初为 "Terminal 1"、"Terminal 2" 等）和关闭按钮（lucide-react 的 X 图标）。活动选项卡以视觉方式突出显示。实现：
  > - 选项卡栏末尾的"新建选项卡"按钮（`+` 图标）— 从 terminal-store 调用 `addSession` 并生成新的 PTY。
  > - 单击选项卡以切换活动会话 — 隐藏其他终端视图（不销毁它们），显示所选视图。
  > - 关闭按钮杀死 PTY 并从 store 中删除会话。
  > - `Cmd/Ctrl + T` 快捷键创建新选项卡，`Cmd/Ctrl + W` 关闭当前选项卡，`Cmd/Ctrl + 1-9` 切换选项卡。
  > - 选项卡可拖动以重新排序（使用简单的拖动处理程序，无需外部库）。
  >
  > 更新 `App.tsx` 以在 TerminalView 区域上方组合 TabBar。验证多选项卡工作流程：打开 3 个选项卡，在每个选项卡中键入不同的命令，在它们之间切换，关闭一个，验证其他选项卡完好无损。

- [ ] **1.4 — 处理 shell 检测和环境设置**

  > **提示词**：在 `src-tauri/src/pty/shell.rs` 中实现 shell 检测逻辑：
  > - macOS：读取 `$SHELL` 环境变量，回退到 `/bin/zsh`，然后回退到 `/bin/bash`。
  > - Windows：尝试 `powershell.exe`，回退到 `cmd.exe`。
  > - 生成 PTY 时，将用户的 `PATH`、`HOME`、`LANG=en_US.UTF-8` 和 `TERM=xterm-256color` 注入环境。
  > - 支持配置选项以覆盖 shell 路径（从 config.toml `terminal.shell` 字段读取）。
  > - 检测并设置正确的 `TERM_PROGRAM=RefinexTerminal` 和 `TERM_PROGRAM_VERSION` 环境变量，以便 CLI 工具可以检测到它们在 Refinex 内部运行。
  >
  > 验证在 macOS 上，zsh 以正确的提示符启动，在 Windows 上，PowerShell 正确启动。验证 `echo $TERM` 输出 `xterm-256color`。

- [ ] **1.5 — 实现终端搜索**

  > **提示词**：创建 `src/components/terminal/TerminalSearch.tsx` — 当终端获得焦点时按 `Cmd/Ctrl + F` 出现的搜索覆盖层。它应该具有：
  > - 搜索查询的文本输入。
  > - "上一个"和"下一个"导航按钮（带有上/下箭头图标）。
  > - "匹配大小写"切换和"正则表达式"切换。
  > - 使用 xterm.js `SearchAddon` 突出显示匹配项并导航。
  > - `Escape` 关闭搜索栏。
  > - 显示匹配计数（例如，"3 of 12"）。
  >
  > 验证：键入具有重复输出的命令（例如，`cat` 一个文件），打开搜索，键入一个术语，验证高亮显示出现且导航有效。

- [ ] **1.6 — 实现复制/粘贴和选择**

  > **提示词**：配置 xterm.js 以支持：
  > - **选择时复制**：在终端中选择文本时，自动复制到剪贴板（可通过 `terminal.copy_on_select` 配置）。
  > - 选择文本时 `Cmd/Ctrl + C` 复制选择（未选择文本时，像往常一样发送 SIGINT）。
  > - `Cmd/Ctrl + V` 从剪贴板粘贴到终端。
  > - `Cmd/Ctrl + Shift + C` 始终复制选择。
  > - `Cmd/Ctrl + Shift + V` 始终粘贴。
  > - 右键单击上下文菜单，包含复制、粘贴、全选、清除终端选项。
  >
  > 使用 shadcn/ui DropdownMenu 创建 `src/components/terminal/TerminalContextMenu.tsx`。验证所有复制/粘贴操作在多行内容下正常工作。

---

## 阶段 2：配置系统

**目标**：实现基于 TOML 的配置系统，支持热重载、主题引擎和字体管理。

### 任务

- [ ] **2.1 — 实现 Rust 配置管理器**

  > **提示词**：在 `src-tauri/src/config/` 中创建一个配置模块。将 `toml` 和 `serde` 添加到 Cargo.toml。定义镜像 `config.toml` 模式的 Rust 结构体（AppConfig、Appearance、Terminal、AI、Git、Keybindings — 所有都带有 `#[derive(Serialize, Deserialize, Clone, Default)]`）。实现：
  > - `load_config(path: PathBuf) -> AppConfig`：读取和解析 TOML，为缺失字段返回默认值。
  > - `save_config(config: &AppConfig, path: PathBuf)`：序列化为 TOML 并写入。
  > - `get_config_path() -> PathBuf`：返回特定于平台的配置目录。
  > - `watch_config(path: PathBuf, tx: Sender)`：使用 `notify` crate 监视配置文件的外部更改并发出更新。
  >
  > 公开 Tauri 命令：`get_config`、`update_config`、`reset_config`、`get_config_path`。在应用程序启动时，加载配置并注入到托管状态。使用 `cargo check` 验证。

- [ ] **2.2 — 构建主题引擎**

  > **提示词**：创建 `src/lib/theme-engine.ts`，它：
  > - 定义一个 `Theme` 类型，包含所有终端颜色（背景、前景、光标、选择、ansi 0-15，以及侧边栏、选项卡、边框的 UI 颜色）。
  > - 实现 `applyTheme(theme: Theme)`，在 `:root` 上设置 CSS 自定义属性。
  > - 实现 `loadBuiltinTheme(name: string)`，从 `themes/` 目录导入。
  > - 实现 `loadCustomTheme(path: string)`，调用 Tauri 命令读取 TOML 文件。
  >
  > 在 `themes/` 中创建 5 个内置主题作为 TOML 文件：`refinex-dark.toml`（默认 — 深蓝灰色）、`refinex-light.toml`、`tokyo-night.toml`、`catppuccin-mocha.toml`、`github-dark.toml`。每个主题必须定义所有必需的颜色字段。将主题应用于 xterm.js 选项和 UI CSS 变量。验证主题切换无需重启即可实时工作。

- [ ] **2.3 — 实现字体管理**

  > **提示词**：创建 `src/lib/font-manager.ts`，它：
  > - 通过 Tauri 命令查询可用的系统字体（在 Rust 中实现 `list_fonts`，使用 `font-kit` crate 或通过读取系统字体目录）。
  > - 提供 `applyFont(family: string, size: number, lineHeight: number, ligatures: boolean)`，更新 xterm.js 终端选项和 UI CSS。
  > - 验证请求的字体存在，回退到 `"JetBrains Mono", "Fira Code", "Cascadia Code", monospace`。
  > - 处理动态字体大小更改（Cmd/Ctrl + Plus/Minus 缩放，Cmd/Ctrl + 0 重置）。
  >
  > 验证字体更改立即应用于终端，无需重新连接 PTY。

- [ ] **2.4 — 创建设置 UI 面板**

  > **提示词**：创建 `src/components/settings/SettingsPanel.tsx` — 一个全屏模态（由 `Cmd/Ctrl + ,` 触发），左侧导航侧边栏包含以下部分：外观、终端、AI、Git、快捷键。每个部分呈现表单控件：
  > - **外观**：主题下拉菜单、字体系列下拉菜单、字体大小滑块、行高滑块、连字切换、不透明度滑块、透明效果切换、光标样式单选按钮组。
  > - **终端**：shell 路径输入、回滚行数输入、选择时复制切换、响铃模式单选按钮组、环境变量编辑器（键值对）。
  > - **AI**：检测 CLI 切换、块模式切换、流式传输节流滑块。
  > - **Git**：启用切换、自动获取间隔输入、显示差异切换。
  > - **快捷键**：所有快捷键的表格，带有可编辑的热键输入。
  >
  > 所有更改都会更新 Zustand config store 并调用 `update_config` Tauri 命令进行持久化。更改实时应用（无需重启）。始终使用 shadcn/ui 表单组件。验证面板打开，更改在重启后保持。

---

## 阶段 3：AI 优先功能

**目标**：实现智能 AI 输出处理、CLI 检测和代理感知 UI 元素。

### 任务

- [ ] **3.1 — 实现 AI 输出块检测**

  > **提示词**：创建 `src/lib/ai-block-detector.ts` — 一个分析终端输出流以检测 AI CLI 输出边界的模块。实现以下启发式方法：
  > - **Claude Code**：检测 `╭─` / `╰─` 框绘制边界、`Claude` 标题标记和思考指示器。
  > - **Codex CLI**：检测 Codex 提示标记、工具使用块和代码输出围栏。
  > - **通用**：检测 markdown 样式的代码围栏、长的不间断文本块（>20 行没有 shell 提示符）以及 AI CLI 常见的 ANSI 序列。
  >
  > 定义 `AIBlock = { id: string, cliType: string, startLine: number, endLine: number, isCollapsed: boolean, isStreaming: boolean }`。创建一个 `BlockTracker` 类，为终端会话维护检测到的块列表，随着新输出到达而更新。导出钩子：`useAIBlocks(sessionId: string)`。

- [ ] **3.2 — 构建 AI 块覆盖 UI**

  > **提示词**：创建 `src/components/terminal/AIBlockOverlay.tsx` — 在终端视口顶部呈现的覆盖层，为检测到的 AI 块添加视觉指示器：
  > - AI 输出块上的细色左边框（按 CLI 类型进行颜色编码：Claude 为蓝色，Codex 为绿色，Copilot 为紫色）。
  > - 每个块右上角的折叠/展开切换按钮。
  > - 折叠时，显示摘要行："Claude Code — 247 lines (collapsed)"，带有展开按钮。
  > - "复制块"按钮，将整个块内容复制到剪贴板。
  > - 当用户在流式传输期间向上滚动时，显示"滚动到底部"浮动按钮。
  >
  > 覆盖层不得干扰终端输入。使用绝对定位和 pointer-events 管理。使用 500+ 行的模拟 AI 输出流进行验证 — 确认在流式传输期间没有卡顿，折叠/展开有效，复制有效。

- [ ] **3.3 — 实现流式安全渲染管道**

  > **提示词**：优化终端渲染管道以实现高吞吐量的 AI 输出：
  > - 在 `src/components/terminal/TerminalView.tsx` 中实现输出批处理：在缓冲区中收集所有 `pty-output` 事件，使用 `requestAnimationFrame` 最多每 16ms（60fps 的一帧）刷新到 xterm.js。
  > - 实现背压：如果 xterm.js 写入队列超过 10,000 字节，则将下一次刷新延迟一个额外的帧。
  > - 添加配置选项 `ai.streaming_throttle_ms`（默认 16）以控制刷新间隔。
  > - 当 AI 块模式处于活动状态且块超过 `ai.max_block_lines`（默认 50,000）时，自动折叠它并显示"块非常大 — 点击展开"消息。
  > - 实现虚拟化回滚：将 xterm.js `scrollback` 配置为用户的 `terminal.scrollback_lines` 设置，并启用 `OverviewRulerAddon` 用于滚动条缩略图。
  >
  > 基准测试：通过终端传输 100,000 行（例如，`seq 100000`）并验证没有丢帧，内存保持在 200MB 以下，终端在整个过程中对输入保持响应。

- [ ] **3.4 — 构建 AI CLI 配置向导**

  > **提示词**：创建 `src/components/ai/CLISetupWizard.tsx` — 一个分步对话框，帮助用户配置其 AI CLI 工具。它应该：
  > 1. **检测步骤**：扫描系统 PATH 以查找已知的 CLI 二进制文件（`claude`、`codex`、`gh copilot`、`gemini`）。显示找到哪些以及缺少哪些，并提供安装链接。
  > 2. **配置步骤**：对于每个检测到的 CLI，显示其当前配置状态（例如，Claude Code 是否已认证？Codex API 密钥是否已设置？）。为每个 CLI 的设置提供"打开文档"链接。
  > 3. **Shell 集成步骤**：提供将 shell 别名或 PATH 修改添加到用户的 shell 配置文件（`.zshrc`、`.bashrc`、PowerShell 配置文件）。
  > 4. **测试步骤**：为每个 CLI 运行一个简单的测试命令（例如，`claude --version`）并显示结果。
  >
  > 还实现 `src-tauri/src/cli/detector.rs` — 一个 Rust 模块，扫描 PATH 以查找已知的二进制文件并返回其路径和版本。公开为 Tauri 命令 `detect_ai_clis`。在首次启动或通过设置触发向导。

- [ ] **3.5 — 实现代理状态指示器**

  > **提示词**：创建 `src/components/terminal/AgentStatus.tsx` — 在选项卡栏和终端右下角显示的小状态徽章，指示当前 AI 代理状态：
  > - **空闲**（灰色点）：没有 AI CLI 正在运行。
  > - **思考中**（脉动黄色点）：AI CLI 正在处理（通过输出模式检测，如旋转器字符、"Thinking..." 文本或提交提示后缺少输出）。
  > - **写入中**（带动画的绿色点）：AI 正在主动流式传输输出。
  > - **错误**（红色点）：AI CLI 以非零代码退出。
  > - **等待输入**（蓝色点）：AI CLI 正在请求用户确认。
  >
  > 检测基于来自 `ai-block-detector.ts` 的输出模式分析。验证状态在 Claude Code 会话期间实时更新。

---

## 阶段 4：多项目侧边栏和文件系统

**目标**：构建带有项目导航、文件树和文件预览/编辑功能的侧边栏。

### 任务

- [ ] **4.1 — 实现侧边栏布局和项目导航器**

  > **提示词**：在 `src/components/sidebar/Sidebar.tsx` 中创建侧边栏布局：
  > - 可折叠的左侧面板（默认宽度 260px，可通过拖动手柄调整大小，最小 200px，最大 400px）。
  > - `Cmd/Ctrl + B` 切换侧边栏可见性。
  > - 标题部分：Refinex 徽标（来自 Logo.tsx）+ "Projects" 标签 + "添加项目"按钮（文件夹图标）。
  > - 项目列表：每个项目显示一个文件夹图标、项目名称（路径的基本名称）和右键单击上下文菜单（在终端中打开、从侧边栏中删除、复制路径）。
  > - 单击项目将其设置为 sidebar store 中的 `activeProject` 并展开其文件树。
  > - "添加项目"打开原生文件夹选择器对话框（Tauri dialog API）以选择目录。
  > - 项目保存在 config.toml `projects.paths` 数组中。
  >
  > 将侧边栏与终端区域一起集成到 `App.tsx` 中。验证：添加项目，在列表中看到它，单击以激活，删除它。

- [ ] **4.2 — 构建文件树组件**

  > **提示词**：创建 `src/components/sidebar/FileTree.tsx` — 活动项目文件系统的递归树视图：
  > - 在 `src-tauri/src/fs/` 中实现 `read_directory(path: string) -> Vec<FileEntry>` Tauri 命令，返回 `{ name, path, isDirectory, isSymlink, size, modified }` 条目，排序：目录优先（按字母顺序），然后文件（按字母顺序）。
  > - 忽略与常见模式匹配的条目：`.git`、`node_modules`、`.DS_Store`、`__pycache__`、`.next`、`target`、`dist`、`build`（可配置）。
  > - **延迟加载**：仅在展开时加载目录内容（不要递归读取整个树）。
  > - 文件类型图标：使用按扩展名映射的 lucide-react 图标（`.ts`→TypeScript 图标、`.rs`→Rust 图标、`.md`→markdown 图标等，带有通用文件图标回退）。
  > - AI 更改指示器：由 AI 代理修改的文件（通过 `git-store` diff 数据跟踪）显示一个小点指示器（修改为橙色，添加为绿色，删除为红色）。
  > - 右键单击上下文菜单：在终端中打开、复制路径、复制相对路径、重命名、删除。
  >
  > 验证：添加一个真实项目（例如，refinex-terminal 仓库本身），展开目录，查看正确的文件列表，验证延迟加载。

- [ ] **4.3 — 实现文件预览和编辑器**

  > **提示词**：创建 `src/components/sidebar/FilePreview.tsx` — 当在文件树中单击文件时：
  > - 对于文本文件（<1MB）：通过 Tauri 命令 `read_file(path: string) -> String` 读取文件内容并在语法高亮的只读视图中显示。使用带有基本语法高亮的 `<pre>` 块（从扩展名检测语言，应用适当的 CSS 类）。显示行号。
  > - 对于图像文件（`.png`、`.jpg`、`.gif`、`.svg`）：显示内联预览。
  > - 对于二进制/大型文件：显示文件元数据（大小、修改日期）和"使用系统编辑器打开"按钮。
  > - 添加"编辑"按钮，在带有等宽字体和行号的可编辑 `<textarea>` 中打开文件。"保存"按钮通过 `write_file(path: string, content: string)` Tauri 命令写回。`Cmd/Ctrl + S` 保存。
  > - 文件预览作为替换文件树区域的面板打开（带有面包屑返回导航）。
  >
  > 验证：单击 `.ts` 文件，查看语法高亮的内容，单击编辑，进行更改，保存，重新打开并验证更改已持久化。

- [ ] **4.4 — 实现文件系统监视器**

  > **提示词**：在 `src-tauri/src/fs/watcher.rs` 中使用 `notify` crate 实现文件系统监视器：
  > - 递归监视活动项目的目录以检测文件更改。
  > - 将事件去抖动 200ms 以避免快速连续更新。
  > - 发出 Tauri 事件：`fs-changed`，有效负载为 `{ path: string, kind: "create" | "modify" | "remove" }`。
  > - 在前端，监听 `fs-changed` 事件并相应地更新文件树（添加、更新或删除节点），而不折叠展开的目录。
  > - 当从侧边栏更改/删除监视的项目时，取消监视并根据需要重新监视。
  >
  > 验证：打开一个项目，从终端创建一个新文件，在 1 秒内看到它出现在文件树中。删除一个文件，看到它消失。

- [ ] **4.5 — 实现快速项目切换和模糊文件查找器**

  > **提示词**：创建两个覆盖组件：
  > 1. `src/components/sidebar/QuickProjectSwitch.tsx` — `Cmd/Ctrl + Shift + O` 打开所有固定项目的模糊可搜索列表。选择一个将其设置为活动并在该目录中打开一个新的终端选项卡。使用 shadcn/ui `Command` 组件（cmdk 样式）。
  > 2. `src/components/sidebar/FuzzyFileFinder.tsx` — `Cmd/Ctrl + P` 打开活动项目的模糊文件查找器。在 Rust 中实现 `list_all_files(root: string, ignorePatterns: Vec<String>) -> Vec<String>`，递归列出所有文件（通过 `ignore` crate 遵循 `.gitignore`）。前端使用模糊匹配过滤结果（使用简单的评分算法）。选择文件在文件预览面板中打开它。
  >
  > 两个覆盖层都应该居中打开，具有键盘导航（箭头键，Enter 选择，Escape 关闭），并在选择后自动关闭。验证两者都适用于包含 1000+ 个文件的项目。

---

## 阶段 5：Git 集成

**目标**：使用本地安装的 Git 二进制文件构建全面的 Git 集成面板，包括状态、差异、提交、推送和分支管理。

### 任务

- [ ] **5.1 — 实现 Rust Git 模块**

  > **提示词**：在 `src-tauri/src/git/` 中使用 `git2` crate（libgit2 的 Rust 绑定）实现 Git 操作模块。实现以下函数：
  > - `git_status(repo_path: String) -> GitStatus`：返回分支名称、ahead/behind 计数、staged/unstaged/untracked 文件及其更改类型。
  > - `git_diff(repo_path: String, file_path: String, staged: bool) -> String`：返回特定文件的统一差异（staged 或 unstaged）。
  > - `git_log(repo_path: String, limit: u32) -> Vec<CommitInfo>`：返回最近的提交，包括哈希、消息、作者、日期。
  > - `git_stage(repo_path: String, paths: Vec<String>)`：暂存文件。
  > - `git_unstage(repo_path: String, paths: Vec<String>)`：取消暂存文件。
  > - `git_commit(repo_path: String, message: String) -> String`：创建提交，返回哈希。
  > - `git_push(repo_path: String) -> Result<(), String>`：推送到远程（shell 出到 `git push` 以支持 SSH 密钥）。
  > - `git_pull(repo_path: String) -> Result<(), String>`：从远程拉取。
  > - `git_fetch(repo_path: String)`：从远程获取。
  > - `git_branches(repo_path: String) -> Vec<BranchInfo>`：列出本地和远程分支。
  > - `git_checkout(repo_path: String, branch: String)`：切换分支。
  > - `git_stash(repo_path: String)` / `git_stash_pop(repo_path: String)`：储藏管理。
  >
  > 将所有内容公开为 Tauri 命令。对于需要 SSH 身份验证的操作（推送、拉取、获取），shell 出到系统 `git` 二进制文件以利用用户的 SSH 代理。使用 `cargo check` 验证。

- [ ] **5.2 — 构建 Git 状态面板**

  > **提示词**：创建 `src/components/git/GitPanel.tsx` — 侧边栏中的面板（通过侧边栏标题中的 Git 分支图标切换），显示：
  > - **分支指示器**：当前分支名称，带有 ahead/behind 徽章（例如，"main ↑2 ↓1"）。
  > - **Staged changes** 部分：staged 文件列表，带有其更改类型图标（添加为绿色 +，修改为蓝色 M，删除为红色 -）。每个文件都可以单击以显示差异。
  > - **Unstaged changes** 部分：相同格式。单击文件以显示 unstaged 差异。每个文件都有一个"+"按钮以暂存它。
  > - **Untracked files** 部分：带有"Stage all"按钮的列表。
  > - 底部的**操作按钮**："Stage All"、"Commit"（打开消息输入）、"Push"、"Pull"、"Fetch"、"Stash"。
  > - 提交输入是一个文本区域，占位符为"Commit message..."和"Commit"按钮。`Cmd/Ctrl + Enter` 提交。
  > - 自动刷新：每 5 秒轮询 `git_status`，或在监视器的 `fs-changed` 事件上。
  >
  > 验证：对活动项目中的文件进行更改，看到它们显示为 unstaged，暂存一个，使用消息提交，验证提交已创建。

- [ ] **5.3 — 构建差异查看器**

  > **提示词**：创建 `src/components/git/DiffViewer.tsx` — 一个呈现统一差异的组件，具有：
  > - 沟槽中的行号（旧和新）。
  > - 删除行的红色背景，添加行的绿色背景。
  > - 差异行内的语法高亮（基本：从文件扩展名检测语言）。
  > - "Unified"和"Split"（并排）视图模式之间的切换。
  > - 显示文件路径和更改类型的文件标题。
  > - "打开文件"按钮，跳转到文件预览面板中的文件。
  > - unstaged 更改的"放弃更改"按钮（带有确认对话框）。
  >
  > 差异查看器在主内容区域中打开（暂时替换终端，带有选项卡）。单击 Git 面板中的文件在此处打开它。验证具有多个更改块的文件。

- [ ] **5.4 — 实现分支管理 UI**

  > **提示词**：创建 `src/components/git/BranchManager.tsx` — 通过单击 Git 面板中的分支名称触发的下拉/弹出窗口：
  > - 列出所有本地分支（当前分支用复选标记突出显示）。
  > - 在单独的部分中列出远程分支。
  > - 顶部的搜索/过滤器输入。
  > - 单击分支以检出（如果有未提交的更改，则进行确认 — 提供储藏）。
  > - "新建分支"按钮：分支名称的输入，从当前 HEAD 创建并检出。
  > - 每个分支的上下文菜单中的"删除分支"选项（带有确认）。
  >
  > 验证：创建一个新分支，切换到它，进行提交，切换回 main，验证所有状态正确更新��

---

## 阶段 6：键盘快捷键、命令面板和拆分窗格

**目标**：实现键盘驱动工作流程的高级用户功能。

### 任务

- [ ] **6.1 — 实现全局键绑定系统**

  > **提示词**：创建 `src/lib/keybinding-manager.ts`：
  > - 定义 `KeybindingMap` 类型：`Record<string, string>`，将键组合（例如，"Cmd+Shift+P"）映射到操作标识符（例如，"command_palette"）。
  > - 实现一个 `KeybindingManager` 类，它：
  >   - 注册全局 `keydown` 事件侦听器。
  >   - 将键事件规范化为规范字符串（处理跨平台的 Cmd 与 Ctrl）。
  >   - 在当前键绑定映射中查找操作。
  >   - 通过中央操作总线（简单的 EventEmitter 或 Zustand store）分派操作。
  > - 默认键绑定在 `src/lib/default-keybindings.ts` 中定义。
  > - 来自 config.toml 的用户覆盖合并在顶部。
  > - 键绑定是上下文感知的：终端焦点绑定与全局绑定。
  > - 确保当终端获得焦点时，Ctrl+C、Ctrl+Z、Ctrl+D 正确传递到终端。
  >
  > 验证：打开应用程序，按 Cmd+Shift+P（构建后应打开命令面板），按 Cmd+T（应打开新选项卡）。

- [ ] **6.2 — 构建命令面板**

  > **提示词**：使用 shadcn/ui 的 `Command` 组件创建 `src/components/command-palette/CommandPalette.tsx`：
  > - 使用 `Cmd/Ctrl + Shift + P` 打开。
  > - 列出按类别分组的所有可用操作：终端、视图、Git、设置、导航。
  > - 每个操作显示其名称、描述和键绑定（如果有）。
  > - 模糊搜索在用户键入时过滤列表。
  > - 选择操作执行它并关闭面板。
  > - 最近的操作显示在顶部。
  > - 可用操作包括：新建终端、关闭终端、水平拆分、垂直拆分、切换侧边栏、打开设置、切换全屏、清除终端、重置缩放、打开文件夹、Git 提交、Git 推送、Git 拉取、切换 Git 面板、聚焦终端等。
  >
  > 验证：打开面板，搜索"git"，选择"Git Push"，验证它触发推送操作。

- [ ] **6.3 — 实现拆分窗格**

  > **提示词**：创建 `src/components/terminal/SplitContainer.tsx` — 一个支持水平和垂直拆分终端区域的容器：
  > - `Cmd/Ctrl + D`：水平拆分活动窗格（并排）。
  > - `Cmd/Ctrl + Shift + D`：垂直拆分活动窗格（上/下）。
  > - 每个窗格包含其自己的独立终端会话（新 PTY）。
  > - 窗格具有可拖动的可调整大小的分隔线。
  > - `Cmd/Ctrl + Alt + 箭头`键在窗格之间导航。
  > - 关闭窗格的终端会折叠拆分。
  > - 每个选项卡最多 4 个窗格。
  >
  > 对拆分布局使用递归树结构：`SplitNode = { type: 'terminal', sessionId } | { type: 'split', direction: 'horizontal' | 'vertical', children: [SplitNode, SplitNode], ratio: number }`。在 terminal-store 中为每个选项卡存储布局。验证：创建一个 2x2 的终端网格，在每个中键入，调整分隔线大小，关闭一个窗格，验证布局调整。

---

## 阶段 7：性能优化和完善

**目标**：进行性能分析和优化，以实现生产质量的性能、可访问性和视觉完善。

### 任务

- [ ] **7.1 — 性能分析和优化**

  > **提示词**：对应用程序进行性能分析并实施以下优化：
  > 1. **终端输出批处理**：确保 Rust 中的 PTY 读取器线程使用环形缓冲区并以块（最少 8KB）发送数据，以避免过多的 IPC 开销。测量并记录 IPC 消息速率。
  > 2. **React 渲染**：将 `React.memo` 添加到所有接收稳定 props 的组件。在终端、文件树和 git 面板组件中适当使用 `useMemo` 和 `useCallback`。使用 React DevTools Profiler 验证在终端输出期间不会发生不必要的重新渲染。
  > 3. **文件树虚拟化**：对于在展开目录中具有 10,000+ 个文件的项目，使用 `react-window` 或手动 IntersectionObserver 方法实现窗口渲染（仅渲染可见项）。
  > 4. **内存管理**：确保已杀死的 PTY 会话释放所有资源。测试连续打开和关闭 50 个选项卡 — 验证内存返回到基线。
  > 5. **启动时间**：测量冷启动时间。对设置面板、差异查看器和命令面板实现延迟加载（仅在打开时加载）。在 Apple Silicon 上目标 < 500ms 到第一个交互式终端。
  >
  > 在此任务顶部的注释中记录优化前后的所有测量结果。

- [ ] **7.2 — 窗口管理和透明度**

  > **提示词**：实现窗口外观功能：
  > - **不透明度控制**：为 macOS 透明效果（带有 `.underWindowBackground` 的 NSVisualEffectView）和 Windows 亚克力/云母背景应用 `window.setEffects()` Tauri API。从配置中读取不透明度。
  > - **全屏**：`Cmd/Ctrl + Enter` 或 `F11` 通过 Tauri window API 切换全屏。
  > - **始终置顶**：通过命令面板切换。
  > - **窗口状态持久化**：保存窗口位置、大小和最大化状态。在下次启动时恢复。
  > - **macOS 红绿灯按钮**：当使用 `titleBarStyle: overlay` 时，相对于选项卡栏正确定位它们。确保它们在侧边栏打开/关闭时正确工作。
  >
  > 验证：将不透明度设置为 0.8，切换透明效果，验证终端是半透明的，带有桌面模糊。调整窗口大小，关闭应用程序，重新打开 — 验证位置/大小已恢复。

- [ ] **7.3 — 可访问性和键盘导航**

  > **提示词**：审核并修复可访问性：
  > - 所有交互元素都具有正确的 ARIA 角色和标签。
  > - 焦点管理：Tab 键按逻辑顺序在侧边栏、终端和面板之间导航。
  > - 屏幕阅读器支持：宣布选项卡切换、git 状态更改和搜索结果。
  > - 高对比度模式：确保所有主题符合 WCAG AA 文本对比度比率。
  > - 减少动画：遵循 `prefers-reduced-motion` 媒体查询 — 禁用折叠/展开、过渡和状态指示器的动画。
  > - 纯键盘导航：验证可以在不使用鼠标的情况下执行每个操作。
  >
  > 使用 macOS VoiceOver 进行测试并验证基本导航有效。

- [ ] **7.4 — 错误处理和崩溃弹性**

  > **提示词**：在整个应用程序中实现强大的错误处理：
  > - **PTY 崩溃恢复**：如果 PTY 进程意外死亡，在终端中显示"会话已结束"消息，带有"重启"按钮。不要崩溃整个应用程序。
  > - **Git 错误**：所有 git 操作都应在 toast 通知中显示用户友好的错误消息（使用 shadcn/ui 的 toast）。常见错误："不是 git 仓库"、"合并冲突"、"身份验证失败"。
  > - **配置错误**：如果 config.toml 格式错误，记录错误，使用默认值，并显示通知"配置文件有错误 — 使用默认值"。
  > - **IPC 错误**：在 try/catch 中包装所有 Tauri invoke 调用，并进行类型化错误处理。在 React 中创建全局错误边界组件。
  > - **日志记录**：在 Rust 后端添加 `tracing` crate 日志记录。在调试级别记录 PTY 事件、git 操作和配置更改。日志保存到 `~/.refinex/logs/`。
  >
  > 验证：在外部杀死 PTY 进程（例如，`kill -9`），验证应用程序显示错误并允许重启。

---

## 阶段 8：构建、打包和发布

**目标**：设置 CI/CD、代码签名、自动更新并生成发布二进制文件。

### 任务

- [ ] **8.1 — 使用 GitHub Actions 配置 CI/CD**

  > **提示词**：创建 `.github/workflows/ci.yml`，它：
  > - 在推送到 `main` 和拉取请求时触发。
  > - 矩阵：macOS（ARM runner）、Windows（最新）。
  > - 步骤：检出、设置 Rust（稳定）、设置 Node.js（20）、安装 pnpm、安装依赖项、运行 `cargo check`、运行 `cargo clippy -- -D warnings`、运行 `pnpm tsc --noEmit`、运行 `pnpm build`、运行 `pnpm tauri build`。
  > - 缓存：Rust target 目录、pnpm store。
  > - 工件：将构建的二进制文件上传为 GitHub Actions 工件。
  >
  > 创建 `.github/workflows/release.yml`，在 Git 标签 `v*` 上触发，为两个平台构建，创建一个附加二进制文件的 GitHub Release。验证 CI 工作流程在测试推送上通过。

- [ ] **8.2 — 配置自动更新器**

  > **提示词**：启用 Tauri 的内置更新器插件：
  > - 将 `@tauri-apps/plugin-updater` 添加到项目。
  > - 配置更新器端点以检查 GitHub Releases 的新版本。
  > - 在应用程序启动时，在后台检查更新。如果有新版本可用，显示一个非侵入性通知"更新可用：v0.2.0 — 重启以更新"。
  > - 在命令面板和设置中实现手动"检查更新"操作。
  > - 使用测试发布验证更新流程端到端工作。

- [ ] **8.3 — macOS 代码签名和公证**

  > **提示词**：记录并配置 macOS 代码签名：
  > - 更新 `src-tauri/tauri.conf.json` 以包含签名身份环境变量。
  > - 创建一个 CI 步骤，使用 Developer ID 证书对 `.app` 包进行签名，并使用 Apple 公证（使用 `notarytool`）。
  > - 如果没有可用的签名身份（开源构建），跳过签名并记录未签名的构建在首次启动时需要右键单击 > 打开。
  > - 验证已签名的 .dmg 安装干净，没有 Gatekeeper 警告。

- [ ] **8.4 — Windows 安装程序和代码签名**

  > **提示词**：配置 Windows 构建：
  > - Tauri 默认生成 `.msi` 或 `.nsis` 安装程序。验证它是否有效。
  > - 配置安装程序以：添加开始菜单快捷方式，在资源管理器上下文菜单中提供"在此处打开 Refinex Terminal"（通过注册表），并将 `refinex` 添加到 PATH。
  > - 如果代码签名证书可用，签名安装程序。否则，记录未签名的体验。
  > - 在全新的 Windows 10/11 VM 上验证干净安装和卸载。

- [ ] **8.5 — 首次发布准备**

  > **提示词**：为 v0.1.0 发布做准备：
  > - 更新所有版本号：`package.json`、`Cargo.toml`、`tauri.conf.json`。
  > - 编写 `CHANGELOG.md`，包含 v0.1.0 中的所有功能。
  > - 创建 `CONTRIBUTING.md`，包含：开发设置、代码风格指南、PR 流程、issue 模板。
  > - 验证 README 准确且所有链接有效。
  > - 创建 GitHub issue 模板（bug 报告、功能请求）。
  > - 标记发布：`git tag v0.1.0 && git push --tags`。
  > - 验证发布工作流程生成二进制文件并发布它们。

---

## 附录：任务完成协议

完成每个任务后：

1. **测试**：运行任务提示词中描述的相关验证步骤。
2. **构建检查**：确保 `pnpm tauri build` 仍然成功，没有错误。
3. **Lint 检查**：确保 `cargo clippy -- -D warnings` 和 `pnpm tsc --noEmit` 通过。
4. **更新此文件**：将已完成任务的 `[ ]` 更改为 `[x]`。
5. **提交**：遵循 `.github/COMMIT_CONVENTION.md` 中的提交约定。
