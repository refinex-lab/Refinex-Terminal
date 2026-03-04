# Git Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/) v1.0.0 with project-specific scopes.

---

## Commit Message Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

### Rules

1. **Subject line** must be under 72 characters.
2. **Subject** uses imperative mood, lowercase, no trailing period.
3. **Body** (if present) is separated from the subject by a blank line, wrapped at 80 characters.
4. **Footer** (if present) contains references to issues (e.g., `Closes #42`).

---

## Types

| Type | Description |
|------|-------------|
| `feat` | A new feature or capability |
| `fix` | A bug fix |
| `docs` | Documentation changes only |
| `style` | Formatting, whitespace, semicolons — no code logic change |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `build` | Build system or dependency changes (Cargo.toml, package.json, Vite config) |
| `ci` | CI/CD configuration changes (GitHub Actions) |
| `chore` | Maintenance tasks (version bumps, .gitignore, tooling) |

---

## Scopes

Use the module or feature area as the scope. Common scopes for this project:

| Scope | Area |
|-------|------|
| `pty` | PTY manager (Rust) and terminal process handling |
| `terminal` | Terminal UI (xterm.js, TerminalView) |
| `tabs` | Tab management |
| `sidebar` | Sidebar, project navigator, file tree |
| `git` | Git integration (Rust module and Git panel UI) |
| `config` | Configuration system (TOML, settings UI) |
| `theme` | Theme engine and built-in themes |
| `ai` | AI block detection, CLI wizard, agent status |
| `keybindings` | Keybinding system and command palette |
| `split` | Split pane layout |
| `fs` | File system operations (Rust watcher, file preview) |
| `build` | Build pipeline, packaging, signing |
| `ci` | GitHub Actions and CI workflows |
| `deps` | Dependency updates |
| `ui` | General UI components (shadcn, layout) |
| `app` | Application-level (window management, startup) |

If a change spans multiple scopes, use the most dominant one.

---

## Examples

```
feat(pty): implement PTY spawn and resize commands
fix(terminal): resolve WebGL addon crash on window resize
docs(readme): add architecture diagram and tech stack table
style(sidebar): align file tree indent with project navigator
refactor(git): extract diff parsing into separate module
perf(terminal): batch PTY output writes to 60fps render cycle
test(config): add unit tests for TOML parsing edge cases
build(deps): upgrade xterm.js to 5.5.0
ci(release): add macOS notarization step to release workflow
chore(app): update version to 0.2.0
```

### With body and footer

```
feat(ai): add Claude Code output block detection

Implement heuristic-based detection of Claude Code output boundaries
using box-drawing characters and header markers. Blocks are tracked
per terminal session and exposed via useAIBlocks hook.

The detection runs on each PTY output chunk and maintains a state
machine to handle streaming output without false positives.

Closes #15
```

---

## Branch Naming

```
<type>/<short-description>
```

Examples:
```
feat/pty-manager
fix/terminal-resize-crash
docs/setup-guide
refactor/git-module-split
```

---

## Pull Request Title

PR titles follow the same format as commit subjects:

```
feat(terminal): add search overlay with regex support
```

If a PR contains multiple commits, the PR title should summarize the overall change.

---

## Breaking Changes

If a commit introduces a breaking change, add `BREAKING CHANGE:` in the footer or append `!` after the type/scope:

```
feat(config)!: change config format from JSON to TOML

BREAKING CHANGE: Configuration files must be migrated from .json to .toml format.
See docs/migration-0.2.md for migration guide.
```

---

## Enforcement

- Claude Code must follow this convention for all commits (specified in CLAUDE.md).
- CI may be configured to lint commit messages using `commitlint` in the future.
- Squash-merge PRs should produce a single commit following this format.