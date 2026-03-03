# Contributing to Refinex Terminal

Thank you for your interest in contributing to **Refinex Terminal**! 🎉
We welcome all kinds of contributions: bug reports, feature suggestions, documentation improvements, and code.

## Table of Contents
- [Getting Started](#getting-started)
- [Branch Strategy](#branch-strategy)
- [Commit Message Convention](#commit-message-convention)
- [Pull Request Process](#pull-request-process)
- [Code Standards](#code-standards)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

## Getting Started

### Prerequisites
- Rust 1.80+
- Node.js 18+ (LTS)
- Git
- macOS 12+ (Apple Silicon preferred) or Windows 10/11

### Fork and Clone
```bash
git clone https://github.com/<your-username>/Refinex-Terminal.git
cd Refinex-Terminal
git remote add upstream https://github.com/refinex-lab/Refinex-Terminal.git
rustup component add clippy rustfmt rust-src
cargo tauri dev
```

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `master` | Stable release branch. Do **not** push directly. |
| `dev` | Main development branch. Base all feature branches from here. |
| `feature/<name>` | New features |
| `fix/<name>` | Bug fixes |
| `chore/<name>` | Tooling, CI, dependency updates |
| `docs/<name>` | Documentation-only changes |

```bash
git checkout dev
git pull upstream dev
git checkout -b feature/your-feature-name
```

## Commit Message Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `revert`

Examples:
```
feat(ai): add Claude Code block detector
fix(pty): resolve PTY resize panic on macOS
docs(readme): update architecture diagram
chore(ci): add Windows ARM build target
```

## Pull Request Process

1. Ensure your branch is up to date with `dev`
2. Run all checks: `cargo fmt --check && cargo clippy -- -D warnings && cargo test`
3. Open a PR against the `dev` branch (not `master`)
4. Fill in the PR template completely
5. PRs require at least 1 approval before merging

## Code Standards

- **Formatting**: `cargo fmt` enforced by CI
- **Linting**: `cargo clippy -- -D warnings` must pass
- **Tests**: Add tests for new functionality
- **Unsafe code**: Avoid unless absolutely necessary
- **Error handling**: Use `Result`/`Option` idiomatically — no `.unwrap()` in production code
- **Documentation**: Public APIs must have `///` doc comments

## Reporting Bugs

Use the Bug Report issue template. Include OS, version, reproduction steps, and logs.

## Requesting Features

Use the Feature Request issue template. Describe the use case and problem it solves.

---

Thanks for helping make Refinex Terminal better for everyone! 🚀