use russh_sftp::client::SftpSession;
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

use super::connection::SshConnectionManager;

/// Remote file entry information
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RemoteFileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: Option<u64>, // Unix timestamp
    pub permissions: String,   // rwxr-xr-x format
    pub owner: Option<String>,
    pub group: Option<String>,
}

/// SFTP session wrapper
pub struct SftpSessionWrapper {
    pub id: String,
    pub conn_id: String,
    pub session: SftpSession,
}

/// SFTP session manager
#[derive(Clone)]
pub struct SftpManager {
    pub(crate) sessions: Arc<Mutex<HashMap<String, Arc<Mutex<SftpSessionWrapper>>>>>,
    connection_manager: Arc<SshConnectionManager>,
}

impl SftpManager {
    pub fn new(connection_manager: Arc<SshConnectionManager>) -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            connection_manager,
        }
    }

    /// Open SFTP session on existing SSH connection
    pub async fn open(&self, conn_id: String) -> Result<String, String> {
        let session_id = Uuid::new_v4().to_string();

        // Get connection
        let connections = self.connection_manager.connections.lock().await;
        let connection = connections
            .get(&conn_id)
            .ok_or_else(|| format!("Connection not found: {}", conn_id))?
            .clone();
        drop(connections);

        // Open new channel for SFTP
        let channel = connection
            .handle
            .channel_open_session()
            .await
            .map_err(|e| format!("Failed to open channel: {}", e))?;

        // Request SFTP subsystem
        channel
            .request_subsystem(true, "sftp")
            .await
            .map_err(|e| format!("Failed to request SFTP subsystem: {}", e))?;

        // Create SFTP session using channel stream
        let channel_stream = channel.into_stream();
        let sftp_session = SftpSession::new(channel_stream)
            .await
            .map_err(|e| format!("Failed to create SFTP session: {}", e))?;

        // Store session
        let wrapper = Arc::new(Mutex::new(SftpSessionWrapper {
            id: session_id.clone(),
            conn_id: conn_id.clone(),
            session: sftp_session,
        }));

        self.sessions.lock().await.insert(session_id.clone(), wrapper);

        Ok(session_id)
    }

    /// List directory contents
    pub async fn readdir(&self, session_id: String, path: String) -> Result<Vec<RemoteFileEntry>, String> {
        let sessions = self.sessions.lock().await;
        let wrapper = sessions
            .get(&session_id)
            .ok_or_else(|| format!("SFTP session not found: {}", session_id))?
            .clone();
        drop(sessions);

        let session = wrapper.lock().await;

        // Read directory
        let entries = session
            .session
            .read_dir(&path)
            .await
            .map_err(|e| format!("Failed to read directory: {}", e))?;

        let mut result = Vec::new();

        for entry in entries {
            let file_name = entry
                .file_name()
                .to_string();

            let full_path = if path.ends_with('/') {
                format!("{}{}", path, file_name)
            } else {
                format!("{}/{}", path, file_name)
            };

            let metadata = entry.metadata();
            let is_dir = metadata.is_dir();
            let size = metadata.len();
            let modified = metadata.modified().ok().map(|t| {
                t.duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs()
            });

            // Get permissions - use default if not available
            let permissions = "?????????".to_string();

            result.push(RemoteFileEntry {
                name: file_name,
                path: full_path,
                is_dir,
                size,
                modified,
                permissions,
                owner: None, // russh-sftp doesn't expose uid/gid easily
                group: None,
            });
        }

        // Sort: directories first, then alphabetically
        result.sort_by(|a, b| {
            match (a.is_dir, b.is_dir) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            }
        });

        Ok(result)
    }

    /// Get file/directory information
    pub async fn stat(&self, session_id: String, path: String) -> Result<RemoteFileEntry, String> {
        let sessions = self.sessions.lock().await;
        let wrapper = sessions
            .get(&session_id)
            .ok_or_else(|| format!("SFTP session not found: {}", session_id))?
            .clone();
        drop(sessions);

        let session = wrapper.lock().await;

        let metadata = session
            .session
            .metadata(&path)
            .await
            .map_err(|e| format!("Failed to get file info: {}", e))?;

        let file_name = Path::new(&path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        Ok(RemoteFileEntry {
            name: file_name,
            path: path.clone(),
            is_dir: metadata.is_dir(),
            size: metadata.len(),
            modified: metadata.modified().ok().map(|t| {
                t.duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs()
            }),
            permissions: "?????????".to_string(),
            owner: None,
            group: None,
        })
    }

    /// Read file content (for preview, limited size)
    pub async fn read_file(&self, session_id: String, path: String, max_bytes: u64) -> Result<String, String> {
        let sessions = self.sessions.lock().await;
        let wrapper = sessions
            .get(&session_id)
            .ok_or_else(|| format!("SFTP session not found: {}", session_id))?
            .clone();
        drop(sessions);

        let session = wrapper.lock().await;

        // Open file
        let mut file = session
            .session
            .open(&path)
            .await
            .map_err(|e| format!("Failed to open file: {}", e))?;

        // Read up to max_bytes
        use tokio::io::AsyncReadExt;
        let mut buffer = Vec::new();
        let mut total_read = 0u64;

        loop {
            let mut chunk = vec![0u8; 8192];
            let n = file.read(&mut chunk)
                .await
                .map_err(|e| format!("Failed to read file: {}", e))?;

            if n == 0 {
                break;
            }

            buffer.extend_from_slice(&chunk[..n]);
            total_read += n as u64;

            if total_read >= max_bytes {
                break;
            }
        }

        // Convert to string
        String::from_utf8(buffer)
            .map_err(|_| "File contains invalid UTF-8".to_string())
    }

    /// Create directory
    pub async fn mkdir(&self, session_id: String, path: String) -> Result<(), String> {
        let sessions = self.sessions.lock().await;
        let wrapper = sessions
            .get(&session_id)
            .ok_or_else(|| format!("SFTP session not found: {}", session_id))?
            .clone();
        drop(sessions);

        let session = wrapper.lock().await;

        session
            .session
            .create_dir(&path)
            .await
            .map_err(|e| format!("Failed to create directory: {}", e))
    }

    /// Rename file or directory
    pub async fn rename(&self, session_id: String, old_path: String, new_path: String) -> Result<(), String> {
        let sessions = self.sessions.lock().await;
        let wrapper = sessions
            .get(&session_id)
            .ok_or_else(|| format!("SFTP session not found: {}", session_id))?
            .clone();
        drop(sessions);

        let session = wrapper.lock().await;

        session
            .session
            .rename(&old_path, &new_path)
            .await
            .map_err(|e| format!("Failed to rename: {}", e))
    }

    /// Remove file or empty directory
    pub async fn remove(&self, session_id: String, path: String) -> Result<(), String> {
        let sessions = self.sessions.lock().await;
        let wrapper = sessions
            .get(&session_id)
            .ok_or_else(|| format!("SFTP session not found: {}", session_id))?
            .clone();
        drop(sessions);

        let session = wrapper.lock().await;

        // Check if it's a directory
        let metadata = session
            .session
            .metadata(&path)
            .await
            .map_err(|e| format!("Failed to get file info: {}", e))?;

        if metadata.is_dir() {
            session
                .session
                .remove_dir(&path)
                .await
                .map_err(|e| format!("Failed to remove directory: {}", e))
        } else {
            session
                .session
                .remove_file(&path)
                .await
                .map_err(|e| format!("Failed to remove file: {}", e))
        }
    }

    /// Remove directory recursively
    pub async fn remove_recursive(&self, session_id: String, path: String) -> Result<(), String> {
        let sessions = self.sessions.lock().await;
        let wrapper = sessions
            .get(&session_id)
            .ok_or_else(|| format!("SFTP session not found: {}", session_id))?
            .clone();
        drop(sessions);

        // Recursive helper
        self.remove_recursive_impl(wrapper, path).await
    }

    async fn remove_recursive_impl(
        &self,
        wrapper: Arc<Mutex<SftpSessionWrapper>>,
        path: String,
    ) -> Result<(), String> {
        let session = wrapper.lock().await;

        // Check if it's a directory
        let metadata = session
            .session
            .metadata(&path)
            .await
            .map_err(|e| format!("Failed to get file info: {}", e))?;

        if !metadata.is_dir() {
            // It's a file, just remove it
            return session
                .session
                .remove_file(&path)
                .await
                .map_err(|e| format!("Failed to remove file: {}", e));
        }

        // It's a directory, read its contents
        let entries = session
            .session
            .read_dir(&path)
            .await
            .map_err(|e| format!("Failed to read directory: {}", e))?;

        drop(session); // Release lock before recursion

        // Recursively delete all entries
        for entry in entries {
            let file_name = entry.file_name().to_string();

            // Skip . and ..
            if file_name == "." || file_name == ".." {
                continue;
            }

            let full_path = if path.ends_with('/') {
                format!("{}{}", path, file_name)
            } else {
                format!("{}/{}", path, file_name)
            };

            Box::pin(self.remove_recursive_impl(wrapper.clone(), full_path)).await?;
        }

        // Now remove the empty directory
        let session = wrapper.lock().await;
        session
            .session
            .remove_dir(&path)
            .await
            .map_err(|e| format!("Failed to remove directory: {}", e))
    }

    /// Close SFTP session
    pub async fn close(&self, session_id: String) -> Result<(), String> {
        let mut sessions = self.sessions.lock().await;
        sessions.remove(&session_id);
        Ok(())
    }
}

/// Format Unix permissions to rwxr-xr-x format
fn format_permissions(mode: u32) -> String {
    let user = format!(
        "{}{}{}",
        if mode & 0o400 != 0 { "r" } else { "-" },
        if mode & 0o200 != 0 { "w" } else { "-" },
        if mode & 0o100 != 0 { "x" } else { "-" }
    );

    let group = format!(
        "{}{}{}",
        if mode & 0o040 != 0 { "r" } else { "-" },
        if mode & 0o020 != 0 { "w" } else { "-" },
        if mode & 0o010 != 0 { "x" } else { "-" }
    );

    let other = format!(
        "{}{}{}",
        if mode & 0o004 != 0 { "r" } else { "-" },
        if mode & 0o002 != 0 { "w" } else { "-" },
        if mode & 0o001 != 0 { "x" } else { "-" }
    );

    format!("{}{}{}", user, group, other)
}
