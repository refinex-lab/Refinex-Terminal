use russh::client;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::{oneshot, Mutex};

use super::types::{HostKeyAction, HostKeyRequest};

/// SSH client handler
pub struct SshHandler {
    app_handle: AppHandle,
    conn_id: String,
    host_key_response: Arc<Mutex<Option<oneshot::Sender<HostKeyAction>>>>,
}

impl SshHandler {
    pub fn new(app_handle: AppHandle, conn_id: String) -> Self {
        Self {
            app_handle,
            conn_id,
            host_key_response: Arc::new(Mutex::new(None)),
        }
    }

    /// Set the host key response sender
    pub async fn set_host_key_response_sender(&self, sender: oneshot::Sender<HostKeyAction>) {
        let mut response = self.host_key_response.lock().await;
        *response = Some(sender);
    }

    /// Send host key response
    pub async fn send_host_key_response(&self, action: HostKeyAction) -> Result<(), String> {
        let mut response = self.host_key_response.lock().await;
        if let Some(sender) = response.take() {
            sender
                .send(action)
                .map_err(|_| "Failed to send host key response".to_string())?;
            Ok(())
        } else {
            Err("No host key response sender available".to_string())
        }
    }
}

#[async_trait::async_trait]
impl client::Handler for SshHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &ssh_key::PublicKey,
    ) -> Result<bool, Self::Error> {
        // Get key fingerprint (simplified - using debug representation)
        let fingerprint = format!("{:?}", server_public_key);
        let key_type = server_public_key.algorithm().to_string();

        // Create host key request
        let request = HostKeyRequest {
            hostname: "unknown".to_string(), // Will be filled by connection manager
            port: 22,
            key_type,
            fingerprint,
        };

        // Create oneshot channel for response
        let (tx, rx) = oneshot::channel();
        self.set_host_key_response_sender(tx).await;

        // Emit event to frontend
        self.app_handle
            .emit(&format!("ssh-host-key-verify-{}", self.conn_id), request)
            .map_err(|e| russh::Error::from(std::io::Error::new(std::io::ErrorKind::Other, e)))?;

        // Wait for user response (with timeout)
        let action = tokio::time::timeout(std::time::Duration::from_secs(60), rx)
            .await
            .map_err(|_| {
                russh::Error::from(std::io::Error::new(
                    std::io::ErrorKind::TimedOut,
                    "Host key verification timeout",
                ))
            })?
            .map_err(|_| {
                russh::Error::from(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    "Failed to receive host key response",
                ))
            })?;

        match action {
            HostKeyAction::Reject => Ok(false),
            HostKeyAction::AcceptOnce => Ok(true),
            HostKeyAction::AcceptAndRemember => {
                // TODO: Write to ~/.ssh/known_hosts
                Ok(true)
            }
        }
    }

    async fn data(
        &mut self,
        channel: russh::ChannelId,
        data: &[u8],
        _session: &mut client::Session,
    ) -> Result<(), Self::Error> {
        // Emit data event to frontend
        let channel_id = format!("{}", channel);
        let event_name = format!("ssh-output-{}-{}", self.conn_id, channel_id);

        self.app_handle
            .emit(&event_name, data.to_vec())
            .map_err(|e| russh::Error::from(std::io::Error::new(std::io::ErrorKind::Other, e)))?;

        Ok(())
    }

    async fn extended_data(
        &mut self,
        channel: russh::ChannelId,
        ext: u32,
        data: &[u8],
        _session: &mut client::Session,
    ) -> Result<(), Self::Error> {
        // Handle stderr data (ext == 1)
        if ext == 1 {
            let channel_id = format!("{}", channel);
            let event_name = format!("ssh-output-{}-{}", self.conn_id, channel_id);

            self.app_handle
                .emit(&event_name, data.to_vec())
                .map_err(|e| {
                    russh::Error::from(std::io::Error::new(std::io::ErrorKind::Other, e))
                })?;
        }

        Ok(())
    }

    async fn channel_close(
        &mut self,
        channel: russh::ChannelId,
        _session: &mut client::Session,
    ) -> Result<(), Self::Error> {
        let channel_id = format!("{}", channel);
        let event_name = format!("ssh-channel-closed-{}-{}", self.conn_id, channel_id);

        self.app_handle
            .emit(&event_name, ())
            .map_err(|e| russh::Error::from(std::io::Error::new(std::io::ErrorKind::Other, e)))?;

        Ok(())
    }

    async fn channel_eof(
        &mut self,
        channel: russh::ChannelId,
        _session: &mut client::Session,
    ) -> Result<(), Self::Error> {
        let channel_id = format!("{}", channel);
        let event_name = format!("ssh-channel-eof-{}-{}", self.conn_id, channel_id);

        self.app_handle
            .emit(&event_name, ())
            .map_err(|e| russh::Error::from(std::io::Error::new(std::io::ErrorKind::Other, e)))?;

        Ok(())
    }
}
