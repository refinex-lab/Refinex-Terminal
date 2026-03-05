use std::fs;
use std::path::PathBuf;

#[tauri::command]
pub fn read_theme_file(path: String) -> Result<String, String> {
    let path_buf = PathBuf::from(path);
    fs::read_to_string(path_buf).map_err(|e| format!("Failed to read theme file: {}", e))
}
