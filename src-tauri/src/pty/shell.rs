use std::env;
use std::path::PathBuf;

/// Shell configuration for PTY
#[derive(Debug, Clone)]
pub struct ShellConfig {
    pub program: String,
    pub args: Vec<String>,
    pub env: Vec<(String, String)>,
}

/// Detect the default shell for the current platform
pub fn detect_shell(custom_shell: Option<String>) -> ShellConfig {
    // If custom shell is provided, use it
    if let Some(shell_path) = custom_shell {
        return ShellConfig {
            program: shell_path.clone(),
            args: vec![],
            env: build_shell_env(),
        };
    }

    #[cfg(target_os = "macos")]
    {
        detect_macos_shell()
    }

    #[cfg(target_os = "windows")]
    {
        detect_windows_shell()
    }

    #[cfg(target_os = "linux")]
    {
        detect_linux_shell()
    }
}

#[cfg(target_os = "macos")]
fn detect_macos_shell() -> ShellConfig {
    // Try $SHELL env var first
    if let Ok(shell) = env::var("SHELL") {
        if !shell.is_empty() && PathBuf::from(&shell).exists() {
            return ShellConfig {
                program: shell,
                args: vec![],
                env: build_shell_env(),
            };
        }
    }

    // Fallback to /bin/zsh
    if PathBuf::from("/bin/zsh").exists() {
        return ShellConfig {
            program: "/bin/zsh".to_string(),
            args: vec![],
            env: build_shell_env(),
        };
    }

    // Final fallback to /bin/bash
    ShellConfig {
        program: "/bin/bash".to_string(),
        args: vec![],
        env: build_shell_env(),
    }
}

#[cfg(target_os = "windows")]
fn detect_windows_shell() -> ShellConfig {
    // Try PowerShell first
    if let Ok(powershell) = which::which("powershell.exe") {
        return ShellConfig {
            program: powershell.to_string_lossy().to_string(),
            args: vec!["-NoLogo".to_string()],
            env: build_shell_env(),
        };
    }

    // Fallback to cmd.exe
    ShellConfig {
        program: "cmd.exe".to_string(),
        args: vec![],
        env: build_shell_env(),
    }
}

#[cfg(target_os = "linux")]
fn detect_linux_shell() -> ShellConfig {
    // Try $SHELL env var first
    if let Ok(shell) = env::var("SHELL") {
        if !shell.is_empty() && PathBuf::from(&shell).exists() {
            return ShellConfig {
                program: shell,
                args: vec![],
                env: build_shell_env(),
            };
        }
    }

    // Fallback to /bin/bash
    if PathBuf::from("/bin/bash").exists() {
        return ShellConfig {
            program: "/bin/bash".to_string(),
            args: vec![],
            env: build_shell_env(),
        };
    }

    // Final fallback to /bin/sh
    ShellConfig {
        program: "/bin/sh".to_string(),
        args: vec![],
        env: build_shell_env(),
    }
}

/// Build environment variables for the shell
fn build_shell_env() -> Vec<(String, String)> {
    let mut env_vars = Vec::new();

    // Preserve PATH
    if let Ok(path) = env::var("PATH") {
        env_vars.push(("PATH".to_string(), path));
    }

    // Preserve HOME
    if let Ok(home) = env::var("HOME") {
        env_vars.push(("HOME".to_string(), home));
    } else if let Ok(userprofile) = env::var("USERPROFILE") {
        // Windows fallback
        env_vars.push(("HOME".to_string(), userprofile));
    }

    // Set TERM
    env_vars.push(("TERM".to_string(), "xterm-256color".to_string()));

    // Set LANG
    env_vars.push(("LANG".to_string(), "en_US.UTF-8".to_string()));

    // Set TERM_PROGRAM to identify Refinex Terminal
    env_vars.push(("TERM_PROGRAM".to_string(), "RefinexTerminal".to_string()));

    // Set TERM_PROGRAM_VERSION
    env_vars.push((
        "TERM_PROGRAM_VERSION".to_string(),
        env!("CARGO_PKG_VERSION").to_string(),
    ));

    // Preserve COLORTERM for true color support
    if let Ok(colorterm) = env::var("COLORTERM") {
        env_vars.push(("COLORTERM".to_string(), colorterm));
    } else {
        env_vars.push(("COLORTERM".to_string(), "truecolor".to_string()));
    }

    env_vars
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_shell() {
        let config = detect_shell(None);
        assert!(!config.program.is_empty());
        assert!(config.env.iter().any(|(k, _)| k == "TERM"));
        assert!(config.env.iter().any(|(k, _)| k == "TERM_PROGRAM"));
    }

    #[test]
    fn test_custom_shell() {
        let config = detect_shell(Some("/custom/shell".to_string()));
        assert_eq!(config.program, "/custom/shell");
    }

    #[test]
    fn test_shell_env() {
        let env = build_shell_env();
        assert!(env.iter().any(|(k, v)| k == "TERM" && v == "xterm-256color"));
        assert!(env.iter().any(|(k, v)| k == "TERM_PROGRAM" && v == "RefinexTerminal"));
        assert!(env.iter().any(|(k, _)| k == "LANG"));
    }
}
