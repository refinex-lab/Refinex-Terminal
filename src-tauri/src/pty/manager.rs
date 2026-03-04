use portable_pty::{native_pty_system, CommandBuilder, PtyPair, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};

/// PTY session data
pub struct PtySession {
    pub pair: PtyPair,
    pub writer: Box<dyn Write + Send>,
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
            .map_err(|e| format!("Failed to open PTY: {}", e))?;

        // Determine shell to use
        let shell = Self::get_default_shell();

        // Create command builder
        let mut cmd = CommandBuilder::new(&shell);
        cmd.cwd(&cwd);

        // Spawn the shell process
        let _child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn shell: {}", e))?;

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
                },
            );
        }

        // Spawn reader thread
        let session_id = id;
        thread::spawn(move || {
            let mut buf = [0u8; 8192];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => {
                        // EOF - PTY closed
                        let _ = app_handle.emit(&format!("pty-exit-{}", session_id), ());
                        break;
                    }
                    Ok(n) => {
                        // Send data to frontend
                        let data = buf[..n].to_vec();
                        let _ = app_handle.emit(&format!("pty-output-{}", session_id), data);
                    }
                    Err(e) => {
                        eprintln!("PTY read error: {}", e);
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

    /// Get the default shell for the current platform
    fn get_default_shell() -> String {
        #[cfg(target_os = "macos")]
        {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
        }

        #[cfg(target_os = "windows")]
        {
            std::env::var("COMSPEC").unwrap_or_else(|_| "powershell.exe".to_string())
        }

        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
        }
    }
}

impl Default for PtyManager {
    fn default() -> Self {
        Self::new()
    }
}
