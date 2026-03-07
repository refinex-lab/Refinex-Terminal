use tauri::State;
use super::transfer::TransferManager;
use super::commands::SshManagerState;

/// Upload file from local to remote
#[tauri::command]
pub async fn sftp_upload(
    session_id: String,
    local_path: String,
    remote_path: String,
    state: State<'_, SshManagerState>,
) -> Result<String, String> {
    state.transfer_manager.upload(session_id, local_path, remote_path).await
}

/// Download file from remote to local
#[tauri::command]
pub async fn sftp_download(
    session_id: String,
    remote_path: String,
    local_path: String,
    state: State<'_, SshManagerState>,
) -> Result<String, String> {
    state.transfer_manager.download(session_id, remote_path, local_path).await
}

/// Upload directory recursively
#[tauri::command]
pub async fn sftp_upload_directory(
    session_id: String,
    local_dir: String,
    remote_dir: String,
    state: State<'_, SshManagerState>,
) -> Result<Vec<String>, String> {
    state.transfer_manager.upload_directory(session_id, local_dir, remote_dir).await
}

/// Cancel transfer
#[tauri::command]
pub async fn sftp_cancel_transfer(
    transfer_id: String,
    state: State<'_, SshManagerState>,
) -> Result<(), String> {
    state.transfer_manager.cancel_transfer(transfer_id).await
}
