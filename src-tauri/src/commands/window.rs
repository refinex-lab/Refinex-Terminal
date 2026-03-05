use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn set_title_bar_theme(app: AppHandle, theme: String) -> Result<(), String> {
    let webview_window = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;

    match theme.as_str() {
        "light" => {
            webview_window
                .set_theme(Some(tauri::Theme::Light))
                .map_err(|e| format!("Failed to set light theme: {}", e))?;
        }
        "dark" => {
            webview_window
                .set_theme(Some(tauri::Theme::Dark))
                .map_err(|e| format!("Failed to set dark theme: {}", e))?;
        }
        _ => return Err("Invalid theme. Use 'light' or 'dark'".to_string()),
    }

    Ok(())
}
