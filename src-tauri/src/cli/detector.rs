use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;

/// Single AI CLI detection result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CLIDetectionResult {
    pub name: String,           // "claude" | "codex" | "gemini" | "gh-copilot"
    pub found: bool,
    pub path: Option<String>,   // Full binary path
    pub version: Option<String>,
    pub authenticated: Option<bool>,
    pub error: Option<String>,
}

/// Known AI CLI tools with detection metadata
const KNOWN_CLIS: &[(&str, &str, &str, &str)] = &[
    (
        "claude",
        "claude",
        "https://code.claude.com/docs/en/setup",
        "https://code.claude.com/docs/en/setup",
    ),
    (
        "codex",
        "codex",
        "https://github.com/openai/codex",
        "https://github.com/openai/codex/blob/main/codex-cli/README.md",
    ),
    (
        "gemini",
        "gemini",
        "https://github.com/google-gemini/gemini-cli",
        "https://github.com/google-gemini/gemini-cli",
    ),
    (
        "gh-copilot",
        "gh",
        "https://docs.github.com/en/copilot/github-copilot-in-the-cli",
        "https://docs.github.com/en/copilot/github-copilot-in-the-cli",
    ),
];

/// Detect installed AI CLI tools
#[tauri::command]
pub fn detect_ai_clis() -> Result<Vec<CLIDetectionResult>, String> {
    let mut results = Vec::new();

    for (name, binary, install_url, docs_url) in KNOWN_CLIS {
        let cli_result = detect_cli_detailed(name, binary, install_url, docs_url);
        results.push(cli_result);
    }

    Ok(results)
}

/// Detect a specific CLI tool with authentication check
fn detect_cli_detailed(name: &str, binary_name: &str, install_url: &str, docs_url: &str) -> CLIDetectionResult {
    // Special handling for gh-copilot
    if name == "gh-copilot" {
        return detect_gh_copilot(install_url, docs_url);
    }

    // Try to find the binary in PATH
    let path = find_in_path(binary_name);
    let found = path.is_some();

    if !found {
        // Check alternative locations
        let alt_path = match name {
            "claude" => check_claude_alternative_paths(),
            "gemini" => check_gemini_npm_global(),
            _ => None,
        };

        if let Some(alt) = alt_path {
            return CLIDetectionResult {
                name: name.to_string(),
                found: true,
                path: Some(alt.clone()),
                version: get_version_from_path(&alt, name),
                authenticated: check_authentication(name, Some(&alt)),
                error: None,
            };
        }

        return CLIDetectionResult {
            name: name.to_string(),
            found: false,
            path: None,
            version: None,
            authenticated: None,
            error: Some(format!("{} not found in PATH", binary_name)),
        };
    }

    let path_str = path.as_ref().map(|p| p.to_string_lossy().to_string());

    // Get version
    let version = get_version_for_cli(name, binary_name);

    // Check authentication
    let authenticated = check_authentication(name, path_str.as_deref());

    CLIDetectionResult {
        name: name.to_string(),
        found,
        path: path_str,
        version,
        authenticated,
        error: None,
    }
}

/// Detect GitHub Copilot CLI (standalone or gh extension)
fn detect_gh_copilot(_install_url: &str, _docs_url: &str) -> CLIDetectionResult {
    // First priority: Check for standalone 'copilot' binary
    if let Some(copilot_path) = find_in_path("copilot") {
        // Get version from standalone copilot
        let version = Command::new("copilot")
            .arg("-v")
            .output()
            .ok()
            .and_then(|v| {
                if v.status.success() {
                    let output = String::from_utf8_lossy(&v.stdout).trim().to_string();
                    // Extract version from output like "GitHub Copilot CLI 0.0.421."
                    Some(output.lines().next().unwrap_or(&output).to_string())
                } else {
                    None
                }
            });

        // For standalone copilot, check if gh is authenticated (if gh exists)
        let authenticated = if find_in_path("gh").is_some() {
            Command::new("gh")
                .args(&["auth", "status"])
                .output()
                .ok()
                .map(|a| a.status.success())
        } else {
            // If gh is not installed, we can't verify auth, assume true if copilot works
            Some(true)
        };

        return CLIDetectionResult {
            name: "gh-copilot".to_string(),
            found: true,
            path: Some(copilot_path.to_string_lossy().to_string()),
            version,
            authenticated,
            error: None,
        };
    }

    // Fallback: Check for gh-copilot extension
    let gh_path = find_in_path("gh");
    if gh_path.is_none() {
        return CLIDetectionResult {
            name: "gh-copilot".to_string(),
            found: false,
            path: None,
            version: None,
            authenticated: None,
            error: Some("GitHub Copilot CLI not found (neither 'copilot' nor 'gh' found)".to_string()),
        };
    }

    // Check if copilot extension is installed
    let output = Command::new("gh")
        .args(&["extension", "list"])
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            if stdout.contains("github/gh-copilot") || stdout.contains("gh-copilot") {
                // Get version
                let version = Command::new("gh")
                    .args(&["copilot", "--version"])
                    .output()
                    .ok()
                    .and_then(|v| {
                        if v.status.success() {
                            Some(String::from_utf8_lossy(&v.stdout).trim().to_string())
                        } else {
                            None
                        }
                    });

                // Check gh auth status
                let authenticated = Command::new("gh")
                    .args(&["auth", "status"])
                    .output()
                    .ok()
                    .map(|a| a.status.success());

                CLIDetectionResult {
                    name: "gh-copilot".to_string(),
                    found: true,
                    path: gh_path.map(|p| p.to_string_lossy().to_string()),
                    version,
                    authenticated,
                    error: None,
                }
            } else {
                CLIDetectionResult {
                    name: "gh-copilot".to_string(),
                    found: false,
                    path: gh_path.map(|p| p.to_string_lossy().to_string()),
                    version: None,
                    authenticated: None,
                    error: Some("gh-copilot extension not installed".to_string()),
                }
            }
        }
        Ok(_) | Err(_) => CLIDetectionResult {
            name: "gh-copilot".to_string(),
            found: false,
            path: gh_path.map(|p| p.to_string_lossy().to_string()),
            version: None,
            authenticated: None,
            error: Some("Failed to check gh extensions".to_string()),
        },
    }
}

/// Check Claude Code alternative installation paths
fn check_claude_alternative_paths() -> Option<String> {
    let home = dirs::home_dir()?;
    let claude_bin = home.join(".claude").join("bin").join("claude");

    if claude_bin.exists() {
        return Some(claude_bin.to_string_lossy().to_string());
    }

    None
}

/// Check Gemini CLI in npm global bin
fn check_gemini_npm_global() -> Option<String> {
    // Try to get npm global bin path
    let output = Command::new("npm")
        .args(&["bin", "-g"])
        .output()
        .ok()?;

    if output.status.success() {
        let npm_bin = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let gemini_path = PathBuf::from(npm_bin).join("gemini");

        if gemini_path.exists() {
            return Some(gemini_path.to_string_lossy().to_string());
        }
    }

    None
}

/// Get version for specific CLI with correct flags
fn get_version_for_cli(name: &str, binary_name: &str) -> Option<String> {
    let version_flag = match name {
        "claude" => "-v",      // claude -v
        "codex" => "--help",   // codex doesn't support -v, use --help
        "gemini" => "-v",      // gemini -v
        _ => "--version",
    };

    let output = Command::new(binary_name)
        .arg(version_flag)
        .output()
        .ok()?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        let combined = format!("{}{}", stdout, stderr);

        // Extract version from output
        let version_line = combined.lines().next()?.trim();

        // For codex --help, extract version from help text
        if name == "codex" {
            for line in combined.lines() {
                if line.contains("version") || line.contains("Version") {
                    return Some(line.trim().to_string());
                }
            }
            return Some("installed".to_string());
        }

        return Some(version_line.to_string());
    }

    None
}

/// Get version from a specific path
fn get_version_from_path(path: &str, name: &str) -> Option<String> {
    let version_flag = match name {
        "claude" => "-v",
        "codex" => "--help",
        "gemini" => "-v",
        _ => "--version",
    };

    let output = Command::new(path)
        .arg(version_flag)
        .output()
        .ok()?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Some(stdout.lines().next()?.trim().to_string());
    }

    None
}

/// Check authentication status for a CLI
fn check_authentication(name: &str, _path: Option<&str>) -> Option<bool> {
    match name {
        "claude" => check_claude_auth(),
        "codex" => check_codex_auth(),
        "gemini" => check_gemini_auth(),
        _ => None,
    }
}

/// Check Claude Code authentication
fn check_claude_auth() -> Option<bool> {
    // Check for credentials directory
    let home = dirs::home_dir()?;
    let claude_dir = home.join(".claude");

    // Check if credentials file exists (faster than running claude doctor)
    if claude_dir.exists() {
        // Check for common credential files
        let cred_file = claude_dir.join("credentials.json");
        let config_file = claude_dir.join("config.json");

        if cred_file.exists() || config_file.exists() {
            return Some(true);
        }

        // If directory exists but no credential files, assume not authenticated
        return Some(false);
    }

    Some(false)
}

/// Check Codex CLI authentication
fn check_codex_auth() -> Option<bool> {
    // Check OPENAI_API_KEY environment variable
    if std::env::var("OPENAI_API_KEY").is_ok() {
        return Some(true);
    }

    // Check for credentials directory
    let home = dirs::home_dir()?;
    let codex_dir = home.join(".codex");

    if codex_dir.exists() {
        // Check for credential files
        let has_creds = std::fs::read_dir(codex_dir)
            .ok()?
            .any(|entry| {
                entry.ok()
                    .and_then(|e| e.file_name().to_str().map(|s| s.contains("cred") || s.contains("token")))
                    .unwrap_or(false)
            });

        return Some(has_creds);
    }

    Some(false)
}

/// Check Gemini CLI authentication
fn check_gemini_auth() -> Option<bool> {
    // Check GEMINI_API_KEY environment variable
    if std::env::var("GEMINI_API_KEY").is_ok() {
        return Some(true);
    }

    // Check for credentials directory
    let home = dirs::home_dir()?;
    let gemini_dir = home.join(".gemini");

    if gemini_dir.exists() {
        return Some(true);
    }

    Some(false)
}

/// Find a binary in the system PATH
fn find_in_path(binary_name: &str) -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    let binary_name = format!("{}.exe", binary_name);

    // Use `which` command on Unix, `where` on Windows
    #[cfg(not(target_os = "windows"))]
    let output = Command::new("which").arg(&binary_name).output().ok()?;

    #[cfg(target_os = "windows")]
    let output = Command::new("where").arg(&binary_name).output().ok()?;

    if output.status.success() {
        let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path_str.is_empty() {
            return Some(PathBuf::from(path_str.lines().next()?));
        }
    }

    None
}

/// Get version of a CLI tool
fn get_version(binary_name: &str) -> Option<String> {
    // Try common version flags
    let version_flags = ["--version", "-v", "version"];

    for flag in &version_flags {
        let output = Command::new(binary_name).arg(flag).output().ok()?;

        if output.status.success() {
            let version_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !version_str.is_empty() {
                return Some(version_str.lines().next()?.to_string());
            }
        }
    }

    None
}

/// Test a CLI tool by running a simple command
#[tauri::command]
pub fn test_cli(binary_name: String) -> Result<String, String> {
    let output = Command::new(&binary_name)
        .arg("--version")
        .output()
        .map_err(|e| format!("Failed to execute {}: {}", binary_name, e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        Ok(format!("{}{}", stdout, stderr).trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Command failed: {}", stderr))
    }
}

/// Get the shell profile path for the current user
#[tauri::command]
pub fn get_shell_profile_path() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        // PowerShell profile
        let output = Command::new("powershell")
            .args(&["-Command", "$PROFILE"])
            .output()
            .map_err(|e| format!("Failed to get PowerShell profile: {}", e))?;

        if output.status.success() {
            let profile = String::from_utf8_lossy(&output.stdout).trim().to_string();
            return Ok(profile);
        }

        Err("Failed to determine PowerShell profile path".to_string())
    }

    #[cfg(not(target_os = "windows"))]
    {
        // Determine shell from SHELL env var
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());

        let home = dirs::home_dir().ok_or("Failed to get home directory")?;

        let profile_name = if shell.contains("zsh") {
            ".zshrc"
        } else if shell.contains("bash") {
            ".bashrc"
        } else if shell.contains("fish") {
            ".config/fish/config.fish"
        } else {
            ".profile"
        };

        Ok(home.join(profile_name).to_string_lossy().to_string())
    }
}

/// Add a line to the shell profile
#[tauri::command]
pub fn add_to_shell_profile(line: String) -> Result<(), String> {
    let profile_path = get_shell_profile_path()?;

    // Read existing content
    let existing = std::fs::read_to_string(&profile_path).unwrap_or_default();

    // Check if line already exists
    if existing.contains(&line) {
        return Err("Already configured".to_string());
    }

    // Append the line
    let new_content = format!("{}\n{}\n", existing.trim(), line);
    std::fs::write(&profile_path, new_content)
        .map_err(|e| format!("Failed to write to profile: {}", e))?;

    Ok(())
}

/// Check if a line exists in the shell profile
#[tauri::command]
pub fn check_shell_profile(line: String) -> Result<bool, String> {
    let profile_path = get_shell_profile_path()?;

    // Read existing content
    let existing = std::fs::read_to_string(&profile_path).unwrap_or_default();

    // Check if line exists
    Ok(existing.contains(&line))
}

/// Read Claude Code settings.json
#[tauri::command]
pub fn read_claude_settings() -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let settings_path = home.join(".claude").join("settings.json");

    if !settings_path.exists() {
        return Err("Settings file not found".to_string());
    }

    std::fs::read_to_string(&settings_path)
        .map_err(|e| format!("Failed to read settings: {}", e))
}

/// Write Claude Code settings.json
#[tauri::command]
pub fn write_claude_settings(content: String) -> Result<(), String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let claude_dir = home.join(".claude");
    let settings_path = claude_dir.join("settings.json");

    // Create .claude directory if it doesn't exist
    if !claude_dir.exists() {
        std::fs::create_dir_all(&claude_dir)
            .map_err(|e| format!("Failed to create .claude directory: {}", e))?;
    }

    // Write settings
    std::fs::write(&settings_path, content)
        .map_err(|e| format!("Failed to write settings: {}", e))?;

    Ok(())
}

/// Read GitHub Copilot CLI config.json
#[tauri::command]
pub fn read_copilot_config() -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let config_path = home.join(".copilot").join("config.json");

    if !config_path.exists() {
        // Return empty JSON object if config doesn't exist
        return Ok("{}".to_string());
    }

    std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config: {}", e))
}

/// Write GitHub Copilot CLI config.json
#[tauri::command]
pub fn write_copilot_config(content: String) -> Result<(), String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let copilot_dir = home.join(".copilot");
    let config_path = copilot_dir.join("config.json");

    // Create .copilot directory if it doesn't exist
    if !copilot_dir.exists() {
        std::fs::create_dir_all(&copilot_dir)
            .map_err(|e| format!("Failed to create .copilot directory: {}", e))?;
    }

    // Write config
    std::fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(())
}

/// Read GitHub Copilot MCP config
#[tauri::command]
pub fn read_copilot_mcp_config() -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let config_path = home.join(".copilot").join("mcp-config.json");

    if !config_path.exists() {
        return Ok(r#"{"mcpServers":{}}"#.to_string());
    }

    std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read MCP config: {}", e))
}

/// Write GitHub Copilot MCP config
#[tauri::command]
pub fn write_copilot_mcp_config(content: String) -> Result<(), String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let copilot_dir = home.join(".copilot");
    let config_path = copilot_dir.join("mcp-config.json");

    if !copilot_dir.exists() {
        std::fs::create_dir_all(&copilot_dir)
            .map_err(|e| format!("Failed to create .copilot directory: {}", e))?;
    }

    std::fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write MCP config: {}", e))?;

    Ok(())
}

/// Read GitHub Copilot custom instructions
#[tauri::command]
pub fn read_copilot_instructions() -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let instructions_path = home.join(".copilot").join("copilot-instructions.md");

    if !instructions_path.exists() {
        return Ok(String::new());
    }

    std::fs::read_to_string(&instructions_path)
        .map_err(|e| format!("Failed to read instructions: {}", e))
}

/// Write GitHub Copilot custom instructions
#[tauri::command]
pub fn write_copilot_instructions(content: String) -> Result<(), String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let copilot_dir = home.join(".copilot");
    let instructions_path = copilot_dir.join("copilot-instructions.md");

    if !copilot_dir.exists() {
        std::fs::create_dir_all(&copilot_dir)
            .map_err(|e| format!("Failed to create .copilot directory: {}", e))?;
    }

    std::fs::write(&instructions_path, content)
        .map_err(|e| format!("Failed to write instructions: {}", e))?;

    Ok(())
}

/// List GitHub Copilot custom agents
#[tauri::command]
pub fn list_copilot_agents() -> Result<Vec<serde_json::Value>, String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let agents_dir = home.join(".copilot").join("agents");

    if !agents_dir.exists() {
        return Ok(Vec::new());
    }

    let mut agents = Vec::new();
    let entries = std::fs::read_dir(&agents_dir)
        .map_err(|e| format!("Failed to read agents directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("md")
            && path.file_name().and_then(|s| s.to_str()).map(|s| s.ends_with(".agent.md")).unwrap_or(false) {

            let content = std::fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read agent file: {}", e))?;

            let file_name = path.file_name().unwrap().to_string_lossy().to_string();

            // Parse frontmatter and content
            let (frontmatter, body) = parse_markdown_frontmatter(&content)?;

            agents.push(serde_json::json!({
                "fileName": file_name,
                "name": file_name.replace(".agent.md", ""),
                "frontmatter": frontmatter,
                "content": body,
            }));
        }
    }

    Ok(agents)
}

/// List GitHub Copilot skills
#[tauri::command]
pub fn list_copilot_skills() -> Result<Vec<serde_json::Value>, String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let skills_dir = home.join(".copilot").join("skills");

    if !skills_dir.exists() {
        return Ok(Vec::new());
    }

    let mut skills = Vec::new();
    let entries = std::fs::read_dir(&skills_dir)
        .map_err(|e| format!("Failed to read skills directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if path.is_dir() {
            let skill_file = path.join("SKILL.md");
            if skill_file.exists() {
                let content = std::fs::read_to_string(&skill_file)
                    .map_err(|e| format!("Failed to read skill file: {}", e))?;

                let dir_name = path.file_name().unwrap().to_string_lossy().to_string();

                // Parse frontmatter and content
                let (frontmatter, body) = parse_markdown_frontmatter(&content)?;

                skills.push(serde_json::json!({
                    "dirName": dir_name,
                    "name": dir_name.clone(),
                    "frontmatter": frontmatter,
                    "content": body,
                }));
            }
        }
    }

    Ok(skills)
}

/// Save GitHub Copilot agent
#[tauri::command]
pub fn save_copilot_agent(file_name: String, frontmatter: serde_json::Value, content: String) -> Result<(), String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let agents_dir = home.join(".copilot").join("agents");

    // Create agents directory if it doesn't exist
    if !agents_dir.exists() {
        std::fs::create_dir_all(&agents_dir)
            .map_err(|e| format!("Failed to create agents directory: {}", e))?;
    }

    // Ensure file with .agent.md
    let file_name = if file_name.ends_with(".agent.md") {
        file_name
    } else {
        format!("{}.agent.md", file_name)
    };

    let agent_path = agents_dir.join(&file_name);

    // Convert frontmatter to YAML
    let yaml_frontmatter = serde_yaml::to_string(&frontmatter)
        .map_err(|e| format!("Failed to serialize frontmatter: {}", e))?;

    // Construct full markdown file with frontmatter
    let full_content = format!("---\n{}---\n\n{}", yaml_frontmatter, content);

    // Write to file
    std::fs::write(&agent_path, full_content)
        .map_err(|e| format!("Failed to write agent file: {}", e))?;

    Ok(())
}

/// Delete GitHub Copilot agent
#[tauri::command]
pub fn delete_copilot_agent(file_name: String) -> Result<(), String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let agents_dir = home.join(".copilot").join("agents");

    let agent_path = agents_dir.join(&file_name);

    if !agent_path.exists() {
        return Err(format!("Agent file not found: {}", file_name));
    }

    std::fs::remove_file(&agent_path)
        .map_err(|e| format!("Failed to delete agent file: {}", e))?;

    Ok(())
}

/// Save GitHub Copilot skill
#[tauri::command]
pub fn save_copilot_skill(dir_name: String, frontmatter: serde_json::Value, content: String) -> Result<(), String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let skills_dir = home.join(".copilot").join("skills");

    // Create skills directory if it doesn't exist
    if !skills_dir.exists() {
        std::fs::create_dir_all(&skills_dir)
            .map_err(|e| format!("Failed to create skills directory: {}", e))?;
    }

    // Create skill directory
    let skill_dir = skills_dir.join(&dir_name);
    if !skill_dir.exists() {
        std::fs::create_dir_all(&skill_dir)
            .map_err(|e| format!("Failed to create skill directory: {}", e))?;
    }

    let skill_file = skill_dir.join("SKILL.md");

    // Convert frontmatter to YAML
    let yaml_frontmatter = serde_yaml::to_string(&frontmatter)
        .map_err(|e| format!("Failed to serialize frontmatter: {}", e))?;

    // Construct full markdown file with frontmatter
    let full_content = format!("---\n{}---\n\n{}", yaml_frontmatter, content);

    // Write to file
    std::fs::write(&skill_file, full_content)
        .map_err(|e| format!("Failed to write skill file: {}", e))?;

    Ok(())
}

/// Delete GitHub Copilot skill
#[tauri::command]
pub fn delete_copilot_skill(dir_name: String) -> Result<(), String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let skills_dir = home.join(".copilot").join("skills");

    let skill_dir = skills_dir.join(&dir_name);

    if !skill_dir.exists() {
        return Err(format!("Skill directory not found: {}", dir_name));
    }

    std::fs::remove_dir_all(&skill_dir)
        .map_err(|e| format!("Failed to delete skill directory: {}", e))?;

    Ok(())
}

/// Parse Markdown frontmatter (YAML between --- delimiters)
fn parse_markdown_frontmatter(content: &str) -> Result<(serde_json::Value, String), String> {
    let lines: Vec<&str> = content.lines().collect();

    // Check if content starts with ---
    if lines.is_empty() || lines[0] != "---" {
        return Ok((serde_json::json!({}), content.to_string()));
    }

    // Find the closing ---
    let mut frontmatter_end = None;
    for (i, line) in lines.iter().enumerate().skip(1) {
        if *line == "---" {
            frontmatter_end = Some(i);
            break;
        }
    }

    let frontmatter_end = match frontmatter_end {
        Some(end) => end,
        None => return Ok((serde_json::json!({}), content.to_string())),
    };

    // Extract frontmatter YAML
    let frontmatter_lines = &lines[1..frontmatter_end];
    let frontmatter_yaml = frontmatter_lines.join("\n");

    // Parse YAML to JSON
    let frontmatter: serde_json::Value = serde_yaml::from_str(&frontmatter_yaml)
        .map_err(|e| format!("Failed to parse frontmatter YAML: {}", e))?;

    // Extract body content (everything after the closing ---)
    let body_lines = &lines[(frontmatter_end + 1)..];
    let body = body_lines.join("\n").trim().to_string();

    Ok((frontmatter, body))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_ai_clis() {
        let result = detect_ai_clis();
        assert!(result.is_ok());
        let clis = result.unwrap();
        assert_eq!(clis.len(), 4);
    }

    #[test]
    fn test_get_shell_profile_path() {
        let result = get_shell_profile_path();
        assert!(result.is_ok());
        let path = result.unwrap();
        assert!(!path.is_empty());
    }
}
