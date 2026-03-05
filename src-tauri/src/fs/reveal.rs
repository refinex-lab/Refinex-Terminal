use std::path::Path;
use std::process::Command;

/// Reveal a file or directory in Finder (macOS) or Explorer (Windows)
#[tauri::command]
pub async fn reveal_in_finder(path: String) -> Result<(), String> {
    let target = Path::new(&path);

    if !target.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    #[cfg(target_os = "macos")]
    {
        // Use `open -R` to reveal the file in Finder
        Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open Finder: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        // Use `explorer /select,` to reveal the file in Explorer
        Command::new("explorer")
            .arg("/select,")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open Explorer: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        // Try to use xdg-open to open the parent directory
        let parent = target.parent().ok_or("Failed to get parent directory")?;
        Command::new("xdg-open")
            .arg(parent)
            .spawn()
            .map_err(|e| format!("Failed to open file manager: {}", e))?;
    }

    Ok(())
}
