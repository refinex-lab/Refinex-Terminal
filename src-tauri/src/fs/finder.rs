use ignore::WalkBuilder;
use std::path::Path;

/// List all files in a directory recursively, respecting .gitignore
#[tauri::command]
pub async fn list_all_files(
    root: String,
    ignore_patterns: Vec<String>,
) -> Result<Vec<String>, String> {
    let root_path = Path::new(&root);

    if !root_path.exists() {
        return Err(format!("Path does not exist: {}", root));
    }

    if !root_path.is_dir() {
        return Err(format!("Path is not a directory: {}", root));
    }

    let mut files = Vec::new();

    // Build walker with .gitignore support
    let walker = WalkBuilder::new(root_path)
        .hidden(false) // Include hidden files
        .git_ignore(true) // Respect .gitignore
        .git_global(true) // Respect global .gitignore
        .git_exclude(true) // Respect .git/info/exclude
        .build();

    for entry in walker {
        match entry {
            Ok(entry) => {
                let path = entry.path();

                // Skip directories
                if path.is_dir() {
                    continue;
                }

                // Check custom ignore patterns
                let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                if should_ignore_custom(file_name, &ignore_patterns) {
                    continue;
                }

                // Convert to string and add to results
                if let Some(path_str) = path.to_str() {
                    files.push(path_str.to_string());
                }
            }
            Err(err) => {
                eprintln!("Error walking directory: {}", err);
            }
        }
    }

    Ok(files)
}

/// Check if a file name matches any custom ignore pattern
fn should_ignore_custom(name: &str, patterns: &[String]) -> bool {
    patterns.iter().any(|pattern| {
        if pattern.contains('*') {
            // Simple wildcard matching
            let pattern = pattern.replace("*.", ".");
            name.ends_with(&pattern)
        } else {
            name == pattern
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_should_ignore_custom() {
        let patterns = vec![
            ".DS_Store".to_string(),
            "*.pyc".to_string(),
            "node_modules".to_string(),
        ];

        assert!(should_ignore_custom(".DS_Store", &patterns));
        assert!(should_ignore_custom("test.pyc", &patterns));
        assert!(should_ignore_custom("node_modules", &patterns)); assert!(!should_ignore_custom("test.py", &patterns));
        assert!(!should_ignore_custom("README.md", &patterns));
    }
}
