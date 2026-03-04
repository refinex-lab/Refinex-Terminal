use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Main application configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppConfig {
    #[serde(default)]
    pub appearance: Appearance,
    #[serde(default)]
    pub terminal: TerminalConfig,
    #[serde(default)]
    pub ai: AIConfig,
    #[serde(default)]
    pub git: GitConfig,
    #[serde(default)]
    pub keybindings: Keybindings,
}

/// Appearance configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Appearance {
    pub theme: String,
    pub font_family: String,
    pub font_size: u16,
    pub line_height: f32,
    pub font_ligatures: bool,
    pub opacity: f32,
    pub vibrancy: bool,
    pub cursor_style: String,
}

impl Default for Appearance {
    fn default() -> Self {
        Self {
            theme: "refinex-dark".to_string(),
            font_family: "JetBrains Mono".to_string(),
            font_size: 14,
            line_height: 1.5,
            font_ligatures: true,
            opacity: 1.0,
            vibrancy: false,
            cursor_style: "block".to_string(),
        }
    }
}

/// Terminal configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalConfig {
    pub shell: Option<String>,
    pub scrollback_lines: u32,
    pub copy_on_select: bool,
    pub bell_mode: String,
    pub env_vars: Vec<(String, String)>,
}

impl Default for TerminalConfig {
    fn default() -> Self {
        Self {
            shell: None,
            scrollback_lines: 10000,
            copy_on_select: true,
            bell_mode: "none".to_string(),
            env_vars: vec![],
        }
    }
}

/// AI configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIConfig {
    pub detect_cli: bool,
    pub block_mode: bool,
    pub streaming_throttle_ms: u64,
    pub max_block_lines: u32,
}

impl Default for AIConfig {
    fn default() -> Self {
        Self {
            detect_cli: true,
            block_mode: true,
            streaming_throttle_ms: 16,
            max_block_lines: 50000,
        }
    }
}

/// Git configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitConfig {
    pub enabled: bool,
    pub auto_fetch_interval: u32,
    pub show_diff: bool,
}

impl Default for GitConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            auto_fetch_interval: 300,
            show_diff: true,
        }
    }
}

/// Keybindings configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Keybindings {
    #[serde(default)]
    pub custom: Vec<(String, String)>,
}

/// Load configuration from a TOML file
pub fn load_config(path: PathBuf) -> Result<AppConfig, String> {
    if !path.exists() {
        // Return default config if file doesn't exist
        return Ok(AppConfig::default());
    }

    let contents = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read config file: {}", e))?;

    let config: AppConfig = toml::from_str(&contents)
        .map_err(|e| format!("Failed to parse config file: {}", e))?;

    Ok(config)
}

/// Save configuration to a TOML file
pub fn save_config(config: &AppConfig, path: PathBuf) -> Result<(), String> {
    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    let toml_string = toml::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(&path, toml_string)
        .map_err(|e| format!("Failed to write config file: {}", e))?;

    Ok(())
}

/// Get platform-specific config directory path
pub fn get_config_path() -> Result<PathBuf, String> {
    let config_dir = if cfg!(target_os = "macos") {
        dirs::home_dir()
            .ok_or("Failed to get home directory")?
            .join(".config")
            .join("refinex-terminal")
    } else if cfg!(target_os = "windows") {
        dirs::config_dir()
            .ok_or("Failed to get config directory")?
            .join("refinex-terminal")
    } else {
        // Linux and others
        dirs::config_dir()
            .ok_or("Failed to get config directory")?
            .join("refinex-terminal")
    };

    Ok(config_dir.join("config.toml"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = AppConfig::default();
        assert_eq!(config.appearance.theme, "refinex-dark");
        assert_eq!(config.terminal.scrollback_lines, 10000);
        assert!(config.ai.detect_cli);
        assert!(config.git.enabled);
    }

    #[test]
    fn test_config_serialization() {
        let config = AppConfig::default();
        let toml_string = toml::to_string(&config).unwrap();
        assert!(toml_string.contains("theme"));
        assert!(toml_string.contains("scrollback_lines"));
    }

    #[test]
    fn test_get_config_path() {
        let path = get_config_path().unwrap();
        assert!(path.to_string_lossy().contains("refinex-terminal"));
        assert!(path.to_string_lossy().ends_with("config.toml"));
    }
}
