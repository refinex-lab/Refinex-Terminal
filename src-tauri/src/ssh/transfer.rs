use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::fs::File;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::{Mutex, Semaphore};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use super::sftp::SftpManager;

const CHUNK_SIZE: usize = 256 * 1024; // 256KB
const MAX_CONCURRENT_TRANSFERS: usize = 3;
const SPEED_WINDOW_SECS: u64 = 5;

/// Transfer direction
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TransferDirection {
    Upload,
    Download,
}

/// Transfer progress event
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferProgress {
    pub transfer_id: String,
    pub direction: TransferDirection,
    pub file_name: String,
    pub bytes_transferred: u64,
    pub total_bytes: u64,
    pub speed: f64, // bytes per second
}

/// Active transfer info
struct ActiveTransfer {
    cancel_token: CancellationToken,
}

/// Transfer manager
pub struct TransferManager {
    sftp_manager: Arc<SftpManager>,
    app_handle: AppHandle,
    active_transfers: Arc<Mutex<HashMap<String, ActiveTransfer>>>,
    semaphore: Arc<Semaphore>,
}

impl TransferManager {
    pub fn new(sftp_manager: Arc<SftpManager>, app_handle: AppHandle) -> Self {
        Self {
            sftp_manager,
            app_handle,
            active_transfers: Arc::new(Mutex::new(HashMap::new())),
            semaphore: Arc::new(Semaphore::new(MAX_CONCURRENT_TRANSFERS)),
        }
    }

    /// Upload file from local to remote
    pub async fn upload(
        &self,
        session_id: String,
        local_path: String,
        remote_path: String,
    ) -> Result<String, String> {
        let transfer_id = Uuid::new_v4().to_string();
        let cancel_token = CancellationToken::new();

        // Register transfer
        {
            let mut transfers = self.active_transfers.lock().await;
            transfers.insert(
                transfer_id.clone(),
                ActiveTransfer {
                    cancel_token: cancel_token.clone(),
                },
            );
        }

        // Acquire semaphore permit
        let permit = self.semaphore.clone().acquire_owned().await.map_err(|e| {
            format!("Failed to acquire transfer slot: {}", e)
        })?;

        // Spawn transfer task
        let transfer_id_clone = transfer_id.clone();
        let sftp_manager = self.sftp_manager.clone();
        let app_handle = self.app_handle.clone();
        let active_transfers = self.active_transfers.clone();

        tokio::spawn(async move {
            let result = Self::upload_impl(
                sftp_manager,
                app_handle.clone(),
                session_id,
                local_path,
                remote_path,
                transfer_id_clone.clone(),
                cancel_token,
            )
            .await;

            // Remove from active transfers
            active_transfers.lock().await.remove(&transfer_id_clone);

            // Drop permit to allow next transfer
            drop(permit);

            if let Err(e) = result {
                let _ = app_handle.emit(
                    &format!("sftp-error-{}", transfer_id_clone),
                    e,
                );
            }
        });

        Ok(transfer_id)
    }

    async fn upload_impl(
        sftp_manager: Arc<SftpManager>,
        app_handle: AppHandle,
        session_id: String,
        local_path: String,
        remote_path: String,
        transfer_id: String,
        cancel_token: CancellationToken,
    ) -> Result<(), String> {
        // Open local file
        let mut local_file = File::open(&local_path)
            .await
            .map_err(|e| format!("Failed to open local file: {}", e))?;

        // Get file size
        let metadata = local_file
            .metadata()
            .await
            .map_err(|e| format!("Failed to get file metadata: {}", e))?;
        let total_bytes = metadata.len();

        // Get file name
        let file_name = Path::new(&local_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        // Get SFTP session
        let sessions = sftp_manager.sessions.lock().await;
        let wrapper = sessions
            .get(&session_id)
            .ok_or_else(|| format!("SFTP session not found: {}", session_id))?
            .clone();
        drop(sessions);

        let mut session = wrapper.lock().await;

        // Create remote file
        let mut remote_file = session
            .session
            .create(&remote_path)
            .await
            .map_err(|e| format!("Failed to create remote file: {}", e))?;

        drop(session); // Release lock during transfer

        // Transfer with progress tracking
        let mut bytes_transferred = 0u64;
        let mut buffer = vec![0u8; CHUNK_SIZE];
        let mut speed_samples: Vec<(Instant, u64)> = Vec::new();
        let start_time = Instant::now();

        loop {
            // Check cancellation
            if cancel_token.is_cancelled() {
                return Err("Transfer cancelled".to_string());
            }

            // Read chunk from local file
            let n = local_file
                .read(&mut buffer)
                .await
                .map_err(|e| format!("Failed to read local file: {}", e))?;

            if n == 0 {
                break; // EOF
            }

            // Write chunk to remote file
            remote_file
                .write_all(&buffer[..n])
                .await
                .map_err(|e| format!("Failed to write to remote file: {}", e))?;

            bytes_transferred += n as u64;

            // Calculate speed (sliding window average)
            let now = Instant::now();
            speed_samples.push((now, bytes_transferred));

            // Remove samples older than SPEED_WINDOW_SECS
            speed_samples.retain(|(time, _)| {
                now.duration_since(*time) < Duration::from_secs(SPEED_WINDOW_SECS)
            });

            let speed = if speed_samples.len() >= 2 {
                let oldest = speed_samples.first().unwrap();
                let duration = now.duration_since(oldest.0).as_secs_f64();
                let bytes_diff = bytes_transferred - oldest.1;
                if duration > 0.0 {
                    bytes_diff as f64 / duration
                } else {
                    0.0
                }
            } else {
                let elapsed = start_time.elapsed().as_secs_f64();
                if elapsed > 0.0 {
                    bytes_transferred as f64 / elapsed
                } else {
                    0.0
                }
            };

            // Emit progress event
            let progress = TransferProgress {
                transfer_id: transfer_id.clone(),
                direction: TransferDirection::Upload,
                file_name: file_name.clone(),
                bytes_transferred,
                total_bytes,
                speed,
            };

            let _ = app_handle.emit("sftp-progress", &progress);
        }

        // Flush remote file
        remote_file
            .flush()
            .await
            .map_err(|e| format!("Failed to flush remote file: {}", e))?;

        Ok(())
    }

    /// Download file from remote to local
    pub async fn download(
        &self,
        session_id: String,
        remote_path: String,
        local_path: String,
    ) -> Result<String, String> {
        let transfer_id = Uuid::new_v4().to_string();
        let cancel_token = CancellationToken::new();

        // Register transfer
        {
            let mut transfers = self.active_transfers.lock().await;
            transfers.insert(
                transfer_id.clone(),
                ActiveTransfer {
                    cancel_token: cancel_token.clone(),
                },
            );
        }

        // Acquire semaphore permit
        let permit = self.semaphore.clone().acquire_owned().await.map_err(|e| {
            format!("Failed to acquire transfer slot: {}", e)
        })?;

        // Spawn transfer task
        let transfer_id_clone = transfer_id.clone();
        let sftp_manager = self.sftp_manager.clone();
        let app_handle = self.app_handle.clone();
        let active_transfers = self.active_transfers.clone();

        tokio::spawn(async move {
            let result = Self::download_impl(
                sftp_manager,
                app_handle.clone(),
                session_id,
                remote_path,
                local_path,
                transfer_id_clone.clone(),
                cancel_token,
            )
            .await;

            // Remove from active transfers
            active_transfers.lock().await.remove(&transfer_id_clone);

            // Drop permit to allow next transfer
            drop(permit);

            if let Err(e) = result {
                let _ = app_handle.emit(
                    &format!("sftp-error-{}", transfer_id_clone),
                    e,
                );
            }
        });

        Ok(transfer_id)
    }

    async fn download_impl(
        sftp_manager: Arc<SftpManager>,
        app_handle: AppHandle,
        session_id: String,
        remote_path: String,
        local_path: String,
        transfer_id: String,
        cancel_token: CancellationToken,
    ) -> Result<(), String> {
        // Get file name
        let file_name = Path::new(&remote_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        // Get SFTP session
        let sessions = sftp_manager.sessions.lock().await;
        let wrapper = sessions
            .get(&session_id)
            .ok_or_else(|| format!("SFTP session not found: {}", session_id))?
            .clone();
        drop(sessions);

        let session = wrapper.lock().await;

        // Get file size
        let metadata = session
            .session
            .metadata(&remote_path)
            .await
            .map_err(|e| format!("Failed to get remote file info: {}", e))?;

        let total_bytes = metadata.len();

        // Open remote file
        let mut remote_file = session
            .session
            .open(&remote_path)
            .await
            .map_err(|e| format!("Failed to open remote file: {}", e))?;

        drop(session); // Release lock during transfer

        // Create local file
        let mut local_file = File::create(&local_path)
            .await
            .map_err(|e| format!("Failed to create local file: {}", e))?;

        // Transfer with progress tracking
        let mut bytes_transferred = 0u64;
        let mut buffer = vec![0u8; CHUNK_SIZE];
        let mut speed_samples: Vec<(Instant, u64)> = Vec::new();
        let start_time = Instant::now();

        loop {
            // Check cancellation
            if cancel_token.is_cancelled() {
                return Err("Transfer cancelled".to_string());
            }

            // Read chunk from remote file
            let n = remote_file
                .read(&mut buffer)
                .await
                .map_err(|e| format!("Failed to read remote file: {}", e))?;

            if n == 0 {
                break; // EOF
            }

            // Write chunk to local file
            local_file
                .write_all(&buffer[..n])
                .await
                .map_err(|e| format!("Failed to write to local file: {}", e))?;

            bytes_transferred += n as u64;

            // Calculate speed (sliding window average)
            let now = Instant::now();
            speed_samples.push((now, bytes_transferred));

            // Remove samples older than SPEED_WINDOW_SECS
            speed_samples.retain(|(time, _)| {
                now.duration_since(*time) < Duration::from_secs(SPEED_WINDOW_SECS)
            });

            let speed = if speed_samples.len() >= 2 {
                let oldest = speed_samples.first().unwrap();
                let duration = now.duration_since(oldest.0).as_secs_f64();
                let bytes_diff = bytes_transferred - oldest.1;
                if duration > 0.0 {
                    bytes_diff as f64 / duration
                } else {
                    0.0
                }
            } else {
                let elapsed = start_time.elapsed().as_secs_f64();
                if elapsed > 0.0 {
                    bytes_transferred as f64 / elapsed
                } else {
                    0.0
                }
            };

            // Emit progress event
            let progress = TransferProgress {
                transfer_id: transfer_id.clone(),
                direction: TransferDirection::Download,
                file_name: file_name.clone(),
                bytes_transferred,
                total_bytes,
                speed,
            };

            let _ = app_handle.emit("sftp-progress", &progress);
        }

        // Flush local file
        local_file
            .flush()
            .await
            .map_err(|e| format!("Failed to flush local file: {}", e))?;

        Ok(())
    }

    /// Upload directory recursively
    pub async fn upload_directory(
        &self,
        session_id: String,
        local_dir: String,
        remote_dir: String,
    ) -> Result<Vec<String>, String> {
        let mut transfer_ids = Vec::new();

        // Create remote directory if it doesn't exist
        self.sftp_manager
            .mkdir(session_id.clone(), remote_dir.clone())
            .await
            .ok(); // Ignore error if directory already exists

        // Read local directory
        let mut entries = tokio::fs::read_dir(&local_dir)
            .await
            .map_err(|e| format!("Failed to read local directory: {}", e))?;

        while let Some(entry) = entries
            .next_entry()
            .await
            .map_err(|e| format!("Failed to read directory entry: {}", e))?
        {
            let path = entry.path();
            let file_name = path
                .file_name()
                .and_then(|n| n.to_str())
                .ok_or_else(|| "Invalid file name".to_string())?;

            let remote_path = if remote_dir.ends_with('/') {
                format!("{}{}", remote_dir, file_name)
            } else {
                format!("{}/{}", remote_dir, file_name)
            };

            let metadata = entry
                .metadata()
                .await
                .map_err(|e| format!("Failed to get file metadata: {}", e))?;

            if metadata.is_dir() {
                // Recursively upload subdirectory
                let sub_ids = Box::pin(self.upload_directory(
                    session_id.clone(),
                    path.to_string_lossy().to_string(),
                    remote_path,
                ))
                .await?;
                transfer_ids.extend(sub_ids);
            } else {
                // Upload file
                let transfer_id = self
                    .upload(
                        session_id.clone(),
                        path.to_string_lossy().to_string(),
                        remote_path,
                    )
                    .await?;
                transfer_ids.push(transfer_id);
            }
        }

        Ok(transfer_ids)
    }

    /// Cancel transfer
    pub async fn cancel_transfer(&self, transfer_id: String) -> Result<(), String> {
        let transfers = self.active_transfers.lock().await;
        if let Some(transfer) = transfers.get(&transfer_id) {
            transfer.cancel_token.cancel();
            Ok(())
        } else {
            Err(format!("Transfer not found: {}", transfer_id))
        }
    }
}
