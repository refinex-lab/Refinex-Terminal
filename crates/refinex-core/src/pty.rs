// SPDX-License-Identifier: MIT
// Copyright (c) 2026 refinex-lab

//! PTY session management for Refinex Terminal.
//!
//! [`PtyManager`] owns all live PTY sessions. Output from each PTY is put on a
//! [`tokio::sync::mpsc`] channel so the Tauri layer can forward it to the
//! frontend without any Tauri dependency inside this crate.
//!
//! # Lifecycle
//!
//! ```text
//! create_pty → spawn_command → read_thread (blocking) → PtyEvent::Output
//!                                           on EOF     → PtyEvent::Exit
//! kill_pty   → drop PtySession → drops master PTY → SIGHUP child → EOF
//! ```

use std::{collections::HashMap, io::Write};

use anyhow::{anyhow, Context, Result};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use tokio::sync::mpsc;
use tracing::{error, info};

/// Unique identifier for an active PTY session.
pub type PtyId = u32;

/// Events that the PTY read loop emits to the Tauri layer.
///
/// Sent over the `mpsc` channel created in [`PtyManager::new`].
#[derive(Debug)]
pub enum PtyEvent {
    /// Raw bytes received from the PTY master.
    Output {
        /// The session that produced this output.
        id: PtyId,
        /// Raw bytes exactly as read from the PTY master fd.
        data: Vec<u8>,
    },
    /// The PTY child process has exited (EOF on master reader).
    Exit {
        /// The session that exited.
        id: PtyId,
    },
}

/// Internal state for a single PTY session.
struct PtySession {
    /// Write end of the PTY — delivers user keystrokes to the shell.
    writer: Box<dyn Write + Send>,
    /// Master PTY handle — kept alive so the PTY remains open; used for resize.
    master: Box<dyn portable_pty::MasterPty + Send>,
}

/// Manages all active PTY sessions.
///
/// Typically held behind `Arc<std::sync::Mutex<PtyManager>>` as Tauri managed
/// state.  All operations complete quickly (hash-map lookup + syscall) so a
/// plain `std::sync::Mutex` is appropriate.
pub struct PtyManager {
    sessions: HashMap<PtyId, PtySession>,
    next_id: PtyId,
    event_tx: mpsc::Sender<PtyEvent>,
}

impl PtyManager {
    /// Create a new [`PtyManager`].
    ///
    /// `event_tx` is the sending half of a channel; all PTY output and exit
    /// notifications are sent here for the Tauri layer to relay.
    #[must_use]
    pub fn new(event_tx: mpsc::Sender<PtyEvent>) -> Self {
        Self {
            sessions: HashMap::new(),
            next_id: 1,
            event_tx,
        }
    }

    /// Spawn a new PTY session running `shell` inside `cwd`.
    ///
    /// The initial terminal size defaults to `cols × rows`.  A background
    /// thread is started immediately to read PTY output and send it as
    /// [`PtyEvent::Output`] payloads.
    ///
    /// Returns the [`PtyId`] assigned to the new session.
    pub fn create(&mut self, shell: &str, cwd: &str, cols: u16, rows: u16) -> Result<PtyId> {
        let id = self.next_id;
        self.next_id = self.next_id.wrapping_add(1);

        let pty_system = native_pty_system();
        let size = PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };

        let pair = pty_system
            .openpty(size)
            .context("failed to open PTY pair")?;

        // Build the shell command.
        let mut cmd = CommandBuilder::new(shell);
        cmd.cwd(cwd);
        // Provide a sane terminal environment.
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");

        // Spawn the shell on the slave side.
        let child = pair
            .slave
            .spawn_command(cmd)
            .context("failed to spawn shell process")?;

        // Release our copy of the slave — the child owns it now.
        drop(pair.slave);

        // Create an owned writer and a cloned reader from the master.
        let writer = pair
            .master
            .take_writer()
            .context("failed to take PTY writer")?;

        let reader = pair
            .master
            .try_clone_reader()
            .context("failed to clone PTY reader")?;

        // Spawn a blocking thread to drain the PTY master reader.
        // The thread also reaps the child process after EOF.
        let event_tx = self.event_tx.clone();
        std::thread::Builder::new()
            .name(format!("pty-reader-{id}"))
            .spawn(move || {
                use std::io::Read as _;
                let mut child = child;
                let mut reader = reader;
                let mut buf = [0u8; 4096];

                loop {
                    match reader.read(&mut buf) {
                        Ok(0) => break, // EOF — shell exited
                        Ok(n) => {
                            if event_tx
                                .blocking_send(PtyEvent::Output {
                                    id,
                                    data: buf[..n].to_vec(),
                                })
                                .is_err()
                            {
                                // Receiver dropped — app is shutting down.
                                break;
                            }
                        }
                        Err(e) => {
                            error!(pty_id = id, error = %e, "PTY read error");
                            break;
                        }
                    }
                }

                // Reap the child to avoid zombie processes.
                let _ = child.wait();

                // Notify the Tauri layer that the session has ended.
                let _ = event_tx.blocking_send(PtyEvent::Exit { id });
                info!(pty_id = id, "PTY read thread exiting");
            })
            .context("failed to spawn PTY reader thread")?;

        self.sessions.insert(
            id,
            PtySession {
                writer,
                master: pair.master,
            },
        );

        info!(pty_id = id, shell = %shell, cwd = %cwd, cols, rows, "PTY session created");
        Ok(id)
    }

    /// Write `data` (user keystrokes / paste text) into the session's PTY.
    pub fn write(&mut self, id: PtyId, data: &str) -> Result<()> {
        let session = self
            .sessions
            .get_mut(&id)
            .ok_or_else(|| anyhow!("PTY session {id} not found"))?;

        session
            .writer
            .write_all(data.as_bytes())
            .context("failed to write to PTY")?;

        Ok(())
    }

    /// Resize the terminal window of session `id` to `cols × rows`.
    pub fn resize(&self, id: PtyId, cols: u16, rows: u16) -> Result<()> {
        let session = self
            .sessions
            .get(&id)
            .ok_or_else(|| anyhow!("PTY session {id} not found"))?;

        let size = PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };

        session
            .master
            .resize(size)
            .context("failed to resize PTY")?;

        Ok(())
    }

    /// Kill and remove the session identified by `id`.
    ///
    /// Dropping the [`PtySession`] closes the master PTY, which sends `SIGHUP`
    /// to the child process.  The read thread will detect EOF and emit a
    /// [`PtyEvent::Exit`] shortly after.
    pub fn kill(&mut self, id: PtyId) -> Result<()> {
        self.sessions
            .remove(&id)
            .map(|_| {
                info!(pty_id = id, "PTY session killed");
            })
            .ok_or_else(|| anyhow!("PTY session {id} not found"))
    }

    /// Return the number of active PTY sessions.
    #[must_use]
    pub fn session_count(&self) -> usize {
        self.sessions.len()
    }
}
