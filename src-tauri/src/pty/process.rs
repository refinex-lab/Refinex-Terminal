use std::process::Command;

/// Detect CLI type from process name
fn detect_cli_from_pid(pid: u32) -> Option<String> {
    #[cfg(target_os = "macos")]
    {
        detect_cli_macos(pid)
    }

    #[cfg(target_os = "windows")]
    {
        detect_cli_windows(pid)
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        detect_cli_linux(pid)
    }
}

#[cfg(target_os = "macos")]
fn detect_cli_macos(pid: u32) -> Option<String> {
    // Use ps to get process name
    let output = Command::new("ps")
        .args(["-p", &pid.to_string(), "-o", "comm="])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let process_name = String::from_utf8_lossy(&output.stdout)
        .trim()
        .to_string();

    classify_cli_from_name(&process_name)
}

#[cfg(target_os = "windows")]
fn detect_cli_windows(pid: u32) -> Option<String> {
    // Use tasklist to get process name
    let output = Command::new("tasklist")
        .args(["/FI", &format!("PID eq {}", pid), "/FO", "CSV", "/NH"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let output_str = String::from_utf8_lossy(&output.stdout);
    // Parse CSV: "process.exe","PID","Session Name","Session#","Mem Usage"
    let parts: Vec<&str> = output_str.split(',').collect();
    if parts.is_empty() {
        return None;
    }

    let process_name = parts[0].trim_matches('"').to_string();
    classify_cli_from_name(&process_name)
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn detect_cli_linux(pid: u32) -> Option<String> {
    // Read from /proc/[pid]/comm
    let comm_path = format!("/proc/{}/comm", pid);
    let process_name = std::fs::read_to_string(comm_path).ok()?;
    classify_cli_from_name(process_name.trim())
}

/// Classify CLI type from process name
fn classify_cli_from_name(name: &str) -> Option<String> {
    let name_lower = name.to_lowercase();

    // Check for known CLI binaries
    if name_lower.contains("claude") {
        Some("claude".to_string())
    } else if name_lower.contains("codex") {
        Some("codex".to_string())
    } else if name_lower.contains("gemini") {
        Some("gemini".to_string())
    } else if name_lower.contains("copilot") {
        Some("copilot".to_string())
    } else if name_lower.contains("gh") {
        // Check if it's gh copilot by looking at parent process or args
        // For now, return copilot if we see gh
        Some("copilot".to_string())
    } else {
        None
    }
}

/// Get all child processes of a given PID
fn get_child_processes(parent_pid: u32) -> Vec<u32> {
    #[cfg(target_os = "macos")]
    {
        get_child_processes_macos(parent_pid)
    }

    #[cfg(target_os = "windows")]
    {
        get_child_processes_windows(parent_pid)
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        get_child_processes_linux(parent_pid)
    }
}

#[cfg(target_os = "macos")]
fn get_child_processes_macos(parent_pid: u32) -> Vec<u32> {
    let output = Command::new("pgrep")
        .args(["-P", &parent_pid.to_string()])
        .output();

    if let Ok(output) = output {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            return stdout
                .lines()
                .filter_map(|line| line.trim().parse::<u32>().ok())
                .collect();
        }
    }

    Vec::new()
}

#[cfg(target_os = "windows")]
fn get_child_processes_windows(parent_pid: u32) -> Vec<u32> {
    let output = Command::new("wmic")
        .args([
            "process",
            "where",
            &format!("(ParentProcessId={})", parent_pid),
            "get",
            "ProcessId",
        ])
        .output();

    if let Ok(output) = output {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            return stdout
                .lines()
                .skip(1) // Skip header
                .filter_map(|line| line.trim().parse::<u32>().ok())
                .collect();
        }
    }

    Vec::new()
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn get_child_processes_linux(parent_pid: u32) -> Vec<u32> {
    let output = Command::new("pgrep")
        .args(["-P", &parent_pid.to_string()])
        .output();

    if let Ok(output) = output {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            return stdout
                .lines()
                .filter_map(|line| line.trim().parse::<u32>().ok())
                .collect();
        }
    }

    Vec::new()
}

/// Tauri command to detect CLI type from PTY session
#[tauri::command]
pub async fn detect_pty_cli(pty_pid: u32) -> Result<Option<String>, String> {
    // First check the shell process itself
    if let Some(cli_type) = detect_cli_from_pid(pty_pid) {
        return Ok(Some(cli_type));
    }

    // Check child processes (the actual CLI might be a child of the shell)
    let children = get_child_processes(pty_pid);
    for child_pid in children {
        if let Some(cli_type) = detect_cli_from_pid(child_pid) {
            return Ok(Some(cli_type));
        }
    }

    Ok(None)
}
