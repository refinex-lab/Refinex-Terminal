use notify_debouncer_full::{
    new_debouncer,
    notify::{self, RecommendedWatcher, RecursiveMode},
    DebounceEventResult, Debouncer, FileIdMap,
};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// File system change event kind
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum FsChangeKind {
    Create,
    Modify,
    Remove,
}

/// File system change event payload
#[derive(Debug, Clone, serde::Serialize)]
pub struct FsChangeEvent {
    pub path: String,
    pub kind: FsChangeKind,
}

/// Manages file system watching for project directories
pub struct FsWatcher {
    debouncer: Arc<Mutex<Option<Debouncer<RecommendedWatcher, FileIdMap>>>>,
    watched_path: Arc<Mutex<Option<PathBuf>>>,
}

impl FsWatcher {
    pub fn new() -> Self {
        Self {
            debouncer: Arc::new(Mutex::new(None)),
            watched_path: Arc::new(Mutex::new(None)),
        }
    }

    /// Start watching a directory
    pub fn watch(&self, path: PathBuf, app_handle: AppHandle) -> Result<(), String> {
        // Stop existing watcher if any
        self.unwatch()?;

        let app_handle_clone = app_handle.clone();

        // Create debounced watcher with 200ms delay
        let mut debouncer = new_debouncer(
            Duration::from_millis(200),
            None,
            move |result: DebounceEventResult| {
                match result {
                    Ok(events) => {
                        for event in events {
                            // Skip events with no paths
                            if event.paths.is_empty() {
                                continue;
                            }

                            // Convert notify event to our event type
                            let kind = match event.kind {
                                notify::EventKind::Create(_) => FsChangeKind::Create,
                                notify::EventKind::Modify(_) => FsChangeKind::Modify,
                                notify::EventKind::Remove(_) => FsChangeKind::Remove,
                                notify::EventKind::Any => FsChangeKind::Modify,
                                notify::EventKind::Access(_) => continue,
                                notify::EventKind::Other => continue,
                            };

                            // Emit event for each affected path
                            for path in &event.paths {
                                // Check if file still exists to determine if it was deleted
                                let path_exists = path.exists();
                                let final_kind = if !path_exists && matches!(kind, FsChangeKind::Modify) {
                                    // macOS rm command triggers modify event, convert to remove
                                    FsChangeKind::Remove
                                } else {
                                    kind.clone()
                                };

                                let event_payload = FsChangeEvent {
                                    path: path.to_string_lossy().to_string(),
                                    kind: final_kind,
                                };

                                if let Err(e) = app_handle_clone.emit("fs-changed", event_payload) {
                                    eprintln!("Failed to emit fs-changed event: {}", e);
                                }
                            }
                        }
                    }
                    Err(errors) => {
                        for error in errors {
                            eprintln!("File watcher error: {:?}", error);
                        }
                    }
                }
            },
        )
        .map_err(|e| format!("Failed to create file watcher: {}", e))?;

        // Start watching the directory recursively BEFORE storing
        debouncer
            .watch(&path, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch directory: {}", e))?;

        // Store the debouncer and watched path
        let mut debouncer_guard = self.debouncer.lock().unwrap();
        *debouncer_guard = Some(debouncer);
        *self.watched_path.lock().unwrap() = Some(path.clone());

        Ok(())
    }

    /// Stop watching the current directory
    pub fn unwatch(&self) -> Result<(), String> {
        let mut debouncer_guard = self.debouncer.lock().unwrap();

        if let Some(mut debouncer) = debouncer_guard.take() {
            if let Some(path) = self.watched_path.lock().unwrap().take() {
                debouncer
                    .unwatch(&path)
                    .map_err(|e| format!("Failed to unwatch directory: {}", e))?;
            }
        }

        Ok(())
    }

    /// Get the currently watched path
    pub fn watched_path(&self) -> Option<PathBuf> {
        self.watched_path.lock().unwrap().clone()
    }
}

/// Tauri command to start watching a directory
#[tauri::command]
pub async fn watch_directory(
    path: String,
    watcher: tauri::State<'_, Arc<Mutex<FsWatcher>>>,
    app_handle: AppHandle,
) -> Result<(), String> {
    let path_buf = PathBuf::from(&path);

    if !path_buf.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    if !path_buf.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let watcher_guard = watcher.lock().unwrap();
    watcher_guard.watch(path_buf, app_handle)?;

    Ok(())
}

/// Tauri command to stop watching the current directory
#[tauri::command]
pub async fn unwatch_directory(
    watcher: tauri::State<'_, Arc<Mutex<FsWatcher>>>,
) -> Result<(), String> {
    let watcher_guard = watcher.lock().unwrap();
    watcher_guard.unwatch()?;
    Ok(())
}

/// Tauri command to get the currently watched directory
#[tauri::command]
pub async fn get_watched_directory(
    watcher: tauri::State<'_, Arc<Mutex<FsWatcher>>>,
) -> Result<Option<String>, String> {
    let watcher_guard = watcher.lock().unwrap();
    Ok(watcher_guard
        .watched_path()
        .map(|p| p.to_string_lossy().to_string()))
}
