use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::time::SystemTime;

/// File entry information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub is_symlink: bool,
    pub size: u64,
    pub modified: u64, // Unix timestamp in seconds
}

/// Patterns to ignore when reading directories
const IGNORE_PATTERNS: &[&str] = &[
    ".git",
    "node_modules",
    ".DS_Store",
    "__pycache__",
    ".next",
    "target",
    "dist",
    "build",
    ".vscode",
    ".idea",
    "*.pyc",
    ".cache",
    "coverage",
    ".turbo",
];

/// Check if a file name matches any ignore pattern
fn should_ignore(name: &str) -> bool {
    IGNORE_PATTERNS.iter().any(|pattern| {
        if pattern.contains('*') {
            // Simple wildcard matching
            let pattern = pattern.replace("*.", ".");
            name.ends_with(&pattern)
        } else {
            name == *pattern
        }
    })
}

/// Read directory contents and return sorted file entries
#[tauri::command]
pub async fn read_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let dir_path = Path::new(&path);

    if !dir_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    if !dir_path.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let entries = fs::read_dir(dir_path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut file_entries: Vec<FileEntry> = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let file_name = entry.file_name().to_string_lossy().to_string();

        // Skip ignored files
        if should_ignore(&file_name) {
            continue;
        }

        let metadata = entry
            .metadata()
            .map_err(|e| format!("Failed to read metadata: {}", e))?;

        let file_path = entry.path().to_string_lossy().to_string();
        let is_directory = metadata.is_dir();
        let is_symlink = metadata.is_symlink();
        let size = metadata.len();

        let modified = metadata
            .modified()
            .ok()
            .and_then(|time| time.duration_since(SystemTime::UNIX_EPOCH).ok())
            .map(|duration| duration.as_secs())
            .unwrap_or(0);

        file_entries.push(FileEntry {
            name: file_name,
            path: file_path,
            is_directory,
            is_symlink,
            size,
            modified,
        });
    }

    // Sort: directories first (alphabetical), then files (alphabetical)
    file_entries.sort_by(|a, b| {
        match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(file_entries)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_should_ignore() {
        assert!(should_ignore(".git"));
        assert!(should_ignore("node_modules"));
        assert!(should_ignore(".DS_Store"));
        assert!(should_ignore("__pycache__"));
        assert!(!should_ignore("src"));
        assert!(!should_ignore("README.md"));
    }
}
