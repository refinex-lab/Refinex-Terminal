import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

export type FsChangeKind = "create" | "modify" | "remove";

export interface FsChangeEvent {
  path: string;
  kind: FsChangeKind;
}

/**
 * Start watching a directory for file system changes
 */
export async function watchDirectory(path: string): Promise<void> {
  await invoke("watch_directory", { path });
}

/**
 * Stop watching the current directory
 */
export async function unwatchDirectory(): Promise<void> {
  await invoke("unwatch_directory");
}

/**
 * Get the currently watched directory path
 */
export async function getWatchedDirectory(): Promise<string | null> {
  return await invoke<string | null>("get_watched_directory");
}

/**
 * Listen for file system change events
 */
export async function onFsChanged(
  callback: (event: FsChangeEvent) => void
): Promise<UnlistenFn> {
  return await listen<FsChangeEvent>("fs-changed", (event) => {
    callback(event.payload);
  });
}
