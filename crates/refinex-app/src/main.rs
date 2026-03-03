// SPDX-License-Identifier: MIT
// Copyright (c) 2026 refinex-lab

//! `refinex-app` — Main entry point for the Refinex Terminal process.
//!
//! In the Tauri MVP phase this binary initialises logging and then delegates
//! to the workspace-level crates for all business logic.

use tracing::info;

fn main() {
    // Initialize tracing subscriber for structured logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    info!("Refinex Terminal starting up");
}
