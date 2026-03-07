use portable_pty::{native_pty_system, CommandBuilder, PtyPair, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tracing::{info, error, debug};

use super::shell::detect_shell;

/// Configuration for PTY output batching
const BATCH_SIZE_THRESHOLD: usize = 8192; // 8KB - send immediately when buffer reaches this size
const BATCH_TIME_THRESHOLD_MS: u64 = 16; // 16ms - max time to wait before sending (60fps)
const RING_BUFFER_SIZE: usize = 65536; // 64KB ring buffer

/// PTY session data
pub struct PtySession {
    pub pair: PtyPair,
    pub writer: Box<dyn Write + Send>,
    #[allow(dead_code)]
    pub child_pid: Option<u32>,
}

/// PTY manager state
pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<u32, PtySession>>>,
    next_id: Arc<Mutex<u32>>,
}

impl PtyManager {
    /// Create a new PTY manager
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            next_id: Arc::new(Mutex::new(1)),
        }
    }

    /// Spawn a new PTY session
    pub fn spawn(
        &self,
        app_handle: AppHandle,
        cwd: String,
        cols: u16,
        rows: u16,
    ) -> Result<u32, String> {
        // Get next session ID
        let id = {
            let mut next_id = self.next_id.lock().map_err(|e| e.to_string())?;
            let id = *next_id;
            *next_id += 1;
            id
        };

        info!("Spawning PTY session {} in directory: {}", id, cwd);

        // Create PTY system
        let pty_system = native_pty_system();

        // Create PTY pair with specified size
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| {
                error!("Failed to open PTY {}: {}", id, e);
                format!("Failed to open PTY: {}", e)
            })?;

        // Detect shell and get configuration
        let shell_config = detect_shell(None); // TODO: Read from config
        debug!("Using shell: {} for PTY {}", shell_config.program, id);

        // Create command builder
        let mut cmd = CommandBuilder::new(&shell_config.program);
        cmd.cwd(&cwd);

        // Add shell arguments
        for arg in &shell_config.args {
            cmd.arg(arg);
        }

        // Set environment variables
        for (key, value) in &shell_config.env {
            cmd.env(key, value);
        }

        // Spawn the shell process
        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| {
                error!("Failed to spawn shell for PTY {}: {}", id, e);
                format!("Failed to spawn shell: {}", e)
            })?;

        // Get child PID for process detection
        let child_pid = child.process_id();
        info!("PTY {} spawned with PID: {:?}", id, child_pid);

        // Get reader and writer
        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to clone reader: {}", e))?;

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to take writer: {}", e))?;

        // Store session
        {
            let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;
            sessions.insert(
                id,
                PtySession {
                    pair,
                    writer,
                    child_pid,
                },
            );
        }

        // Emit PTY spawn event with child PID for CLI detection
        let _ = app_handle.emit(
            &format!("pty-spawn-{}", id),
            serde_json::json!({
                "id": id,
                "pid": child_pid,
            }),
        );

        // Spawn reader thread with batching optimization
        let session_id = id;
        thread::spawn(move || {
            let mut ring_buffer = vec![0u8; RING_BUFFER_SIZE];
            let mut write_pos = 0;
            let mut last_send_time = Instant::now();
            let mut total_bytes_read = 0u64;
            let mut total_messages_sent = 0u64;
            let start_time = Instant::now();
            let mut is_first_output = true; // Track first output for immediate prompt display

            loop {
                // Read into ring buffer
                match reader.read(&mut ring_buffer[write_pos..]) {
                    Ok(0) => {
                        // EOF - PTY closed
                        info!("PTY {} session ended (EOF)", session_id);

                        // Send any remaining buffered data
                        if write_pos > 0 {
                            let data = ring_buffer[..write_pos].to_vec();
                            let _ = app_handle.emit(&format!("pty-output-{}", session_id), data);
                            total_messages_sent += 1;
                        }

                        // Log performance metrics
                        let elapsed = start_time.elapsed().as_secs_f64();
                        if elapsed > 0.0 {
                            let bytes_per_sec = total_bytes_read as f64 / elapsed;
                            let messages_per_sec = total_messages_sent as f64 / elapsed;
                            info!(
                                "PTY {} stats: {} bytes, {} messages, {:.2} KB/s, {:.2} msg/s",
                                session_id, total_bytes_read, total_messages_sent,
                                bytes_per_sec / 1024.0, messages_per_sec
                            );
                        }

                        // Emit exit event to notify frontend
                        let _ = app_handle.emit(&format!("pty-exit-{}", session_id), ());
                        break;
                    }
                    Ok(n) => {
                        write_pos += n;
                        total_bytes_read += n as u64;

                        let time_since_last_send = last_send_time.elapsed();
                        let should_send_by_size = write_pos >= BATCH_SIZE_THRESHOLD;
                        let should_send_by_time = time_since_last_send >= Duration::from_millis(BATCH_TIME_THRESHOLD_MS);

                        // Send first output quickly (50ms) to show initial prompt immediately
                        let should_send_first_output = is_first_output
                            && write_pos > 0
                            && time_since_last_send >= Duration::from_millis(50);

                        // Send if buffer is full enough OR enough time has passed OR first output ready
                        if should_send_by_size || should_send_by_time || should_send_first_output {
                            let data = ring_buffer[..write_pos].to_vec();
                            let _ = app_handle.emit(&format!("pty-output-{}", session_id), data);
                            total_messages_sent += 1;
                            write_pos = 0;
                            last_send_time = Instant::now();
                            is_first_output = false; // Mark first output as sent
                        }
                    }
                    Err(e) => {
                        error!("PTY {} read error: {}", session_id, e);
                        let _ = app_handle.emit(&format!("pty-exit-{}", session_id), ());
                        break;
                    }
                }
            }
        });

        Ok(id)
    }

    /// Write data to a PTY session
    pub fn write(&self, id: u32, data: Vec<u8>) -> Result<(), String> {
        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;

        if let Some(session) = sessions.get_mut(&id) {
            session
                .writer
                .write_all(&data)
                .map_err(|e| format!("Failed to write to PTY: {}", e))?;
            session
                .writer
                .flush()
                .map_err(|e| format!("Failed to flush PTY: {}", e))?;
            Ok(())
        } else {
            Err(format!("PTY session {} not found", id))
        }
    }

    /// Resize a PTY session
    pub fn resize(&self, id: u32, cols: u16, rows: u16) -> Result<(), String> {
        let sessions = self.sessions.lock().map_err(|e| e.to_string())?;

        if let Some(session) = sessions.get(&id) {
            session
                .pair
                .master
                .resize(PtySize {
                    rows,
                    cols,
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|e| format!("Failed to resize PTY: {}", e))?;
            Ok(())
        } else {
            Err(format!("PTY session {} not found", id))
        }
    }

    /// Kill a PTY session
    pub fn kill(&self, id: u32) -> Result<(), String> {
        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;

        if sessions.remove(&id).is_some() {
            // Session removed, PTY will be dropped and closed
            Ok(())
        } else {
            Err(format!("PTY session {} not found", id))
        }
    }
}

impl Default for PtyManager {
    fn default() -> Self {
        Self::new()
    }
}
