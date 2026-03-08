use std::fs;
use std::path::Path;
use regex::Regex;
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatch {
    pub file_path: String,
    pub line_number: usize,
    pub line_content: String,
    pub match_start: usize,
    pub match_end: usize,
    pub context_before: String,
    pub context_after: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub file_path: String,
    pub matches: Vec<SearchMatch>,
}

/// Global search in files
#[tauri::command]
pub async fn global_search(
    directory: String,
    query: String,
    case_sensitive: bool,
    whole_word: bool,
    use_regex: bool,
) -> Result<Vec<SearchResult>, String> {
    if query.is_empty() {
        return Ok(Vec::new());
    }

    let search_pattern = if use_regex {
        query.clone()
    } else {
        // Escape regex special characters
        regex::escape(&query)
    };

    let pattern = if whole_word {
        format!(r"\b{}\b", search_pattern)
    } else {
        search_pattern
    };

    let regex = if case_sensitive {
        Regex::new(&pattern).map_err(|e| format!("Invalid regex: {}", e))?
    } else {
        Regex::new(&format!("(?i){}", pattern)).map_err(|e| format!("Invalid regex: {}", e))?
    };

    let mut results: Vec<SearchResult> = Vec::new();

    // Ignore patterns
    let ignore_patterns = vec![
        ".git",
        "node_modules",
        "target",
        "dist",
        "build",
        ".next",
        ".nuxt",
        "coverage",
        ".DS_Store",
        "*.pyc",
        "*.swp",
        "*.swo",
        "*.swx",
    ];

    for entry in WalkDir::new(&directory)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            let path = e.path();
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

            // Skip ignored directories and files
            !ignore_patterns.iter().any(|pattern| {
                if pattern.starts_with("*.") {
                    name.ends_with(&pattern[1..])
                } else {
                    name == *pattern
                }
            })
        })
    {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        // Only process files
        if !path.is_file() {
            continue;
        }

        // Skip binary files (basic check)
        if is_binary_file(path) {
            continue;
        }

        // Read file content
        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue, // Skip files that can't be read as text
        };

        let mut file_matches: Vec<SearchMatch> = Vec::new();

        // Search line by line
        for (line_number, line) in content.lines().enumerate() {
            for mat in regex.find_iter(line) {
                let match_start_byte = mat.start();
                let match_end_byte = mat.end();

                // Convert byte indices to char indices for JavaScript compatibility
                let match_start = line[..match_start_byte].chars().count();
                let match_end = line[..match_end_byte].chars().count();

                // Extract context (30 chars before and after)
                let chars: Vec<char> = line.chars().collect();
                let context_start_char = match_start.saturating_sub(30);
                let context_end_char = (match_end + 30).min(chars.len());

                let context_before: String = chars[context_start_char..match_start].iter().collect();
                let context_after: String = chars[match_end..context_end_char].iter().collect();

                file_matches.push(SearchMatch {
                    file_path: path.to_string_lossy().to_string(),
                    line_number: line_number + 1, // 1-indexed
                    line_content: line.to_string(),
                    match_start,  // Now char index, not byte index
                    match_end,    // Now char index, not byte index
                    context_before,
                    context_after,
                });
            }
        }

        if !file_matches.is_empty() {
            results.push(SearchResult {
                file_path: path.to_string_lossy().to_string(),
                matches: file_matches,
            });
        }
    }

    Ok(results)
}

/// Replace text in file at specific location
#[tauri::command]
pub async fn replace_in_file(
    file_path: String,
    line_number: usize,
    match_start: usize,
    match_end: usize,
    replace_text: String,
) -> Result<(), String> {
    let path = Path::new(&file_path);

    // Read file content
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    // Detect line ending style
    let line_ending = if content.contains("\r\n") {
        "\r\n"
    } else {
        "\n"
    };

    let mut lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();

    // Check if line number is valid
    if line_number == 0 || line_number > lines.len() {
        return Err(format!("Invalid line number: {}", line_number));
    }

    let line_index = line_number - 1; // Convert to 0-indexed
    let line = &lines[line_index];

    // Convert char indices to byte indices for string slicing
    let chars: Vec<char> = line.chars().collect();

    // Check if match positions are valid (char indices)
    if match_start >= chars.len() || match_end > chars.len() || match_start >= match_end {
        return Err(format!("Invalid match positions: {} - {} (line has {} chars)", match_start, match_end, chars.len()));
    }

    // Build new line using char indices
    let before: String = chars[..match_start].iter().collect();
    let after: String = chars[match_end..].iter().collect();
    let new_line = format!("{}{}{}", before, replace_text, after);

    lines[line_index] = new_line;

    // Write back to file with original line endings
    let new_content = lines.join(line_ending);

    // Preserve trailing newline if original had one
    let final_content = if content.ends_with('\n') || content.ends_with("\r\n") {
        format!("{}{}", new_content, line_ending)
    } else {
        new_content
    };

    fs::write(path, final_content)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

/// Check if a file is binary (basic heuristic)
fn is_binary_file(path: &Path) -> bool {
    // Check by extension first
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        let binary_extensions = vec![
            "exe", "dll", "so", "dylib", "bin", "dat",
            "jpg", "jpeg", "png", "gif", "bmp", "ico", "webp",
            "mp3", "mp4", "avi", "mov", "mkv", "flv",
            "zip", "tar", "gz", "rar", "7z",
            "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
            "woff", "woff2", "ttf", "otf", "eot",
        ];

        if binary_extensions.contains(&ext.to_lowercase().as_str()) {
            return true;
        }
    }

    // Read first 8KB and check for null bytes
    if let Ok(mut file) = fs::File::open(path) {
        use std::io::Read;
        let mut buffer = [0u8; 8192];
        if let Ok(n) = file.read(&mut buffer) {
            return buffer[..n].contains(&0);
        }
    }

    false
}
