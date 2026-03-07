use tauri::{AppHandle, State};
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::ssh::{SshConnectionManager, SshHostConfig, SshConnectionInfo};

/// SSH connection manager state
pub struct SshManagerState {
    manager: Arc<Mutex<SshConnectionManager>>,
}

impl SshManagerState {
    pub fn new(manager: SshConnectionManager) -> Self {
        Self {
            manager: Arc::new(Mutex::new(manager)),
        }
    }

    pub async fn get_manager(&self) -> tokio::sync::MutexGuard<'_, SshConnectionManager> {
        self.manager.lock().await
    }
}

/// Connect to SSH host
#[tauri::command]
pub async fn ssh_connect(
    host_config: SshHostConfig,
    state: State<'_, SshManagerState>,
) -> Result<String, String> {
    let manager = state.get_manager().await;
    manager.connect(host_config).await
}

/// Disconnect from SSH host
#[tauri::command]
pub async fn ssh_disconnect(
    conn_id: String,
    state: State<'_, SshManagerState>,
) -> Result<(), String> {
    let manager = state.get_manager().await;
    manager.disconnect(&conn_id).await
}

/// List all active SSH connections
#[tauri::command]
pub async fn ssh_list_connections(
    state: State<'_, SshManagerState>,
) -> Result<Vec<SshConnectionInfo>, String> {
    let manager = state.get_manager().await;
    Ok(manager.list_connections().await)
}
