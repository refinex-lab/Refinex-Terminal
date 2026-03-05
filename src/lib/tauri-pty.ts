import { invoke } from "@tauri-apps/api/core";

/**
 * Spawn a new PTY session
 */
export async function ptySpawn(
  cwd: string,
  cols: number,
  rows: number
): Promise<number> {
  return await invoke<number>("pty_spawn", { cwd, cols, rows });
}

/**
 * Write data to a PTY session
 */
export async function ptyWrite(id: number, data: Uint8Array): Promise<void> {
  return await invoke<void>("pty_write", { id, data: Array.from(data) });
}

/**
 * Resize a PTY session
 */
export async function ptyResize(
  id: number,
  cols: number,
  rows: number
): Promise<void> {
  return await invoke<void>("pty_resize", { id, cols, rows });
}

/**
 * Kill a PTY session
 */
export async function ptyKill(id: number): Promise<void> {
  return await invoke<void>("pty_kill", { id });
}

/**
 * Detect CLI type from PTY process
 */
export async function detectPtyCli(ptyPid: number): Promise<string | null> {
  return await invoke<string | null>("detect_pty_cli", { ptyPid });
}
