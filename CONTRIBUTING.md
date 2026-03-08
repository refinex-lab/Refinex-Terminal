# Contributing to Refinex Terminal

Thank you for your interest in contributing to Refinex Terminal! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Code Style Guidelines](#code-style-guidelines)
- [Commit Convention](#commit-convention)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow:

- **Be respectful**: Treat everyone with respect and kindness
- **Be collaborative**: Work together and help each other
- **Be inclusive**: Welcome people of all backgrounds and identities
- **Be constructive**: Provide helpful feedback and suggestions
- **Be professional**: Keep discussions focused and on-topic

## Getting Started

### Prerequisites

- **Node.js**: 20.x or later
- **pnpm**: 9.x or later
- **Rust**: Latest stable (install via [rustup](https://rustup.rs/))
- **Platform-specific**:
  - macOS: Xcode Command Line Tools
  - Windows: Visual Studio Build Tools

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/refinex-terminal.git
   cd refinex-terminal
   ```
3. Add upstream remote:
   ```bash
   git remote add upstream https://github.com/refinex/refinex-terminal.git
   ```

## Development Setup

### Install Dependencies

```bash
# Install frontend dependencies
pnpm install

# Verify Rust installation
cargo --version
```

### Run in Development Mode

```bash
# Start dev server with hot-reload
pnpm tauri dev
```

The app will launch with:
- Frontend hot-reload (Vite)
- Rust backend recompilation on changes
- DevTools available (Cmd/Ctrl + Alt + I)

### Build for Production

```bash
# Build optimized binary
pnpm tauri build
```

Outputs:
- macOS: `src-tauri/target/release/bundle/dmg/*.dmg`
- Windows: `src-tauri/target/release/bundle/nsis/*.exe`

## Project Structure

```
refinex-terminal/
├── src/                    # Frontend (React + TypeScript)
│   ├── components/         # UI components
│   │   ├── terminal/       # Terminal emulator components
│   │   ├── sidebar/        # File tree and project navigation
│   │   ├── git/            # Git integration UI
│   │   ├── settings/       # Settings panels
│   │   ├── tabs/           # Tab management
│   │   └── ui/             # shadcn/ui base components
│   ├── hooks/              # Custom React hooks
│   ├── stores/             # Zustand state stores
│   ├── lib/                # Utility functions and helpers
│   ├── styles/             # CSS and Tailwind imports
│   └── types/              # TypeScript type definitions
├── src-tauri/              # Backend (Rust + Tauri)
│   ├── src/
│   │   ├── pty/            # PTY management
│   │   ├── git/            # Git operations
│   │   ├── fs/             # File system operations
│   │   ├── config/         # Configuration management
│   │   ├── cli/            # AI CLI detection
│   │   ├── ssh/            # SSH connection management
│   │   └── commands/       # Tauri IPC commands
│   ├── icons/              # Application icons
│   ├── installer/          # Windows installer scripts
│   └── Cargo.toml          # Rust dependencies
├── themes/                 # Built-in theme TOML files
├── docs/                   # Documentation
├── .github/                # GitHub workflows and templates
└── scripts/                # Build and utility scripts
```

## Code Style Guidelines

### TypeScript / React

#### General Rules

- **Strict mode**: No `any` types, no `@ts-ignore`
- **Functional components**: Use hooks, not class components
- **Named exports**: Prefer named exports over default exports
- **File naming**:
  - Components: `PascalCase.tsx`
  - Utilities: `kebab-case.ts`
  - Stores: `kebab-case-store.ts`

#### Code Style

```typescript
// ✅ Good
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface TerminalProps {
  sessionId: string;
  onClose: () => void;
}

export function Terminal({ sessionId, onClose }: TerminalProps) {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    // Effect logic
  }, [sessionId]);

  return (
    <div className="terminal-container">
      <Button onClick={onClose}>Close</Button>
    </div>
  );
}

// ❌ Bad
import React from "react";

export default class Terminal extends React.Component {
  // Class components are not used
}
```

#### Hooks

- Place hooks at the top of component body
- Custom hooks in `src/hooks/`
- Use `useCallback` and `useMemo` for optimization

#### Error Handling

```typescript
// ✅ Always wrap Tauri invoke calls
try {
  const result = await invoke<string>("command_name", { arg: value });
  // Handle success
} catch (error) {
  console.error("Operation failed:", error);
  toast.error(`Failed: ${error}`);
}
```

### Rust

#### General Rules

- **Rust 2021 edition** idioms
- **No `unwrap()`** in production code (only in tests)
- **Use `Result<T, E>`** for fallible operations
- **Doc comments** (`///`) for all public functions
- **Module naming**: `snake_case`

#### Code Style

```rust
// ✅ Good
use std::path::PathBuf;
use tauri::command;

/// Reads a file from the filesystem
///
/// # Arguments
/// * `path` - The file path to read
///
/// # Returns
/// The file contents as a string, or an error
#[command]
pub fn read_file(path: String) -> Result<String, String> {
    let path = PathBuf::from(path);
    std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

// ❌ Bad
#[command]
pub fn read_file(path: String) -> String {
    std::fs::read_to_string(path).unwrap() // Never unwrap!
}
```

#### Error Handling

- Use `thiserror` for custom error types
- Return `Result<T, String>` for Tauri commands
- Log errors with `tracing` crate

### CSS / Styling

- **Tailwind utility classes** preferred
- **No custom CSS** unless absolutely necessary
- **shadcn/ui components** for all standard UI elements
- **Responsive-aware** where applicable
- **Dark mode first**, light mode as alternative

```tsx
// ✅ Good
<div className="flex items-center gap-2 p-4 rounded-lg border">
  <Button variant="outline" size="sm">Click me</Button>
</div>

// ❌ Bad
<div style={{ display: "flex", padding: "16px" }}>
  <button className="custom-button">Click me</button>
</div>
```

## Commit Convention

We follow a strict commit message convention. See `.github/COMMIT_CONVENTION.md` for full details.

### Format

```
type(scope): message

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `build`: Build system changes
- `ci`: CI/CD changes
- `chore`: Other changes (dependencies, config)

### Examples

```bash
feat(terminal): add split pane support
fix(git): resolve merge conflict detection
docs(readme): update installation instructions
refactor(pty): simplify session management
```

### Rules

- Use imperative mood ("add" not "added")
- Lowercase message
- No period at the end
- Max 72 characters for subject line
- One logical change per commit

## Pull Request Process

### Before Submitting

1. **Create a feature branch**:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes** following code style guidelines

3. **Test your changes**:
   ```bash
   # TypeScript check
   pnpm tsc --noEmit

   # Rust check
   cd src-tauri && cargo clippy -- -D warnings

   # Build test
   pnpm tauri build
   ```

4. **Commit with proper convention**:
   ```bash
   git commit -m "feat(scope): add new feature"
   ```

5. **Push to your fork**:
   ```bash
   git push origin feat/your-feature-name
   ```

### Submitting the PR

1. **Open a Pull Request** on GitHub
2. **Fill out the PR template** completely
3. **Link related issues** (e.g., "Closes #123")
4. **Request review** from maintainers

### PR Requirements

- ✅ All CI checks pass (TypeScript, Rust, build)
- ✅ Code follows style guidelines
- ✅ Commits follow convention
- ✅ No merge conflicts
- ✅ Documentation updated (if needed)
- ✅ Tests added/updated (if applicable)

### Review Process

1. Maintainers will review your PR
2. Address any requested changes
3. Once approved, a maintainer will merge

### After Merge

1. Delete your feature branch
2. Pull latest changes:
   ```bash
   git checkout master
   git pull upstream master
   ```

## Issue Guidelines

### Before Creating an Issue

1. **Search existing issues** to avoid duplicates
2. **Check documentation** for answers
3. **Try latest version** to see if issue is fixed

### Bug Reports

Use the bug report template and include:

- **Description**: Clear description of the bug
- **Steps to reproduce**: Detailed steps
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Environment**:
  - OS and version
  - Refinex Terminal version
  - Relevant configuration
- **Screenshots**: If applicable
- **Logs**: Console output or error messages

### Feature Requests

Use the feature request template and include:

- **Problem**: What problem does this solve?
- **Proposed solution**: How should it work?
- **Alternatives**: Other solutions considered
- **Additional context**: Mockups, examples, etc.

### Questions

For questions:
- Check documentation first
- Search existing issues
- Use GitHub Discussions (if enabled)
- Be specific and provide context

## Testing

### Manual Testing

Before submitting a PR, test:

1. **Core functionality**:
   - Terminal spawns and works
   - Tabs can be created/closed
   - Settings apply correctly

2. **Your changes**:
   - Feature works as intended
   - No regressions in related features
   - Edge cases handled

3. **Cross-platform** (if applicable):
   - Test on macOS and Windows
   - Verify platform-specific features

### Automated Testing

```bash
# TypeScript type check
pnpm tsc --noEmit

# Rust lint
cd src-tauri
cargo clippy -- -D warnings

# Rust tests (when available)
cargo test
```

### Build Verification

```bash
# Full production build
pnpm tauri build

# Verify binary works
# macOS: Open the .dmg
# Windows: Run the .exe installer
```

## Documentation

### When to Update Docs

- Adding new features
- Changing existing behavior
- Adding configuration options
- Fixing bugs that affect usage

### Documentation Files

- **README.md**: Overview, installation, basic usage
- **CHANGELOG.md**: All changes per version
- **docs/*.md**: Detailed guides and references
- **Code comments**: Complex logic, public APIs

### Writing Style

- Clear and concise
- Use examples
- Include code snippets
- Link to related docs
- Keep up-to-date

## Development Tips

### Debugging

**Frontend**:
```bash
# Open DevTools in running app
Cmd/Ctrl + Alt + I
```

**Backend**:
```rust
// Add tracing logs
use tracing::{info, error, debug};

info!("Operation started");
debug!("Debug info: {:?}", value);
error!("Operation failed: {}", err);
```

### Hot Reload

- Frontend changes reload automatically
- Rust changes require app restart
- Config changes apply on save (hot-reload)

### Common Issues

**Build fails**:
- Clear caches: `rm -rf node_modules target dist`
- Reinstall: `pnpm install`
- Update Rust: `rustup update`

**TypeScript errors**:
- Run `pnpm tsc --noEmit` to see all errors
- Check `tsconfig.json` for strict settings

**Rust errors**:
- Run `cargo clippy` for detailed warnings
- Check `Cargo.toml` for dependency conflicts

## Getting Help

- **Documentation**: Check `docs/` directory
- **Issues**: Search existing issues
- **Discussions**: GitHub Discussions (if enabled)
- **Code**: Read existing code for patterns

## Recognition

Contributors will be:
- Listed in release notes
- Credited in CHANGELOG.md
- Recognized in the community

Thank you for contributing to Refinex Terminal! 🚀
