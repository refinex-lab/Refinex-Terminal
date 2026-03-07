use serde::{Deserialize, Serialize};
use std::fs::{File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;

/// Known host status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum KnownHostStatus {
    Trusted,
    Unknown,
    Changed,
}

/// Known host entry
#[derive(Debug, Clone)]
struct KnownHostEntry {
    hostname: String,
    port: Option<u16>,
    key_type: String,
    key_data: String,
}

/// Get the path to known_hosts file
fn get_known_hosts_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or_else(|| "Failed to get home directory".to_string())?;
    Ok(home.join(".ssh").join("known_hosts"))
}

/// Parse a known_hosts line
fn parse_known_hosts_line(line: &str) -> Option<KnownHostEntry> {
    // Skip comments and empty lines
    if line.trim().is_empty() || line.starts_with('#') {
        return None;
    }

    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() < 3 {
        return None;
    }

    // Parse hostname (may include port like [hostname]:port)
    let host_part = parts[0];
    let (hostname, port) = if host_part.starts_with('[') {
        // Format: [hostname]:port
        let end_bracket = host_part.find(']')?;
        let hostname = host_part[1..end_bracket].to_string();
        let port_str = host_part.get(end_bracket + 2..)?;
        let port = port_str.parse::<u16>().ok();
        (hostname, port)
    } else {
        (host_part.to_string(), None)
    };

    let key_type = parts[1].to_string();
    let key_data = parts[2].to_string();

    Some(KnownHostEntry {
        hostname,
        port,
        key_type,
        key_data,
    })
}

/// Check if a host key is in known_hosts
pub fn check_known_host(
    hostname: &str,
    port: u16,
    key: &ssh_key::PublicKey,
) -> Result<KnownHostStatus, String> {
    let known_hosts_path = get_known_hosts_path()?;

    // If known_hosts doesn't exist, host is unknown
    if !known_hosts_path.exists() {
        return Ok(KnownHostStatus::Unknown);
    }

    let file = File::open(&known_hosts_path)
        .map_err(|e| format!("Failed to open known_hosts: {}", e))?;

    let reader = BufReader::new(file);

    // Serialize the key to OpenSSH format for comparison
    let key_string = key.to_openssh().map_err(|e| format!("Failed to serialize key: {}", e))?;

    // Check each line in known_hosts
    for line in reader.lines() {
        let line = line.map_err(|e| format!("Failed to read line: {}", e))?;

        if let Some(entry) = parse_known_hosts_line(&line) {
            // Check if hostname matches
            let hostname_matches = entry.hostname == hostname;

            // Check if port matches (default to 22 if not specified)
            let port_matches = entry.port.unwrap_or(22) == port;

            if hostname_matches && port_matches {
                // Host found, check if key matches
                // Compare the full key string (type + data)
                let entry_key_string = format!("{} {}", entry.key_type, entry.key_data);
                if key_string == entry_key_string {
                    return Ok(KnownHostStatus::Trusted);
                } else {
                    // Host found but key is different - this is a security issue!
                    return Ok(KnownHostStatus::Changed);
                }
            }
        }
    }

    // Host not found in known_hosts
    Ok(KnownHostStatus::Unknown)
}

/// Add a host key to known_hosts
pub fn add_known_host(
    hostname: &str,
    port: u16,
    key: &ssh_key::PublicKey,
) -> Result<(), String> {
    let known_hosts_path = get_known_hosts_path()?;

    // Ensure .ssh directory exists
    if let Some(parent) = known_hosts_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create .ssh directory: {}", e))?;
    }

    // First, remove any existing entries for this host
    // This ensures we don't have duplicate or conflicting entries
    remove_known_host(hostname, port)?;

    // Open file in append mode
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&known_hosts_path)
        .map_err(|e| format!("Failed to open known_hosts: {}", e))?;

    // Format the entry
    let host_part = if port == 22 {
        hostname.to_string()
    } else {
        format!("[{}]:{}", hostname, port)
    };

    // Serialize the key to OpenSSH format
    let key_string = key.to_openssh().map_err(|e| format!("Failed to serialize key: {}", e))?;

    let entry = format!("{} {}\n", host_part, key_string);

    // Write to file
    file.write_all(entry.as_bytes())
        .map_err(|e| format!("Failed to write to known_hosts: {}", e))?;

    Ok(())
}

/// Remove a host from known_hosts
pub fn remove_known_host(hostname: &str, port: u16) -> Result<(), String> {
    let known_hosts_path = get_known_hosts_path()?;

    if !known_hosts_path.exists() {
        return Ok(());
    }

    // Read all lines
    let file = File::open(&known_hosts_path)
        .map_err(|e| format!("Failed to open known_hosts: {}", e))?;

    let reader = BufReader::new(file);
    let mut lines = Vec::new();

    for line in reader.lines() {
        let line = line.map_err(|e| format!("Failed to read line: {}", e))?;

        // Parse the line
        if let Some(entry) = parse_known_hosts_line(&line) {
            // Skip lines matching the hostname and port
            let hostname_matches = entry.hostname == hostname;
            let port_matches = entry.port.unwrap_or(22) == port;

            if hostname_matches && port_matches {
                continue; // Skip this line
            }
        }

        lines.push(line);
    }

    // Write back to file
    let mut file = File::create(&known_hosts_path)
        .map_err(|e| format!("Failed to create known_hosts: {}", e))?;

    for line in lines {
        writeln!(file, "{}", line)
            .map_err(|e| format!("Failed to write to known_hosts: {}", e))?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_known_hosts_line() {
        // Standard format
        let line = "example.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ...";
        let entry = parse_known_hosts_line(line).unwrap();
        assert_eq!(entry.hostname, "example.com");
        assert_eq!(entry.port, None);
        assert_eq!(entry.key_type, "ssh-rsa");

        // With port
        let line = "[example.com]:2222 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA...";
        let entry = parse_known_hosts_line(line).unwrap();
        assert_eq!(entry.hostname, "example.com");
        assert_eq!(entry.port, Some(2222));
        assert_eq!(entry.key_type, "ssh-ed25519");

        // Comment
        assert!(parse_known_hosts_line("# This is a comment").is_none());

        // Empty line
        assert!(parse_known_hosts_line("").is_none());
    }
}
