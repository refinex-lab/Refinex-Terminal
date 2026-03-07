use tauri::State;
use super::sftp::{SftpManager, RemoteFileEntry};
use super::commands::SshManagerState;

/// Open SFTP session on existing SSH connection
#[tauri::command]
pub async fn sftp_open(
    conn_id: String,
    state: State<'_, SshManagerState>,
) -> Result<String, String> {
    let sftp_manager = &state.sftp_manager;
    sftp_manager.open(conn_id).await
}

/// List directory contents
#[tauri::command]
pub async fn sftp_readdir(
    session_id: String,
    path: String,
    state: State<'_, SshManagerState>,
) -> Result<Vec<RemoteFileEntry>, String> {
    let sftp_manager = &state.sftp_manager;
    sftp_manager.readdir(session_id, path).await
}

/// Get file/directory information
#[tauri::command]
pub async fn sftp_stat(
    session_id: String,
    path: String,
    state: State<'_, SshManagerState>,
) -> Result<RemoteFileEntry, String> {
    let sftp_manager = &state.sftp_manager;
    sftp_manager.stat(session_id, path).await
}

/// Read file content (for preview, limited size)
#[tauri::command]
pub async fn sftp_read_file(
    session_id: String,
    path: String,
    max_bytes: u64,
    state: State<'_, SshManagerState>,
) -> Result<String, String> {
    let sftp_manager = &state.sftp_manager;
    sftp_manager.read_file(session_id, path, max_bytes).await
}

/// Create directory
#[tauri::command]
pub async fn sftp_mkdir(
    session_id: String,
    path: String,
    state: State<'_, SshManagerState>,
) -> Result<(), String> {
    let sftp_manager = &state.sftp_manager;
    sftp_manager.mkdir(session_id, path).await
}

/// Rename file or directory
#[tauri::command]
pub async fn sftp_rename(
    session_id: String,
    old_path: String,
    new_path: String,
    state: State<'_, SshManagerState>,
) -> Result<(), String> {
    let sftp_manager = &state.sftp_manager;
    sftp_manager.rename(session_id, old_path, new_path).await
}

/// Remove file or empty directory
#[tauri::command]
pub async fn sftp_remove(
    session_id: String,
    path: String,
    state: State<'_, SshManagerState>,
) -> Result<(), String> {
    let sftp_manager = &state.sftp_manager;
    sftp_manager.remove(session_id, path).await
}

/// Remove directory recursively
#[tauri::command]
pub async fn sftp_remove_recursive(
    session_id: String,
    path: String,
    state: State<'_, SshManagerState>,
) -> Result<(), String> {
    let sftp_manager = &state.sftp_manager;
    sftp_manager.remove_recursive(session_id, path).await
}

/// Close SFTP session
#[tauri::command]
pub async fn sftp_close(
    session_id: String,
    state: State<'_, SshManagerState>,
) -> Result<(), String> {
    let sftp_manager = &state.sftp_manager;
    sftp_manager.close(session_id).await
}
