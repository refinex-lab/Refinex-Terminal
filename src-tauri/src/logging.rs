use tracing::info;
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use std::path::PathBuf;

/// Initialize logging system
/// Logs are written to ~/.refinex/logs/ with daily rotation
pub fn init_logging() -> Result<(), String> {
    let log_dir = get_log_directory()?;

    // Create log directory if it doesn't exist
    std::fs::create_dir_all(&log_dir)
        .map_err(|e| format!("Failed to create log directory: {}", e))?;

    // Create file appender with daily rotation
    let file_appender = RollingFileAppender::new(
        Rotation::DAILY,
        &log_dir,
        "refinex-terminal.log"
    );

    // Create console layer for stdout
    let console_layer = fmt::layer()
        .with_target(true)
        .with_thread_ids(true)
        .with_line_number(true);

    // Create file layer
    let file_layer = fmt::layer()
        .with_writer(file_appender)
        .with_target(true)
        .with_thread_ids(true)
        .with_line_number(true)
        .with_ansi(false); // No ANSI colors in log files

    // Set up env filter (default to info, can be overridden with RUST_LOG env var)
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,refinex_terminal_lib=debug"));

    // Initialize subscriber with both console and file output
    tracing_subscriber::registry()
        .with(env_filter)
        .with(console_layer)
        .with(file_layer)
        .init();

    info!("Logging initialized. Logs directory: {:?}", log_dir);

    Ok(())
}

/// Get the log directory path
fn get_log_directory() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir()
        .ok_or("Failed to get home directory")?;

    Ok(home_dir.join(".refinex").join("logs"))
}

/// Get the current log file path
pub fn get_log_file_path() -> Result<PathBuf, String> {
    let log_dir = get_log_directory()?;
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    Ok(log_dir.join(format!("refinex-terminal.{}.log", today)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_log_directory() {
        let log_dir = get_log_directory().unwrap();
        assert!(log_dir.to_string_lossy().contains(".refinex"));
        assert!(log_dir.to_string_lossy().contains("logs"));
    }
}
