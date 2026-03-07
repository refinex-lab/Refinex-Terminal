use tauri::{AppHandle, Manager};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowState {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub maximized: bool,
}

#[tauri::command]
pub fn set_title_bar_theme(app: AppHandle, theme: String) -> Result<(), String> {
    let webview_window = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;

    match theme.as_str() {
        "light" => {
            webview_window
                .set_theme(Some(tauri::Theme::Light))
                .map_err(|e| format!("Failed to set light theme: {}", e))?;
        }
        "dark" => {
            webview_window
                .set_theme(Some(tauri::Theme::Dark))
                .map_err(|e| format!("Failed to set dark theme: {}", e))?;
        }
        _ => return Err("Invalid theme. Use 'light' or 'dark'".to_string()),
    }

    Ok(())
}

#[tauri::command]
pub fn set_window_opacity(app: AppHandle, opacity: f32) -> Result<(), String> {
    let webview_window = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;

    // Clamp opacity between 0.0 and 1.0
    let clamped_opacity = opacity.max(0.0).min(1.0);

    #[cfg(target_os = "macos")]
    {
        use cocoa::base::id;
        use objc::{msg_send, sel, sel_impl};

        unsafe {
            let ns_window: id = webview_window.ns_window().unwrap() as _;
            let _: () = msg_send![ns_window, setAlphaValue: clamped_opacity as f64];
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Windows opacity is set via DWM attributes
        // This is a simplified approach - full implementation would use SetLayeredWindowAttributes
        webview_window
            .set_decorations(true)
            .map_err(|e| format!("Failed to set opacity: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn set_window_vibrancy(app: AppHandle, enabled: bool) -> Result<(), String> {
    let webview_window = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;

    #[cfg(target_os = "macos")]
    {
        use cocoa::base::id;
        use objc::{msg_send, sel, sel_impl, class};

        unsafe {
            let ns_window: id = webview_window.ns_window().unwrap() as _;

            if enabled {
                // Create visual effect view
                let content_view: id = msg_send![ns_window, contentView];
                let frame: cocoa::foundation::NSRect = msg_send![content_view, frame];

                let effect_view: id = msg_send![class!(NSVisualEffectView), alloc];
                let effect_view: id = msg_send![effect_view, initWithFrame: frame];

                // Set material to underWindowBackground for terminal-appropriate blur
                // NSVisualEffectMaterial values: 0 = AppearanceBased, 2 = Titlebar, 4 = Menu, etc.
                // 21 = UnderWindowBackground (macOS 10.14+)
                let _: () = msg_send![effect_view, setMaterial: 21i64];
                // NSVisualEffectBlendingMode: 0 = BehindWindow, 1 = WithinWindow
                let _: () = msg_send![effect_view, setBlendingMode: 0i64];
                let _: () = msg_send![effect_view, setState: 1]; // NSVisualEffectStateActive

                // Add as subview at the back
                let _: () = msg_send![content_view, addSubview:effect_view positioned:(-1i64) relativeTo:0usize];
            } else {
                // Remove visual effect view
                let content_view: id = msg_send![ns_window, contentView];
                let subviews: id = msg_send![content_view, subviews];
                let count: usize = msg_send![subviews, count];

                for i in 0..count {
                    let subview: id = msg_send![subviews, objectAtIndex: i];
                    let is_effect_view: bool = msg_send![subview, isKindOfClass: class!(NSVisualEffectView)];
                    if is_effect_view {
                        let _: () = msg_send![subview, removeFromSuperview];
                    }
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Windows 11 Mica/Acrylic support would go here
        // Requires Windows.UI.Composition APIs
        if enabled {
            // Placeholder for Windows acrylic/mica implementation
            // Would use DwmSetWindowAttribute with DWMWA_USE_IMMERSIVE_DARK_MODE
        }
    }

    Ok(())
}

#[tauri::command]
pub fn toggle_fullscreen(app: AppHandle) -> Result<(), String> {
    let webview_window = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;

    let is_fullscreen = webview_window
        .is_fullscreen()
        .map_err(|e| format!("Failed to get fullscreen state: {}", e))?;

    webview_window
        .set_fullscreen(!is_fullscreen)
        .map_err(|e| format!("Failed to toggle fullscreen: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn set_always_on_top(app: AppHandle, enabled: bool) -> Result<(), String> {
    let webview_window = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;

    webview_window
        .set_always_on_top(enabled)
        .map_err(|e| format!("Failed to set always on top: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn get_window_state(app: AppHandle) -> Result<WindowState, String> {
    let webview_window = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;

    let position = webview_window
        .outer_position()
        .map_err(|e| format!("Failed to get window position: {}", e))?;

    let size = webview_window
        .outer_size()
        .map_err(|e| format!("Failed to get window size: {}", e))?;

    let maximized = webview_window
        .is_maximized()
        .map_err(|e| format!("Failed to get maximized state: {}", e))?;

    Ok(WindowState {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        maximized,
    })
}

#[tauri::command]
pub fn restore_window_state(app: AppHandle, state: WindowState) -> Result<(), String> {
    let webview_window = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;

    // Restore position and size
    webview_window
        .set_position(tauri::PhysicalPosition::new(state.x, state.y))
        .map_err(|e| format!("Failed to set window position: {}", e))?;

    webview_window
        .set_size(tauri::PhysicalSize::new(state.width, state.height))
        .map_err(|e| format!("Failed to set window size: {}", e))?;

    // Restore maximized state
    if state.maximized {
        webview_window
            .maximize()
            .map_err(|e| format!("Failed to maximize window: {}", e))?;
    }

    Ok(())
}
