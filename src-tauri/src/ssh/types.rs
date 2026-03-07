use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// SSH host configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshHostConfig {
    pub id: String,
    pub label: String,
    pub group: Option<String>,
    pub hostname: String,
    pub port: u16,
    pub username: String,
    pub auth_method: AuthMethod,
    pub password: Option<String>,
    pub private_key_path: Option<String>,
    pub passphrase: Option<String>,
    pub use_ssh_agent: bool,
    pub proxy_jump: Option<String>,
    pub startup_command: Option<String>,
    pub color: Option<String>,
    pub ssh_config_host: Option<String>,
    pub last_connected: Option<String>,
    pub terminal_settings: Option<TerminalSettings>,
}

/// Authentication method
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AuthMethod {
    Password,
    Key,
    Agent,
    #[serde(rename = "keyboard-interactive")]
    KeyboardInteractive,
}

/// Per-host terminal settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSettings {
    pub font_family: Option<String>,
    pub font_size: Option<u16>,
    pub theme: Option<String>,
}

/// SSH connection information
#[derive(Debug, Clone, Serialize)]
pub struct SshConnectionInfo {
    pub id: String,
    pub host_config: SshHostConfig,
    pub connected_at: String,
    pub active_channels: Vec<String>,
}

/// SSH channel information
#[derive(Debug, Clone)]
pub struct SshChannelInfo {
    pub id: String,
    pub channel_type: ChannelType,
    pub created_at: String,
}

/// Channel type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChannelType {
    Shell,
    Sftp,
    PortForward,
}

/// Host key verification response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HostKeyResponse {
    pub action: HostKeyAction,
}

/// Host key action
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HostKeyAction {
    Reject,
    AcceptOnce,
    AcceptAndRemember,
}

/// Host key verification request
#[derive(Debug, Clone, Serialize)]
pub struct HostKeyRequest {
    pub hostname: String,
    pub port: u16,
    pub key_type: String,
    pub fingerprint: String,
}
