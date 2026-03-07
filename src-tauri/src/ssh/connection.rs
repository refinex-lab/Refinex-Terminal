use russh::client;
use russh_keys::{load_secret_key, agent};
use std::collections::HashMap;
use std::net::ToSocketAddrs;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, Mutex};
use uuid::Uuid;

use super::handler::SshHandler;
use super::types::{AuthMethod, SshChannelInfo, SshConnectionInfo, SshHostConfig};

/// Channel command for controlling a channel
#[derive(Debug)]
pub enum ChannelCommand {
    Write(Vec<u8>),
    Resize { cols: u32, rows: u32 },
    Close,
}

/// Channel handle with command sender
pub struct ChannelHandle {
    pub info: SshChannelInfo,
    pub command_tx: mpsc::UnboundedSender<ChannelCommand>,
}

/// SSH connection wrapper
pub struct SshConnection {
    pub id: String,
    pub host_config: SshHostConfig,
    pub handle: client::Handle<SshHandler>,
    pub channels: Arc<Mutex<HashMap<String, ChannelHandle>>>,
    pub connected_at: String,
    pub keepalive_task: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
}

/// SSH connection manager
pub struct SshConnectionManager {
    pub(crate) connections: Arc<Mutex<HashMap<String, Arc<SshConnection>>>>,
    app_handle: AppHandle,
}

impl SshConnectionManager {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            connections: Arc::new(Mutex::new(HashMap::new())),
            app_handle,
        }
    }

    /// Connect to SSH host
    pub async fn connect(&self, host_config: SshHostConfig) -> Result<String, String> {
        let conn_id = Uuid::new_v4().to_string();

        // Resolve hostname to socket address
        let addr = format!("{}:{}", host_config.hostname, host_config.port)
            .to_socket_addrs()
            .map_err(|e| format!("Failed to resolve hostname: {}", e))?
            .next()
            .ok_or_else(|| "No address found for hostname".to_string())?;

        // Create SSH config
        let config = Arc::new(client::Config::default());

        // Create handler
        let handler = SshHandler::new(
            self.app_handle.clone(),
            conn_id.clone(),
            host_config.hostname.clone(),
            host_config.port,
        );

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
        self.authenticate(&mut handle, &host_config).await?;

        // Start keepalive task
        let conn_id_clone = conn_id.clone();
        let app_handle_clone = self.app_handle.clone();
        let keepalive_task = tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(30));
            loop {
                interval.tick().await;
                // Emit keepalive event (connection manager can use this to check if connection is alive)
                let _ = app_handle_clone.emit(&format!("ssh-keepalive-{}", conn_id_clone), ());
            }
        });

        // Create connection
        let connection = Arc::new(SshConnection {
            id: conn_id.clone(),
            host_config: host_config.clone(),
            handle,
            channels: Arc::new(Mutex::new(HashMap::new())),
            connected_at: chrono::Utc::now().to_rfc3339(),
            keepalive_task: Arc::new(Mutex::new(Some(keepalive_task))),
        });

        // Store connection
        let mut connections = self.connections.lock().await;
        connections.insert(conn_id.clone(), connection);

        // Emit connected event
        self.app_handle
            .emit(&format!("ssh-connected-{}", conn_id), ())
         .map_err(|e| format!("Failed to emit event: {}", e))?;

        Ok(conn_id)
    }

    /// Authenticate SSH session
    async fn authenticate(
        &self,
        handle: &mut client::Handle<SshHandler>,
        host_config: &SshHostConfig,
    ) -> Result<(), String> {
        let username = host_config.username.clone();

        match &host_config.auth_method {
            AuthMethod::Password => {
                let password = host_config
                    .password
                    .as_ref()
                    .ok_or_else(|| "Password not provided".to_string())?;

                let auth_result = tokio::time::timeout(
                    std::time::Duration::from_secs(30),
                    handle.authenticate_password(username, password),
                )
                .await
                .map_err(|_| "Authentication timeout".to_string())?
                .map_err(|e| format!("Password authentication failed: {}", e))?;

                if !auth_result {
                    return Err("Password authentication rejected".to_string());
                }
            }
            AuthMethod::Key => {
                let key_path = host_config
                    .private_key_path
                    .as_ref()
                    .ok_or_else(|| "Private key path not provided".to_string())?;

                // Load private key
                let key_pair = if let Some(passphrase) = &host_config.passphrase {
                    load_secret_key(key_path, Some(passphrase))
                        .map_err(|e| format!("Failed to load private key: {}", e))?
                } else {
                    load_secret_key(key_path, None)
                        .map_err(|e| format!("Failed to load private key: {}", e))?
                };

                let auth_result = tokio::time::timeout(
                    std::time::Duration::from_secs(30),
                    handle.authenticate_publickey(username, Arc::new(key_pair)),
                )
                .await
                .map_err(|_| "Authentication timeout".to_string())?
                .map_err(|e| format!("Public key authentication failed: {}", e))?;

                if !auth_result {
                    return Err("Public key authentication rejected".to_string());
                }
            }
            AuthMethod::Agent => {
                // Connect to SSH agent
                let mut agent_client = agent::client::AgentClient::connect_env()
                    .await
                    .map_err(|e| format!("Failed to connect to SSH agent: {}", e))?;

                // Request identities from agent
                let identities = agent_client
                    .request_identities()
                    .await
                    .map_err(|e| format!("Failed to get identities from SSH agent: {}", e))?;

                if identities.is_empty() {
                    return Err("No identities found in SSH agent".to_string());
                }

                // Try each identity until one succeeds
                let mut last_error = String::new();
                for identity in identities {
                    // Use agent to sign authentication request
                    let auth_result = tokio::time::timeout(
                        std::time::Duration::from_secs(30),
                        handle.authenticate_publickey_with(
                            username.clone(),
                            identity.clone(),
                            &mut agent_client,
                        ),
                    )
                    .await;

                    match auth_result {
                        Ok(Ok(true)) => {
                            // Authentication succeeded
                            return Ok(());
                        }
                        Ok(Ok(false)) => {
                            last_error = "SSH agent authentication rejected".to_string();
                        }
                        Ok(Err(e)) => {
                            last_error = format!("SSH agent authentication failed: {}", e);
                        }
                        Err(_) => {
                            last_error = "SSH agent authentication timeout".to_string();
                        }
                    }
                }

                return Err(format!(
                    "All SSH agent identities failed. Last error: {}",
                    last_error
                ));
            }
            AuthMethod::KeyboardInteractive => {
                // TODO: Implement keyboard-interactive authentication
                return Err("Keyboard-interactive authentication not yet implemented".to_string());
            }
        }

        Ok(())
    }

    /// Disconnect from SSH host
    pub async fn disconnect(&self, conn_id: &str) -> Result<(), String> {
        let mut connections = self.connections.lock().await;

        if let Some(connection) = connections.remove(conn_id) {
            // Abort keepalive task
            let mut keepalive_task = connection.keepalive_task.lock().await;
            if let Some(task) = keepalive_task.take() {
                task.abort();
            }

            // Close all channels
            let channels = connection.channels.lock().await;
            for (channel_id, _) in channels.iter() {
                // Channels will be closed when handle is dropped
                tracing::info!("Closing channel: {}", channel_id);
            }

            // Emit disconnected event
            self.app_handle
                .emit(&format!("ssh-disconnected-{}", conn_id), "User disconnected".to_string())
                .map_err(|e| format!("Failed to emit event: {}", e))?;

            Ok(())
        } else {
            Err(format!("Connection not found: {}", conn_id))
        }
    }

    /// List all active connections
    pub async fn list_connections(&self) -> Vec<SshConnectionInfo> {
        let connections = self.connections.lock().await;

        let mut result = Vec::new();
        for (_, connection) in connections.iter() {
            let channels = connection.channels.lock().await;
            let active_channels: Vec<String> = channels.keys().cloned().collect();

            result.push(SshConnectionInfo {
                id: connection.id.clone(),
                host_config: connection.host_config.clone(),
                connected_at: connection.connected_at.clone(),
                active_channels,
            });
        }

        result
    }

    /// Get connection by ID
    pub async fn get_connection(&self, conn_id: &str) -> Option<Arc<SshConnection>> {
        let connections = self.connections.lock().await;
        connections.get(conn_id).cloned()
    }
}
