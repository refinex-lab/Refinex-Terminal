use crate::pty::PtyManager;
use tauri::{AppHandle, State};

/// Spawn a new PTY session
#[tauri::command]
pub fn pty_spawn(
    app_handle: AppHandle,
    manager: State<PtyManager>,
    cwd: String,
    cols: u16,
    rows: u16,
) -> Result<u32, String> {
    manager.spawn(app_handle, cwd, cols, rows)
}

/// Write data to a PTY session
#[tauri::command]
pub fn pty_write(manager: State<PtyManager>, id: u32, data: Vec<u8>) -> Result<(), String> {
    manager.write(id, data)
}

/// Resize a PTY session
#[tauri::command]
pub fn pty_resize(manager: State<PtyManager>, id: u32, cols: u16, rows: u16) -> Result<(), String> {
    manager.resize(id, cols, rows)
}

/// Kill a PTY session
#[tauri::command]
pub fn pty_kill(manager: State<PtyManager>, id: u32) -> Result<(), String> {
    manager.kill(id)
}
