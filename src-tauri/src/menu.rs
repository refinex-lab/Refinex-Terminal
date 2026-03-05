use tauri::{
    menu::{Menu, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    AppHandle, Emitter, Manager, Runtime, Wry,
};

/// Creates the application menu with platform-specific behavior
pub fn create_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    // Create Settings menu item with Cmd+, shortcut
    let settings = MenuItemBuilder::with_id("settings", "Settings...")
        .accelerator("CmdOrCtrl+,")
        .build(app)?;

    #[cfg(target_os = "macos")]
    {
        // macOS: Create app menu with Settings in the app submenu
        let app_menu = SubmenuBuilder::new(app, "Refinex Terminal")
            .item(&PredefinedMenuItem::about(app, None, None)?)
            .separator()
            .item(&settings)
            .separator()
            .item(&PredefinedMenuItem::hide(app, None)?)
            .item(&PredefinedMenuItem::hide_others(app, None)?)
            .item(&PredefinedMenuItem::show_all(app, None)?)
            .separator()
            .item(&PredefinedMenuItem::quit(app, None)?)
            .build()?;

        let edit_menu = SubmenuBuilder::new(app, "Edit")
            .item(&PredefinedMenuItem::undo(app, None)?)
            .item(&PredefinedMenuItem::redo(app, None)?)
            .separator()
            .item(&PredefinedMenuItem::cut(app, None)?)
            .item(&PredefinedMenuItem::copy(app, None)?)
            .item(&PredefinedMenuItem::paste(app, None)?)
            .item(&PredefinedMenuItem::select_all(app, None)?)
            .build()?;

        let view_menu = SubmenuBuilder::new(app, "View")
            .item(&PredefinedMenuItem::fullscreen(app, None)?)
            .build()?;

        let window_menu = SubmenuBuilder::new(app, "Window")
            .item(&PredefinedMenuItem::minimize(app, None)?)
            .item(&PredefinedMenuItem::maximize(app, None)?)
            .separator()
            .item(&PredefinedMenuItem::close_window(app, None)?)
            .build()?;

        MenuBuilder::new(app)
            .item(&app_menu)
            .item(&edit_menu)
            .item(&view_menu)
            .item(&window_menu)
            .build()
    }

    #[cfg(not(target_os = "macos"))]
    {
        // Windows/Linux: Create File menu with Settings
        let file_menu = SubmenuBuilder::new(app, "File")
            .item(&settings)
            .separator()
            .item(&PredefinedMenuItem::quit(app, None)?)
            .build()?;

        let edit_menu = SubmenuBuilder::new(app, "Edit")
            .item(&PredefinedMenuItem::undo(app, None)?)
            .item(&PredefinedMenuItem::redo(app, None)?)
            .separator()
            .item(&PredefinedMenuItem::cut(app, None)?)
            .item(&PredefinedMenuItem::copy(app, None)?)
            .item(&PredefinedMenuItem::paste(app, None)?)
            .item(&PredefinedMenuItem::select_all(app, None)?)
            .build()?;

        let view_menu = SubmenuBuilder::new(app, "View")
            .item(&PredefinedMenuItem::fullscreen(app, None)?)
            .build()?;

        MenuBuilder::new(app)
            .item(&file_menu)
            .item(&edit_menu)
            .item(&view_menu)
            .build()
    }
}

/// Handles menu events
pub fn handle_menu_event(app: &AppHandle<Wry>, event: tauri::menu::MenuEvent) {
    if event.id() == "settings" {
        // Emit event to frontend to open settings panel
        if let Some(window) = app.get_webview_window("main") {
            window
                .emit("open-settings", ())
                .expect("Failed to emit open-settings event");
        }
    }
}
