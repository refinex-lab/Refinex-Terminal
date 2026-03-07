use tauri::State;
use std::path::PathBuf;

use crate::ssh::{
    SshChannelManager, SshConnectionManager, SshHostConfig, SshConnectionInfo,
    SshKeyInfo, list_ssh_keys,
};

/// SSH connection manager state
pub struct SshManagerState {
    conn_manager: SshConnectionManager,
    channel_manager: SshChannelManager,
}

impl SshManagerState {
    pub fn new(conn_manager: SshConnectionManager, channel_manager: SshChannelManager) -> Self {
        Self {
            conn_manager,
            channel_manager,
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
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    // Create a temporary connection manager
    let temp_manager = SshConnectionManager::new(app_handle);

    // Try to connect
    let conn_id = temp_manager.connect(host_config).await?;

    // Immediately disconnect
    temp_manager.disconnect(&conn_id).await?;

    Ok("Connection successful".to_string())
}
