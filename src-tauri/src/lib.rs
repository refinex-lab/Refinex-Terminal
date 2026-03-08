mod pty;
mod commands;
mod config;
mod menu;
mod cli;
mod fs;
mod git;
mod logging;
mod ssh;
mod search;

use pty::PtyManager;
use commands::{pty_spawn, pty_write, pty_resize, pty_kill, get_config, update_config, reset_config, get_config_file_path, read_theme_file, list_fonts, set_title_bar_theme, set_window_opacity, set_window_vibrancy, toggle_fullscreen, set_always_on_top, get_window_state, restore_window_state, ConfigState};
use config::{load_config, get_config_path};
use cli::{detect_ai_clis, test_cli, get_shell_profile_path, add_to_shell_profile};
use fs::watcher::FsWatcher;
use ssh::SshConnectionManager;
use std::sync::{Arc, Mutex};
use tauri::Manager;
use tracing::{info, error};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg(target_os = "macos")]
fn disable_webview_drag_drop(webview: &tauri::WebviewWindow) {
    use cocoa::base::id;
    use objc::{msg_send, sel, sel_impl};

    unsafe {
        let ns_window: id = webview.ns_window().unwrap() as _;
        let ns_view: id = msg_send![ns_window, contentView];

        // Unregister drag types to disable Tauri's file drop handler
        let _: () = msg_send![ns_view, unregisterDraggedTypes];
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging system
    if let Err(e) = logging::init_logging() {
        eprintln!("Failed to initialize logging: {}", e);
    } else {
        info!("Refinex Terminal starting...");
    }

    // Load configuration on startup
    let config_path = get_config_path().expect("Failed to get config path");
    let config = match load_config(config_path.clone()) {
        Ok(cfg) => {
            info!("Configuration loaded successfully from {:?}", config_path);
            cfg
        }
        Err(e) => {
            error!("Failed to load config: {}. Using defaults.", e);
            config::AppConfig::default()
        }
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(PtyManager::new())
        .manage(ConfigState::new(config))
        .manage(Arc::new(Mutex::new(FsWatcher::new())))
        .setup(|app| {
            // Initialize SSH connection manager
            let ssh_conn_manager = SshConnectionManager::new(app.handle().clone());
            let ssh_channel_manager = ssh::SshChannelManager::new(app.handle().clone());
            app.manage(ssh::SshManagerState::new(ssh_conn_manager, ssh_channel_manager, app.handle().clone()));

            // Create and set menu
            let menu = menu::create_menu(app.handle())?;
            app.set_menu(menu)?;

            // Handle menu events
            app.on_menu_event(menu::handle_menu_event);

            #[cfg(target_os = "macos")]
            {
                // Disable Tauri's drag-drop handler on macOS to allow HTML5 drag and drop
                if let Some(window) = app.get_webview_window("main") {
                    disable_webview_drag_drop(&window);
                    println!("macOS: Disabled Tauri drag-drop handler for HTML5 compatibility");
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            pty_spawn,
            pty_write,
            pty_resize,
            pty_kill,
            get_config,
            update_config,
            reset_config,
            get_config_file_path,
            read_theme_file,
            list_fonts,
            set_title_bar_theme,
            set_window_opacity,
            set_window_vibrancy,
            toggle_fullscreen,
            set_always_on_top,
            get_window_state,
            restore_window_state,
            detect_ai_clis,
            test_cli,
            get_shell_profile_path,
            add_to_shell_profile,
            pty::detect_pty_cli,
            fs::reader::read_directory,
            fs::reader::read_file,
            fs::reader::read_file_as_base64,
            fs::writer::fs_rename,
            fs::writer::fs_delete,
            fs::writer::fs_create_file,
            fs::writer::fs_create_folder,
            fs::writer::write_file,
            fs::reveal::reveal_in_finder,
            fs::metadata::get_file_metadata,
            fs::metadata::fs_exists,
            fs::watcher::watch_directory,
            fs::watcher::unwatch_directory,
            fs::watcher::get_watched_directory,
            fs::finder::list_all_files,
            git::git_status,
            git::git_diff,
            git::git_log,
            git::git_stage,
            git::git_unstage,
            git::git_commit,
            git::git_push,
            git::git_pull,
            git::git_fetch,
            git::git_branches,
            git::git_checkout,
            git::git_delete_branch,
            git::git_rename_branch,
            git::git_merge,
            git::git_rebase,
            git::git_stash,
            git::git_stash_pop,
            git::git_commit_detail,
            git::git_commit_file_diff,
            ssh::ssh_connect,
            ssh::ssh_disconnect,
            ssh::ssh_list_connections,
            ssh::ssh_open_shell,
            ssh::ssh_write,
            ssh::ssh_resize,
            ssh::ssh_close_channel,
            ssh::ssh_exec_command,
            ssh::list_ssh_keys_cmd,
            ssh::test_ssh_connection,
            ssh::sftp_open,
            ssh::sftp_readdir,
            ssh::sftp_stat,
            ssh::sftp_read_file,
            ssh::sftp_mkdir,
            ssh::sftp_rename,
            ssh::sftp_remove,
            ssh::sftp_remove_recursive,
            ssh::sftp_close,
            ssh::sftp_upload,
            ssh::sftp_download,
            ssh::sftp_upload_directory,
            ssh::sftp_cancel_transfer,
            ssh::sftp_pause_transfer,
            ssh::sftp_resume_transfer,
            search::global_search,
            search::replace_in_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
