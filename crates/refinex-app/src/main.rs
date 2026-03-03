// SPDX-License-Identifier: MIT
// Copyright (c) 2026 refinex-lab

use tracing::info;

fn main() -> anyhow::Result<()> {
    // Initialize tracing subscriber for structured logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    info!("Refinex Terminal starting up");

    Ok(())
}

