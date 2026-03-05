use std::fs;
use std::path::Path;
use std::time::SystemTime;
use serde::{Deserialize, Serialize};

/// File metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetadata {
    pub size: u64,
    pub modified: u64, // Unix timestamp in seconds
}

/// Get file metadata
#[tauri::command]
pub async fn get_file_metadata(path: String) -> Result<FileMetadata, String> {
    let file_path = Path::new(&path);

    if !file_path.exists() {
        return Err(format!("File does not exist: {}", path));
    }

    let metadata = fs::metadata(file_path)
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;

    let modified = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs())
        .unwrap_or(0);

    Ok(FileMetadata {
        size: metadata.len(),
        modified,
    })
}
