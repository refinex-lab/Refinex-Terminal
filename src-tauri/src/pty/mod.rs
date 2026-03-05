pub mod manager;
pub mod shell;
pub mod process;

pub use manager::PtyManager;
pub use process::detect_pty_cli;

// Re-export for Tauri command handler
pub use process::*;
