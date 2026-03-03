// SPDX-License-Identifier: MIT
// Copyright (c) 2026 refinex-lab

//! Tauri application binary entry point for Refinex Terminal.
//!
//! Initialises structured logging, then delegates to [`app_lib::run`] for all
//! Tauri window management and command registration.

// Prevents an additional console window from appearing on Windows in release,
// DO NOT REMOVE this attribute.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Initialise structured logging before anything else.
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    app_lib::run();
}
