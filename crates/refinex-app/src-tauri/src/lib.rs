// SPDX-License-Identifier: MIT
// Copyright (c) 2026 refinex-lab

//! Tauri application runtime for Refinex Terminal.
//!
//! This crate is the entry point for the Tauri app. It initialises the
//! window, registers Tauri commands, and sets up the plugin chain.
//! Heavy business logic lives in `refinex-core`, `refinex-ai`, etc.

use tracing::info;

/// Initialise and run the Tauri application.
///
/// Called from `main.rs` (and from the mobile entry-point macro on iOS/Android).
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            info!("Refinex Terminal window initialised");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Refinex Terminal");
}
