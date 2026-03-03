// SPDX-License-Identifier: MIT
// Copyright (c) 2026 refinex-lab

//! Tauri application runtime for Refinex Terminal.
//!
//! This crate is the entry point for the Tauri app.  It:
//! 1. Creates the [`refinex_core::PtyManager`] and its event channel.
//! 2. Registers all Tauri commands.
//! 3. Starts a background task that forwards PTY events to the frontend via
//!    Tauri's IPC event system.
//!
//! Heavy business logic lives in `refinex-core`, `refinex-ai`, etc.

mod commands;

use std::sync::Mutex;

use base64::Engine as _;
use refinex_core::{PtyEvent, PtyManager};
use serde::Serialize;
use tauri::Emitter as _;
use tracing::{error, info};

/// Frontend payload for `pty-output` events.
///
/// `data` is Base64-encoded so arbitrary bytes survive JSON serialisation.
#[derive(Debug, Clone, Serialize)]
struct PtyOutputPayload {
    /// Session that produced the output.
    id: u32,
    /// Base64-encoded raw PTY bytes.
    data: String,
}

/// Frontend payload for `pty-exit` events.
#[derive(Debug, Clone, Serialize)]
struct PtyExitPayload {
    /// Session that has exited.
    id: u32,
}

/// Initialise and run the Tauri application.
///
/// Called from `main.rs` (and from the mobile entry-point macro on iOS/Android).
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Channel capacity: 256 events before backpressure kicks in.
    let (event_tx, event_rx) = tokio::sync::mpsc::channel::<PtyEvent>(256);
    let pty_manager = Mutex::new(PtyManager::new(event_tx));

    tauri::Builder::default()
        .manage(pty_manager)
        .setup(|app| {
            info!("Refinex Terminal window initialised");

            // Spawn a task to forward PTY events → Tauri frontend events.
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let mut event_rx = event_rx; // mut binding for recv() inside async block
                while let Some(event) = event_rx.recv().await {
                    match event {
                        PtyEvent::Output { id, data } => {
                            let encoded = base64::engine::general_purpose::STANDARD.encode(&data);
                            if let Err(e) = app_handle
                                .emit("pty-output", PtyOutputPayload { id, data: encoded })
                            {
                                error!(pty_id = id, "failed to emit pty-output: {e}");
                            }
                        }
                        PtyEvent::Exit { id } => {
                            if let Err(e) = app_handle.emit("pty-exit", PtyExitPayload { id }) {
                                error!(pty_id = id, "failed to emit pty-exit: {e}");
                            }
                        }
                    }
                }
                info!("PTY event forwarding task stopped");
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::create_pty,
            commands::write_pty,
            commands::resize_pty,
            commands::kill_pty,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Refinex Terminal");
}
