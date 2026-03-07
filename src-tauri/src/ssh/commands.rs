use tauri::State;
use std::path::PathBuf;
use std::sync::Arc;

use crate::ssh::{
    SshChannelManager, SshConnectionManager, SshHostConfig, SshConnectionInfo,
    SshKeyInfo, list_ssh_keys, HostKeyAction, SftpManager,
};

/// SSH connection manager state
pub struct SshManagerState {
    conn_manager: SshConnectionManager,
    channel_manager: SshChannelManager,
    pub sftp_manager: SftpManager,
}

impl SshManagerState {
    pub fn new(conn_manager: SshConnectionManager, channel_manager: SshChannelManager) -> Self {
        let conn_manager_arc = Arc::new(conn_manager);
        let sftp_manager = SftpManager::new(conn_manager_arc.clone());

        Self {
            conn_manager: Arc::try_unwrap(conn_manager_arc).unwrap_or_else(|arc| (*arc).clone()),
            channel_manager,
            sftp_manager,
        }
    }
}

/// Connect to SSH host
#[tauri::command]
pub async fn ssh_connect(
    host_config: SshHostConfig,
    state: State<'_, SshManagerState>,
) -> Result<String, String> {
    state.conn_manager.connect(host_config).await
}

/// Disconnect from SSH host
#[tauri::command]
pub async fn ssh_disconnect(
    conn_id: String,
    state: State<'_, SshManagerState>,
) -> Result<(), String> {
    state.conn_manager.disconnect(&conn_id).await
}

/// List all active SSH connections
#[tauri::command]
pub async fn ssh_list_connections(
    state: State<'_, SshManagerState>,
) -> Result<Vec<SshConnectionInfo>, String> {
    Ok(state.conn_manager.list_connections().await)
}

/// Open a shell channel on an SSH connection
#[tauri::command]
pub async fn ssh_open_shell(
    conn_id: String,
    cols: u32,
    rows: u32,
    state: State<'_, SshManagerState>,
) -> Result<String, String> {
    state
        .channel_manager
        .open_shell(&state.conn_manager, &conn_id, cols, rows)
        .await
}

/// Write data to an SSH channel
#[tauri::command]
pub async fn ssh_write(
    conn_id: String,
    channel_id: String,
    data: Vec<u8>,
    state: State<'_, SshManagerState>,
) -> Result<(), String> {
    state
        .channel_manager
        .write_channel(&state.conn_manager, &conn_id, &channel_id, data)
        .await
}

/// Resize an SSH channel's PTY
#[tauri::command]
pub async fn ssh_resize(
    conn_id: String,
    channel_id: String,
    cols: u32,
    rows: u32,
    state: State<'_, SshManagerState>,
) -> Result<(), String> {
    state
        .channel_manager
        .resize_channel(&state.conn_manager, &conn_id, &channel_id, cols, rows)
        .await
}

/// Close an SSH channel
#[tauri::command]
pub async fn ssh_close_channel(
    conn_id: String,
    channel_id: String,
    state: State<'_, SshManagerState>,
) -> Result<(), String> {
    state
        .channel_manager
        .close_channel(&state.conn_manager, &conn_id, &channel_id)
        .await
}

/// List SSH keys in a directory
#[tauri::command]
pub async fn list_ssh_keys_cmd(dir: Option<String>) -> Result<Vec<SshKeyInfo>, String> {
    let path = if let Some(dir) = dir {
        PathBuf::from(dir)
    } else {
        // Default to ~/.ssh
        let home = dirs::home_dir().ok_or_else(|| "Failed to get home directory".to_string())?;
        home.join(".ssh")
    };

    list_ssh_keys(&path)
}

/// Test SSH connection without keeping it open
#[tauri::command]
pub async fn test_ssh_connection(
    host_config: SshHostConfig,
    _app_handle: tauri::AppHandle,
) -> Result<String, String> {
    use russh::client;
    use std::net::ToSocketAddrs;
    use std::sync::Arc;
    use crate::ssh::known_hosts::{check_known_host, add_known_host, KnownHostStatus};

    // Simple test handler that accepts all host keys for testing
    struct TestHandler {
        hostname: String,
        port: u16,
    }

    #[async_trait::async_trait]
    impl client::Handler for TestHandler {
        type Error = russh::Error;

        async fn check_server_key(
            &mut self,
            server_public_key: &ssh_key::PublicKey,
        ) -> Result<bool, Self::Error> {
            // Check if host key is already known
            let known_status = check_known_host(&self.hostname, self.port, server_public_key)
                .map_err(|e| {
                    russh::Error::from(std::io::Error::new(
                        std::io::ErrorKind::Other,
                        format!("Failed to check known_hosts: {}", e),
                    ))
                })?;

            match known_status {
                KnownHostStatus::Trusted => {
                    // Already trusted
                    return Ok(true);
                }
                KnownHostStatus::Changed => {
                    // Host key changed - for test connection, we'll update it automatically
                    // This is less secure but more convenient for testing
                    add_known_host(&self.hostname, self.port, server_public_key).map_err(|e| {
                        russh::Error::from(std::io::Error::new(
                            std::io::ErrorKind::Other,
                            format!("Failed to update known_hosts: {}", e),
                        ))
                    })?;
                    return Ok(true);
                }
                KnownHostStatus::Unknown => {
                    // New host - add to known_hosts automatically for test
                    add_known_host(&self.hostname, self.port, server_public_key).map_err(|e| {
                        russh::Error::from(std::io::Error::new(
                            std::io::ErrorKind::Other,
                            format!("Failed to add to known_hosts: {}", e),
                        ))
                    })?;
                    return Ok(true);
                }
            }
        }
    }

    // Resolve hostname to socket address
    let addr = format!("{}:{}", host_config.hostname, host_config.port)
        .to_socket_addrs()
        .map_err(|e| format!("Failed to resolve hostname: {}", e))?
        .next()
        .ok_or_else(|| "No address found for hostname".to_string())?;

    // Create SSH config
    let config = Arc::new(client::Config::default());

    // Create test handler
    let handler = TestHandler {
        hostname: host_config.hostname.clone(),
        port: host_config.port,
    };

    // Connect with timeout
    let connect_future = client::connect(config, addr, handler);
    let mut handle = tokio::time::timeout(
        std::time::Duration::from_secs(15),
        connect_future,
    )
    .await
    .map_err(|_| "Connection timeout".to_string())?
    .map_err(|e| format!("Failed to connect: {}", e))?;

    // Authenticate
    let auth_result = match host_config.auth_method {
        crate::ssh::types::AuthMethod::Password => {
            let password = host_config.password.as_deref().unwrap_or("");
            handle
                .authenticate_password(&host_config.username, password)
                .await
                .map_err(|e| format!("Authentication failed: {}", e))?
        }
        crate::ssh::types::AuthMethod::Key => {
            let key_path = host_config
                .private_key_path
                .as_ref()
                .ok_or_else(|| "Private key path not provided".to_string())?;

            let key = russh_keys::load_secret_key(key_path, host_config.passphrase.as_deref())
                .map_err(|e| format!("Failed to load private key: {}", e))?;

            handle
                .authenticate_publickey(&host_config.username, Arc::new(key))
                .await
                .map_err(|e| format!("Authentication failed: {}", e))?
        }
        crate::ssh::types::AuthMethod::Agent => {
            return Err("SSH agent authentication not yet implemented for test".to_string());
        }
        crate::ssh::types::AuthMethod::KeyboardInteractive => {
            return Err("Keyboard-interactive authentication not yet implemented for test".to_string());
        }
    };

    if !auth_result {
        return Err("Authentication failed".to_string());
    }

    // Disconnect
    handle
        .disconnect(russh::Disconnect::ByApplication, "", "")
        .await
        .map_err(|e| format!("Failed to disconnect: {}", e))?;

    Ok("Connection successful".to_string())
}

