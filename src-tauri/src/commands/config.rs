use crate::config::{get_config_path, save_config, AppConfig};
use std::sync::{Arc, Mutex};
use tauri::State;

/// Managed state for configuration
pub struct ConfigState {
    pub config: Arc<Mutex<AppConfig>>,
}

impl ConfigState {
    pub fn new(config: AppConfig) -> Self {
        Self {
            config: Arc::new(Mutex::new(config)),
        }
    }
}

/// Get the current configuration
#[tauri::command]
pub fn get_config(state: State<ConfigState>) -> Result<AppConfig, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config.clone())
}

/// Update the configuration
#[tauri::command]
pub fn update_config(
    state: State<ConfigState>,
    new_config: AppConfig,
) -> Result<(), String> {
    // Update in-memory config
    {
        let mut config = state.config.lock().map_err(|e| e.to_string())?;
        *config = new_config.clone();
    }

    // Save to disk
    let config_path = get_config_path()?;
    save_config(&new_config, config_path)?;

    Ok(())
}

/// Reset configuration to defaults
#[tauri::command]
pub fn reset_config(state: State<ConfigState>) -> Result<(), String> {
    let default_config = AppConfig::default();

    // Update in-memory config
    {
        let mut config = state.config.lock().map_err(|e| e.to_string())?;
        *config = default_config.clone();
    }

    // Save to disk
    let config_path = get_config_path()?;
    save_config(&default_config, config_path)?;

    Ok(())
}

/// Get the config file path
#[tauri::command]
pub fn get_config_file_path() -> Result<String, String> {
    let path = get_config_path()?;
    Ok(path.to_string_lossy().to_string())
}
