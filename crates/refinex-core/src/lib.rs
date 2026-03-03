// SPDX-License-Identifier: MIT
// Copyright (c) 2026 refinex-lab

//! `refinex-core` — PTY engine, VT emulation, and rendering primitives.
//!
//! This crate is intentionally free of Tauri (or any UI framework) dependencies.
//! The Tauri layer in `refinex-app` uses the public API here and handles all
//! IPC bridging.

pub mod pty;

pub use pty::{PtyEvent, PtyId, PtyManager};
