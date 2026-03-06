mod pty;
mod commands;
mod config;
mod menu;
mod cli;
mod fs;

use pty::PtyManager;
use commands::{pty_spawn, pty_write, pty_resize, pty_kill, get_config, update_config, reset_config, get_config_file_path, read_theme_file, list_fonts, set_title_bar_theme, ConfigState};
use config::{load_config, get_config_path};
use cli::{detect_ai_clis, test_cli, get_shell_profile_path, add_to_shell_profile};
use fs::watcher::FsWatcher;
use std::sync::{Arc, Mutex};
use tauri::Manager;

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
    // Load configuration on startup
    let config_path = get_config_path().expect("Failed to get config path");
    let config = load_config(config_path).unwrap_or_default();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(PtyManager::new())
        .manage(ConfigState::new(config))
        .manage(Arc::new(Mutex::new(FsWatcher::new())))
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
            fs::watcher::watch_directory,
            fs::watcher::unwatch_directory,
            fs::watcher::get_watched_directory,
            fs::finder::list_all_files
        ])
        .setup(|app| {
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
