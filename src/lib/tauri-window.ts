import { invoke } from "@tauri-apps/api/core";

export interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  maximized: boolean;
}

/**
 * Set window opacity (0.0 - 1.0)
 */
export async function setWindowOpacity(opacity: number): Promise<void> {
  await invoke("set_window_opacity", { opacity });
}

/**
 * Enable or disable window vibrancy/blur effect
 */
export async function setWindowVibrancy(enabled: boolean): Promise<void> {
  await invoke("set_window_vibrancy", { enabled });
}

/**
 * Toggle fullscreen mode
 */
export async function toggleFullscreen(): Promise<void> {
  await invoke("toggle_fullscreen");
}

/**
 * Set window always on top
 */
export async function setAlwaysOnTop(enabled: boolean): Promise<void> {
  await invoke("set_always_on_top", { enabled });
}

/**
 * Get current window state (position, size, maximized)
 */
export async function getWindowState(): Promise<WindowState> {
  return await invoke("get_window_state");
}

/**
 * Restore window state (position, size, maximized)
 */
export async function restoreWindowState(state: WindowState): Promise<void> {
  await invoke("restore_window_state", { state });
}
