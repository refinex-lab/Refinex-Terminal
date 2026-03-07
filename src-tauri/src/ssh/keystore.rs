use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

/// SSH key information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshKeyInfo {
    pub path: String,
    pub filename: String,
    pub key_type: String,
    pub has_passphrase: bool,
    pub public_key_path: Option<String>,
}

/// Keystore service name for SSH passwords
const SERVICE_NAME: &str = "refinex-terminal-ssh";

/// Store SSH host password securely
pub fn store_password(host_id: &str, password: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, host_id)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;

    entry
        .set_password(password)
        .map_err(|e| format!("Failed to store password: {}", e))?;

    Ok(())
}

/// Retrieve SSH host password from secure storage
pub fn get_password(host_id: &str) -> Option<String> {
    let entry = Entry::new(SERVICE_NAME, host_id).ok()?;

    match entry.get_password() {
        Ok(password) => Some(password),
        Err(_) => None,
    }
}

/// Delete SSH host password from secure storage
pub fn delete_password(host_id: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, host_id)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;

    entry
        .delete_credential()
        .map_err(|e| format!("Failed to delete password: {}", e))?;

    Ok(())
}

/// List all SSH private keys in a directory
pub fn list_ssh_keys(dir: &Path) -> Result<Vec<SshKeyInfo>, String> {
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut keys = Vec::new();

    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        // Skip directories
        if path.is_dir() {
            continue;
        }

        let filename = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        // Skip public keys and known_hosts
        if filename.ends_with(".pub")
            || filename == "known_hosts"
            || filename == "config"
            || filename == "authorized_keys"
        {
            continue;
     }

        // Try to detect if this is a private key
        if let Ok(content) = fs::read_to_string(&path) {
            if is_private_key(&content) {
                let key_type = detect_key_type(&content);
                let has_passphrase = content.contains("ENCRYPTED");

                // Check if public key exists
                let public_key_path = {
                    let pub_path = format!("{}.pub", path.to_string_lossy());
                    if Path::new(&pub_path).exists() {
                        Some(pub_path)
                    } else {
                        None
                    }
                };

                keys.push(SshKeyInfo {
                    path: path.to_string_lossy().to_string(),
                    filename,
                    key_type,
                    has_passphrase,
                    public_key_path,
                });
            }
        }
    }

    Ok(keys)
}

/// Check if content looks like a private key
fn is_private_key(content: &str) -> bool {
    content.contains("BEGIN") && content.contains("PRIVATE KEY")
}

/// Detect SSH key type from content
fn detect_key_type(content: &str) -> String {
    if content.contains("BEGIN RSA PRIVATE KEY") {
        "RSA".to_string()
    } else if content.contains("BEGIN DSA PRIVATE KEY") {
        "DSA".to_string()
    } else if content.contains("BEGIN EC PRIVATE KEY") {
        "ECDSA".to_string()
    } else if content.contains("BEGIN OPENSSH PRIVATE KEY") {
        // OpenSSH format can be RSA, Ed25519, ECDSA, etc.
        // Try to detect from the content
        if content.contains("ssh-ed25519") {
            "Ed25519".to_string()
        } else if content.contains("ecdsa-") {
            "ECDSA".to_string()
        } else if content.contains("ssh-rsa") {
            "RSA".to_string()
        } else {
            "OpenSSH".to_string()
        }
    } else if content.contains("BEGIN PRIVATE KEY") {
        "PKCS#8".to_string()
    } else {
        "Unknown".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_key_type() {
        assert_eq!(
            detect_key_type("-----BEGIN RSA PRIVATE KEY-----"),
            "RSA"
        );
        assert_eq!(
            detect_key_type("-----BEGIN OPENSSH PRIVATE KEY-----\nssh-ed25519"),
            "Ed25519"
        );
    }

    #[test]
    fn test_is_private_key() {
        assert!(is_private_key("-----BEGIN RSA PRIVATE KEY-----"));
        assert!(is_private_key("-----BEGIN OPENSSH PRIVATE KEY-----"));
        assert!(!is_private_key("ssh-rsa AAAAB3NzaC1yc2EA..."));
    }
}
