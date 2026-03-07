use russh::client;
use russh::ChannelMsg;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;
use uuid::Uuid;

use super::connection::{ChannelCommand, ChannelHandle, SshConnectionManager};
use super::types::{ChannelType, SshChannelInfo};

/// SSH channel manager
pub struct SshChannelManager {
    app_handle: AppHandle,
}

impl SshChannelManager {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }

    /// Open a shell channel on an existing SSH connection
    pub async fn open_shell(
        &self,
        conn_manager: &SshConnectionManager,
        conn_id: &str,
        cols: u32,
        rows: u32,
    ) -> Result<String, String> {
        // Get connection
        let connection = conn_manager
            .get_connection(conn_id)
            .await
            .ok_or_else(|| format!("Connection not found: {}", conn_id))?;

        // Open a new channel
        let channel = connection
            .handle
            .channel_open_session()
            .await
            .map_err(|e| format!("Failed to open channel: {}", e))?;

        // Request PTY
        channel
            .request_pty(
                false,
                "xterm-256color",
                cols,
                rows,
                0, // pixel width (unused)
                0, // pixel height (unused)
                &[], // terminal modes
            )
            .await
            .map_err(|e| format!("Failed to request PTY: {}", e))?;

        // Request shell
        channel
            .request_shell(false)
            .await
            .map_err(|e| format!("Failed to request shell: {}", e))?;

        // Generate channel ID
        let channel_id = Uuid::new_v4().to_string();

        // Create command channel
        let (command_tx, command_rx) = mpsc::unbounded_channel();

        // Store channel info
        let channel_info = SshChannelInfo {
            id: channel_id.clone(),
            channel_type: ChannelType::Shell,
            created_at: chrono::Utc::now().to_rfc3339(),
        };

        let channel_handle = ChannelHandle {
            info: channel_info,
            command_tx,
        };

        let mut channels = connection.channels.lock().await;
        channels.insert(channel_id.clone(), channel_handle);
        drop(channels);

        // Start reading loop
        let app_handle = self.app_handle.clone();
        let conn_id_clone = conn_id.to_string();
        let channel_id_clone = channel_id.clone();
        let connection_clone = connection.clone();

        tokio::spawn(async move {
            Self::channel_loop(
                app_handle,
                conn_id_clone,
                channel_id_clone,
                channel,
                command_rx,
                connection_clone,
            )
            .await;
        });

        Ok(channel_id)
    }

    /// Channel loop - handles both reading and commands
    async fn channel_loop(
        app_handle: AppHandle,
        conn_id: String,
        channel_id: String,
        mut channel: russh::Channel<client::Msg>,
        mut command_rx: mpsc::UnboundedReceiver<ChannelCommand>,
        connection: std::sync::Arc<super::connection::SshConnection>,
    ) {
        loop {
            tokio::select! {
                // Handle incoming data from SSH channel
                msg = channel.wait() => {
                    match msg {
                        Some(ChannelMsg::Data { ref data }) => {
                            let event_name = format!("ssh-output-{}-{}", conn_id, channel_id);
                            if let Err(e) = app_handle.emit(&event_name, data.to_vec()) {
                                tracing::error!("Failed to emit SSH data event: {}", e);
                                break;
                            }
                        }
                        Some(ChannelMsg::ExtendedData { ref data, ext }) => {
                            if ext == 1 {
                                let event_name = format!("ssh-output-{}-{}", conn_id, channel_id);
                                if let Err(e) = app_handle.emit(&event_name, data.to_vec()) {
                                    tracing::error!("Failed to emit SSH stderr event: {}", e);
                                    break;
                                }
                            }
                        }
                        Some(ChannelMsg::Eof) => {
                            tracing::info!("SSH channel EOF: {}-{}", conn_id, channel_id);
                            let event_name = format!("ssh-channel-eof-{}-{}", conn_id, channel_id);
                            let _ = app_handle.emit(&event_name, ());
                            break;
                        }
                        Some(ChannelMsg::Close) => {
                            tracing::info!("SSH channel closed: {}-{}", conn_id, channel_id);
                            let event_name = format!("ssh-channel-closed-{}-{}", conn_id, channel_id);
                            let _ = app_handle.emit(&event_name, ());
                            break;
                        }
                        Some(ChannelMsg::ExitStatus { exit_status }) => {
                            tracing::info!("SSH channel exit status: {}-{} = {}", conn_id, channel_id, exit_status);
                        }
                        Some(ChannelMsg::ExitSignal { signal_name, core_dumped, error_message, lang_tag }) => {
                            tracing::warn!(
                                "SSH channel exit signal: {}-{} signal={:?} core_dumped={} error={:?} lang={:?}",
                                conn_id, channel_id, signal_name, core_dumped, error_message, lang_tag
                            );
                        }
                        None => {
                            tracing::info!("SSH channel stream ended: {}-{}", conn_id, channel_id);
                            break;
                        }
                        _ => {}
                    }
                }

                // Handle commands from application
                cmd = command_rx.recv() => {
                    match cmd {
                        Some(ChannelCommand::Write(data)) => {
                            if let Err(e) = channel.data(&data[..]).await {
                                tracing::error!("Failed to write to channel: {}", e);
                                break;
                            }
                        }
                        Some(ChannelCommand::Resize { cols, rows }) => {
                            if let Err(e) = channel.window_change(cols, rows, 0, 0).await {
                                tracing::error!("Failed to resize channel: {}", e);
                            }
                        }
                        Some(ChannelCommand::Close) => {
                            tracing::info!("Closing channel: {}-{}", conn_id, channel_id);
                            let _ = channel.eof().await;
                            break;
                        }
                        None => {
                            tracing::info!("Command channel closed: {}-{}", conn_id, channel_id);
                            break;
                        }
                    }
                }
            }
        }

        // Clean up channel info when loop exits
        let mut channels = connection.channels.lock().await;
        channels.remove(&channel_id);

        tracing::info!("SSH channel loop exited: {}-{}", conn_id, channel_id);
    }

    /// Execute a command on the remote server and return output
    /// This opens a temporary exec channel, runs the command, and returns the output
    pub async fn exec_command(
        &self,
        conn_manager: &SshConnectionManager,
        conn_id: &str,
        command: &str,
    ) -> Result<String, String> {
        // Get connection
        let connection = conn_manager
            .get_connection(conn_id)
            .await
            .ok_or_else(|| format!("Connection not found: {}", conn_id))?;

        // Open a new channel for exec
        let mut channel = connection
            .handle
            .channel_open_session()
            .await
            .map_err(|e| format!("Failed to open exec channel: {}", e))?;

        // Execute command
        channel
            .exec(false, command)
            .await
            .map_err(|e| format!("Failed to execute command: {}", e))?;

        // Collect output
        let mut output = Vec::new();
        let mut timeout = tokio::time::interval(std::time::Duration::from_millis(100));
        let mut no_data_count = 0;

        loop {
            tokio::select! {
                msg = channel.wait() => {
                    match msg {
                        Some(ChannelMsg::Data { ref data }) => {
                            output.extend_from_slice(data);
                            no_data_count = 0;
                        }
                        Some(ChannelMsg::ExtendedData { ref data, .. }) => {
                            // stderr
                            output.extend_from_slice(data);
                            no_data_count = 0;
                        }
                        Some(ChannelMsg::Eof) | Some(ChannelMsg::Close) | None => {
                            break;
                        }
                        _ => {}
                    }
                }
                _ = timeout.tick() => {
                    no_data_count += 1;
                    if no_data_count > 30 {
                        // 3 seconds timeout
                        break;
                    }
                }
            }
        }

        // Close channel
        let _ = channel.eof().await;

        // Convert output to string
        String::from_utf8(output)
            .map(|s| s.trim().to_string())
            .map_err(|e| format!("Failed to decode command output: {}", e))
    }

    /// Write data to a channel
    pub async fn write_channel(
        &self,
        conn_manager: &SshConnectionManager,
        conn_id: &str,
        channel_id: &str,
        data: Vec<u8>,
    ) -> Result<(), String> {
        let connection = conn_manager
            .get_connection(conn_id)
            .await
            .ok_or_else(|| format!("Connection not found: {}", conn_id))?;

        let channels = connection.channels.lock().await;
        let channel_handle = channels
            .get(channel_id)
            .ok_or_else(|| format!("Channel not found: {}", channel_id))?;

        channel_handle
            .command_tx
            .send(ChannelCommand::Write(data))
            .map_err(|e| format!("Failed to send write command: {}", e))?;

        Ok(())
    }

    /// Resize a channel's PTY
    pub async fn resize_channel(
        &self,
        conn_manager: &SshConnectionManager,
        conn_id: &str,
        channel_id: &str,
        cols: u32,
        rows: u32,
    ) -> Result<(), String> {
        let connection = conn_manager
            .get_connection(conn_id)
            .await
            .ok_or_else(|| format!("Connection not found: {}", conn_id))?;

        let channels = connection.channels.lock().await;
        let channel_handle = channels
            .get(channel_id)
            .ok_or_else(|| format!("Channel not found: {}", channel_id))?;

        channel_handle
            .command_tx
            .send(ChannelCommand::Resize { cols, rows })
            .map_err(|e| format!("Failed to send resize command: {}", e))?;

        Ok(())
    }

    /// Close a channel
    pub async fn close_channel(
        &self,
        conn_manager: &SshConnectionManager,
        conn_id: &str,
        channel_id: &str,
    ) -> Result<(), String> {
        let connection = conn_manager
            .get_connection(conn_id)
            .await
            .ok_or_else(|| format!("Connection not found: {}", conn_id))?;

        let channels = connection.channels.lock().await;
        let channel_handle = channels
            .get(channel_id)
            .ok_or_else(|| format!("Channel not found: {}", channel_id))?;

        channel_handle
            .command_tx
            .send(ChannelCommand::Close)
            .map_err(|e| format!("Failed to send close command: {}", e))?;

        Ok(())
    }
}
