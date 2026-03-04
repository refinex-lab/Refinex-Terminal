<div align="center">

# ⚡ Refinex Terminal

**专为 Claude Code、Codex CLI、Copilot CLI 等 AI 编程工具打造的高性能终端模拟器。**
**针对 Apple Silicon（macOS ARM）及 Windows 深度优化。**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/Rust-1.82+-orange.svg)](https://www.rust-lang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8D8.svg)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-lightgrey.svg)]()

<img src="docs/assets/banner.png" alt="Refinex Terminal Banner" width="800" />

[English](README.md) · [功能特性](#-功能特性) · [架构设计](#-架构设计) · [快速开始](#-快速开始) · [配置说明](#-配置说明) · [开发路线图](#-开发路线图) · [参与贡献](#-参与贡献)

</div>

---

## 🎯 为什么选择 Refinex Terminal？

AI 编程助手（Claude Code、Codex CLI、Gemini CLI、Copilot CLI）的兴起从根本上改变了开发者使用终端的方式。然而现有终端工具对 AI 工作流毫无感知，依然是被动的命令行界面。**Refinex Terminal 正是为填补这一空白而生** —— 专为 AI 代理开发时代量身打造。

### 现有痛点

- 传统终端将 AI CLI 输出视为纯文本，缺乏结构化展示与交互能力
- 大量 AI 输出（动辄数千行）导致滚动卡顿、视口冻结
- 无法同时管理多个跨项目运行的 AI 代理
- AI 触发的 Git 操作需要频繁切换到外部工具
- 缺少与终端集成的文件树及 AI 生成变更的差异对比视图

### 解决方案

Refinex Terminal **不是又一款通用终端**。它是专为 AI 辅助开发打造的专属指挥中心，为代理工作流、智能输出处理、集成式 Git 操作和多项目侧边栏提供第一流的支持 —— 全部封装在一个极速的原生 Shell 中。

---

## ✨ 功能特性

### 🚀 核心终端引擎
- **原生性能** —— 基于 Tauri 2 的 Rust 后端，使用系统 WebView，无需捆绑 Chromium
- **秒级启动** —— Apple Silicon 冷启动 < 500ms，Windows 下 < 800ms
- **xterm.js 渲染** —— 搭配 WebGL 插件，GPU 加速终端输出
- **完整 VT100/VT220/xterm-256color** 转义序列支持
- **Unicode 与 Emoji** 支持，兼容连字字体渲染
- **滚动缓冲区** —— 最多可配置 100,000 行，虚拟化渲染

### 🤖 AI 优先体验
- **智能输出块** —— AI 响应内容被归组为可折叠、可导航的独立块
- **流式视口安全** —— AI 长输出（10,000+ 行）期间零卡顿渲染
- **一键 CLI 配置** —— 内置 Claude Code、Codex CLI、Copilot CLI、Gemini CLI 配置向导
- **代理状态指示器** —— 实时显示代理运行状态（思考中、写入中、空闲）
- **提示词书签** —— 保存并快速调用常用 AI 提示词
- **输出搜索与过滤** —— 支持正则表达式在 AI 输出块中搜索

### 📂 多项目侧边栏
- **仓库导航器** —— 在侧边栏树形视图中打开多个代码仓库
- **按仓库独立标签页** —— 每个项目拥有独立隔离的终端会话
- **文件树浏览器** —— 展开、点击预览并直接编辑文件
- **AI 变更追踪** —— 高亮显示 AI 代理修改过的文件，附带差异指示器

### 🔀 集成 Git
- **原生 Git 集成** —— 调用本地安装的 `git` 二进制
- **变更概览面板** —— 已暂存/未暂存文件及内联差异预览
- **一键操作** —— 从 UI 完成提交、推送、拉取、获取、分支、暂存
- **AI 提交信息** —— 根据 AI 产生的差异自动生成提交信息
- **差异查看器** —— AI 修改文件的并排与内联差异展示
- **分支管理** —— 可视化分支切换器，支持合并/变基

### ⌨️ 键盘驱动工作流
- **命令面板** —— `Cmd/Ctrl + Shift + P` 访问所有操作
- **分屏** —— `Cmd/Ctrl + D` 水平分屏 / `Cmd/Ctrl + Shift + D` 垂直分屏
- **标签页管理** —— `Cmd/Ctrl + T` 新建，`Cmd/Ctrl + W` 关闭，`Cmd/Ctrl + [1-9]` 切换
- **快速项目切换** —— `Cmd/Ctrl + Shift + O` 在仓库间跳转
- **模糊文件查找** —— `Cmd/Ctrl + P` 从当前项目快速打开任意文件
- **完全可定制** —— 通过 JSON 配置重新映射任意快捷键

### 🎨 主题与自定义
- **内置主题** —— 预置 20+ 精选主题（深色与浅色）
- **自定义主题** —— 通过 TOML 配置定义个人主题
- **字体控制** —— 字体族、字号、行高、字间距、连字开关
- **透明度与模糊** —— 窗口透明效果，支持 macOS 毛玻璃/Windows 亚克力背景
- **布局预设** —— 保存并恢复窗口布局

### ⚡ 性能优化
- **虚拟化滚动缓冲区** —— 仅可见行存在于 DOM 中
- **输出节流** —— 高吞吐流期间以 60fps 批量渲染
- **懒加载文件树** —— 目录按需加载，非预先全量展开
- **后台进程隔离** —— 每个 PTY 运行在独立的 Rust 线程中
- **内存映射大文件** —— 预览大文件无需全量加载至内存
- **增量搜索** —— 搜索索引渐进构建，不阻塞 UI

---

## 🏗 架构设计

```
┌─────────────────────────────────────────────────────┐
│                  Refinex Terminal                     │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │              前端（WebView）                     │ │
│  │  React 19 + TypeScript + Tailwind CSS v4        │ │
│  │  xterm.js + WebGL Addon + shadcn/ui             │ │
│  │  Zustand（状态管理）+ TanStack Query（异步）    │ │
│  └──────────────────┬──────────────────────────────┘ │
│                     │ Tauri IPC（invoke/events）      │
│  ┌──────────────────▼──────────────────────────────┐ │
│  │              后端（Rust / Tauri 2）              │ │
│  │  PTY 管理器（portable-pty）                     │ │
│  │  Git 操作（git2-rs）                            │ │
│  │  文件系统监视器（notify）                       │ │
│  │  配置管理器（toml + serde）                     │ │
│  │  CLI 注册表 & 进程管理器                        │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │              系统层                              │ │
│  │  macOS: WebKit WebView + Metal GPU              │ │
│  │  Windows: WebView2（Edge/Chromium）             │ │
│  │  PTY: /dev/ptmx（macOS）/ ConPTY（Windows）    │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 技术栈

| 层级 | 技术 | 选型理由 |
|------|------|----------|
| **桌面框架** | Tauri 2.x | 原生 WebView，~3MB 二进制，Rust 后端，无需捆绑 Chromium |
| **后端** | Rust | 内存安全，线程安全的 PTY 管理，通过 git2 原生 Git 支持 |
| **前端** | React 19 + TypeScript 5.6 | 组件模型成熟，生态完善，开发者友好 |
| **终端模拟器** | xterm.js 5.x + WebGL addon | 行业标准（VS Code 同款），GPU 加速渲染 |
| **PTY** | portable-pty（Rust） | 跨平台伪终端，避免 node-pty 的原生编译问题 |
| **样式** | Tailwind CSS v4 | 原子化，可 tree-shake，零运行时开销 |
| **UI 组件** | shadcn/ui + Radix | 可访问，可组合，复制即用 |
| **图标** | Lucide React | 一致美观，可 tree-shake，1400+ 图标 |
| **状态管理** | Zustand | 极简样板代码，无 Provider 包裹，高性能选择器 |
| **Git** | git2-rs | libgit2 的 Rust 绑定，无 shell 调用开销 |
| **文件监视** | notify（Rust） | 跨平台文件系统事件，内置防抖 |
| **配置格式** | TOML | 人类可读，Rust 原生 serde 支持 |
| **构建工具** | Vite 6 | 极速 HMR，优化生产构建 |
| **包管理器** | pnpm | 高效磁盘利用，严格依赖解析 |

### 为什么选择 Tauri 而非 Electron？

| 指标 | Tauri 2 | Electron |
|------|---------|----------|
| 二进制大小 | ~3–10 MB | ~150 MB+ |
| 内存占用（空闲）| ~30–50 MB | ~150–300 MB |
| 启动时间 | < 500ms | 1–2s |
| 后端语言 | Rust（原生性能） | Node.js（解释执行） |
| 安全模型 | 基于能力，默认锁定 | 宽松，需手动加固 |
| 捆绑运行时 | 无（使用系统 WebView） | 完整 Chromium + Node.js |

---

## 🚀 快速开始

### 环境要求

- **macOS**：macOS 12+（Monterey），支持 Apple Silicon 和 Intel
- **Windows**：Windows 10 1809+（需要 WebView2）
- **Rust**：1.82+，通过 [rustup](https://rustup.rs/) 安装
- **Node.js**：20 LTS+，通过 [fnm](https://github.com/Schniz/fnm) 或 nvm 安装
- **pnpm**：9+（`corepack enable && corepack prepare pnpm@latest --activate`）
- **Git**：2.40+（需在 PATH 中）

> 详细环境配置请参阅 [`docs/SETUP.md`](docs/SETUP.md)。

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/refinex-lab/refinex-terminal.git
cd refinex-terminal

# 安装前端依赖
pnpm install

# 开发模式运行（热重载）
pnpm tauri dev

# 构建生产版本
pnpm tauri build
```

生产版本二进制将输出至 `src-tauri/target/release/bundle/`。

---

## ⚙️ 配置说明

Refinex Terminal 使用分层 TOML 配置系统，默认配置文件路径：

- **macOS**：`~/Library/Application Support/com.refinex.terminal/config.toml`
- **Windows**：`%APPDATA%\com.refinex.terminal\config.toml`

### `config.toml` 示例

```toml
[appearance]
theme = "refinex-dark"          # 内置主题名称或自定义 .toml 主题路径
font_family = "JetBrains Mono"  # 任意本地已安装字体
font_size = 14                  # 单位：像素
line_height = 1.4               # 行高倍数
ligatures = true
cursor_style = "bar"            # "block" | "bar" | "underline"
cursor_blink = true
opacity = 0.95                  # 0.0 – 1.0（1.0 = 完全不透明）
vibrancy = true                 # macOS 毛玻璃效果 / Windows 亚克力效果

[terminal]
shell = "auto"                  # "auto" | "/bin/zsh" | "powershell.exe" | 自定义路径
scrollback_lines = 50000
copy_on_select = true
word_separators = " \\t{}()[]'\""
bell = "visual"                 # "audio" | "visual" | "none"

[terminal.env]                  # 注入到每个会话的额外环境变量
EDITOR = "code --wait"
LANG = "zh_CN.UTF-8"

[ai]
detect_cli = true               # 自动检测 Claude Code、Codex CLI 等
block_mode = true               # 将 AI 输出归组为可折叠块
streaming_throttle_ms = 16      # 渲染批处理间隔（约 60fps）
max_block_lines = 50000         # 自动折叠前的最大行数

[git]
enabled = true
auto_fetch_interval = 300       # 秒（0 = 禁用）
show_diff_on_select = true
sign_commits = false

[keybindings]                   # 覆盖任意默认快捷键
"Cmd+Shift+P" = "command_palette"
"Cmd+D" = "split_horizontal"
"Cmd+Shift+D" = "split_vertical"
"Cmd+T" = "new_tab"
"Cmd+W" = "close_tab"
"Cmd+Shift+O" = "quick_project_switch"
"Cmd+P" = "fuzzy_file_finder"

[projects]                      # 固定项目目录
paths = [
  "~/Code/my-app",
  "~/Code/backend-api",
]
```

### 自定义主题

在任意位置创建 `.toml` 文件，并通过 `theme = "/path/to/my-theme.toml"` 引用：

```toml
[colors]
background = "#1a1b26"
foreground = "#a9b1d6"
cursor = "#c0caf5"
selection = "#33467c"
black = "#15161e"
red = "#f7768e"
green = "#9ece6a"
yellow = "#e0af68"
blue = "#7aa2f7"
magenta = "#bb9af7"
cyan = "#7dcfff"
white = "#c0caf5"
```

---

## 📂 项目结构

```
refinex-terminal/
├── CLAUDE.md                   # AI 代理指令（Claude Code）
├── README.md                   # 英文文档
├── README.zh-CN.md             # 中文文档（本文件）
├── LICENSE                     # MIT 许可证
├── CONTRIBUTING.md             # 贡献指南
├── package.json                # 前端依赖与脚本
├── pnpm-lock.yaml
├── tsconfig.json               # TypeScript 配置
├── vite.config.ts              # Vite 构建配置
├── tailwind.config.ts          # Tailwind CSS v4 配置
├── docs/
│   ├── PPLAN.md                # 分阶段实施计划
│   ├── SETUP.md                # 环境配置指南
│   └── assets/                 # 文档图片资源
├── .github/
│   ├── COMMIT_CONVENTION.md    # Git 提交规范
│   └── workflows/              # CI/CD 流水线
├── src/                        # 前端源码（React + TypeScript）
│   ├── main.tsx                # React 入口
│   ├── App.tsx                 # 根组件
│   ├── components/
│   │   ├── terminal/           # 终端模拟器组件
│   │   ├── sidebar/            # 项目导航器与文件树
│   │   ├── git/                # Git 面板组件
│   │   ├── tabs/               # 标签栏与管理
│   │   ├── command-palette/    # 命令面板覆层
│   │   └── ui/                 # shadcn/ui 基础组件
│   ├── hooks/                  # 自定义 React Hooks
│   ├── stores/                 # Zustand 状态仓库
│   ├── lib/                    # 工具函数 & Tauri IPC 封装
│   ├── styles/                 # 全局样式 & Tailwind 引入
│   └── types/                  # TypeScript 类型定义
├── src-tauri/                  # Rust 后端（Tauri 2）
│   ├── Cargo.toml              # Rust 依赖
│   ├── tauri.conf.json         # Tauri 应用配置
│   ├── capabilities/           # Tauri 权限能力
│   ├── src/
│   │   ├── main.rs             # Tauri 入口
│   │   ├── lib.rs              # 库根模块
│   │   ├── pty/                # PTY 管理模块
│   │   ├── git/                # Git 操作模块
│   │   ├── fs/                 # 文件系统模块
│   │   ├── config/             # 配置模块
│   │   ├── cli/                # AI CLI 检测与管理
│   │   └── commands/           # Tauri IPC 命令处理器
│   └── icons/                  # 应用图标
└── themes/                     # 内置主题 TOML 文件
```

---

## 🗺 开发路线图

### v0.1.0 — 基础框架（里程碑 1）
- [x] 项目脚手架（Tauri 2 + React 19 + TypeScript）
- [ ] 基础终端模拟（xterm.js + PTY）
- [ ] 标签页管理（新建、关闭、切换）
- [ ] 可配置外观（字体、主题、透明度）

### v0.2.0 — AI 集成（里程碑 2）
- [ ] AI 输出块检测与归组
- [ ] 流式安全渲染管线
- [ ] CLI 自动检测（Claude Code、Codex 等）
- [ ] 代理状态指示器

### v0.3.0 — 多项目与文件系统（里程碑 3）
- [ ] 侧边栏项目导航器
- [ ] 文件树点击打开
- [ ] 应用内文件预览与基础编辑器
- [ ] 快速项目切换

### v0.4.0 — Git 集成（里程碑 4）
- [ ] Git 状态面板（已暂存、未暂存、未跟踪）
- [ ] 内联差异查看器
- [ ] 从 UI 完成提交、推送、拉取、获取
- [ ] AI 自动生成提交信息

### v0.5.0 — 打磨与性能（里程碑 5）
- [ ] 命令面板
- [ ] 分屏布局
- [ ] 快捷键自定义
- [ ] 性能分析与优化
- [ ] 无障碍审计

### v1.0.0 — 正式发布
- [ ] 自动更新
- [ ] 安装包签名（macOS 公证，Windows 代码签名）
- [ ] 用户文档站点
- [ ] 插件 API（实验性）

---

## 🤝 参与贡献

我们欢迎各种形式的贡献！无论是 Bug 报告、功能建议、文档完善，还是代码提交 —— 每一份帮助都弥足珍贵。

提交 Pull Request 前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

---

## 📄 许可证

本项目采用 **MIT 许可证** —— 详情参见 [LICENSE](LICENSE) 文件。

---

<div align="center">

**如果 Refinex Terminal 对你的 AI 辅助开发工作流有所帮助，请考虑给项目点一个 ⭐**

用 ❤️ 和 🦀 Rust 打造 · [refinex-lab](https://github.com/refinex-lab)

</div>
