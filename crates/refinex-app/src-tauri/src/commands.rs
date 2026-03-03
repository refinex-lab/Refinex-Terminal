// SPDX-License-Identifier: MIT
// Copyright (c) 2026 refinex-lab

//! Tauri commands for PTY session management.
//!
//! These are thin wrappers that forward to [`refinex_core::PtyManager`].
//! All commands return `Result<T, String>` so errors surface as rejected
//! promises on the TypeScript side.
//!
//! # Note on `needless_pass_by_value`
//!
//! Tauri IPC deserialises arguments as owned values; `&str` / `&T` cannot be
//! used as command parameters.  All `String` / `PtyId` parameters are
//! intentionally passed by value, even if the body only borrows them.
#![allow(clippy::needless_pass_by_value)]

use std::sync::Mutex;

use refinex_core::PtyId;
use tauri::State;
use tracing::{error, instrument};

/// Shared state type alias for convenience.
type PtyState<'a> = State<'a, Mutex<refinex_core::PtyManager>>;

/// Determine the user's preferred login shell.
///
/// Reads `$SHELL` on POSIX (falling back to `/bin/zsh`) and `$COMSPEC` on
/// Windows (falling back to `powershell.exe`).
fn default_shell() -> String {
    #[cfg(target_os = "windows")]
    {
        std::env::var("COMSPEC").unwrap_or_else(|_| "powershell.exe".to_owned())
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_owned())
    }
}

/// Determine a sensible default working directory.
fn default_cwd() -> String {
    dirs::home_dir()
        .or_else(|| std::env::current_dir().ok())
        .map_or_else(|| "/".to_owned(), |p| p.to_string_lossy().into_owned())
}

/// Spawn a new PTY session.
///
/// # Arguments
/// * `shell` – path to the shell binary (defaults to `$SHELL` / `powershell.exe`)
/// * `cwd`   – initial working directory (defaults to the user's home dir)
/// * `cols`  – initial terminal width in columns (defaults to 80)
/// * `rows`  – initial terminal height in rows (defaults to 24)
///
/// Returns the numeric [`PtyId`] for subsequent commands.
#[tauri::command]
#[instrument(skip(state))]
pub fn create_pty(
    state: PtyState<'_>,
    shell: Option<String>,
    cwd: Option<String>,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<PtyId, String> {
    let shell = shell.unwrap_or_else(default_shell);
    let cwd = cwd.unwrap_or_else(default_cwd);
    let cols = cols.unwrap_or(80);
    let rows = rows.unwrap_or(24);

    state
        .lock()
        .map_err(|e| format!("PTY state lock poisoned: {e}"))?
        .create(&shell, &cwd, cols, rows)
        .map_err(|e| {
            error!("create_pty failed: {e}");
            e.to_string()
        })
}

/// Write data (user keystrokes / paste) into a PTY session.
///
/// `data` is the raw UTF-8 string to send to the shell's stdin.
#[tauri::command]
#[instrument(skip(state, data), fields(data_len = data.len()))]
pub fn write_pty(state: PtyState<'_>, id: PtyId, data: String) -> Result<(), String> {
    state
        .lock()
        .map_err(|e| format!("PTY state lock poisoned: {e}"))?
        .write(id, &data)
        .map_err(|e| {
            error!(pty_id = id, "write_pty failed: {e}");
            e.to_string()
        })
}

/// Resize a PTY session's terminal window.
#[tauri::command]
#[instrument(skip(state))]
pub fn resize_pty(state: PtyState<'_>, id: PtyId, cols: u16, rows: u16) -> Result<(), String> {
    state
        .lock()
        .map_err(|e| format!("PTY state lock poisoned: {e}"))?
        .resize(id, cols, rows)
        .map_err(|e| {
            error!(pty_id = id, "resize_pty failed: {e}");
            e.to_string()
        })
}

/// Kill a PTY session.
///
/// Dropping the session closes the master PTY, which sends `SIGHUP` to the
/// child process.  The frontend will receive a `pty-exit` event shortly after.
#[tauri::command]
#[instrument(skip(state))]
pub fn kill_pty(state: PtyState<'_>, id: PtyId) -> Result<(), String> {
    state
        .lock()
        .map_err(|e| format!("PTY state lock poisoned: {e}"))?
        .kill(id)
        .map_err(|e| {
            error!(pty_id = id, "kill_pty failed: {e}");
            e.to_string()
        })
}
