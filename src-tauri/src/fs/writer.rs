use std::fs;
use std::path::Path;

/// Rename a file or directory
#[tauri::command]
pub async fn fs_rename(old_path: String, new_path: String) -> Result<(), String> {
    let old = Path::new(&old_path);
    let new = Path::new(&new_path);

    if !old.exists() {
        return Err(format!("Source path does not exist: {}", old_path));
    }

    if new.exists() {
        return Err(format!("Destination path already exists: {}", new_path));
    }

    fs::rename(old, new)
        .map_err(|e| format!("Failed to rename: {}", e))?;

    Ok(())
}

/// Delete a file or directory
#[tauri::command]
pub async fn fs_delete(path: String) -> Result<(), String> {
    let target = Path::new(&path);

    if !target.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    if target.is_dir() {
        fs::remove_dir_all(target)
            .map_err(|e| format!("Failed to delete directory: {}", e))?;
    } else {
        fs::remove_file(target)
            .map_err(|e| format!("Failed to delete file: {}", e))?;
    }

    Ok(())
}

/// Create a new file
#[tauri::command]
pub async fn fs_create_file(path: String) -> Result<(), String> {
    let file_path = Path::new(&path);

    if file_path.exists() {
        return Err(format!("File already exists: {}", path));
    }

    fs::File::create(file_path)
        .map_err(|e| format!("Failed to create file: {}", e))?;

    Ok(())
}

/// Create a new folder
#[tauri::command]
pub async fn fs_create_folder(path: String) -> Result<(), String> {
    let folder_path = Path::new(&path);

    if folder_path.exists() {
        return Err(format!("Folder already exists: {}", path));
    }

    fs::create_dir_all(folder_path)
        .map_err(|e| format!("Failed to create folder: {}", e))?;

    Ok(())
}

/// Write content to a file
#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    let file_path = Path::new(&path);

    fs::write(file_path, content)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}
