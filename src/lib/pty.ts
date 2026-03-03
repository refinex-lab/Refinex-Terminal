// SPDX-License-Identifier: MIT
// Copyright (c) 2026 refinex-lab

/**
 * Typed wrappers around the Tauri IPC layer for PTY management.
 *
 * Never call `invoke` with raw string literals outside this module.
 * All PTY interaction from the frontend goes through these functions.
 */

import { invoke } from "@tauri-apps/api/core";

/** Numeric identifier for an active PTY session — mirrors the Rust `PtyId`. */
export type PtyId = number;

/** Options passed to {@link createPty}. All fields are optional. */
export interface CreatePtyOptions {
  /** Shell binary path. Defaults to `$SHELL` / `powershell.exe` on the backend. */
  shell?: string;
  /** Working directory. Defaults to the user's home directory. */
  cwd?: string;
  /** Initial terminal width in columns. Defaults to 80. */
  cols?: number;
  /** Initial terminal height in rows. Defaults to 24. */
  rows?: number;
}

/**
 * Payload emitted by the backend on the `"pty-output"` Tauri event.
 *
 * `data` is a Base64-encoded string containing the raw PTY bytes.
 */
export interface PtyOutputPayload {
  id: PtyId;
  data: string; // Base64
}

/**
 * Payload emitted by the backend on the `"pty-exit"` Tauri event.
 */
export interface PtyExitPayload {
  id: PtyId;
}

// ---------------------------------------------------------------------------
// Command wrappers
// ---------------------------------------------------------------------------

/**
 * Spawn a new PTY session on the backend.
 *
 * @returns The numeric `PtyId` assigned to the session.
 */
export async function createPty(options: CreatePtyOptions = {}): Promise<PtyId> {
  return invoke<PtyId>("create_pty", {
    shell: options.shell,
    cwd: options.cwd,
    cols: options.cols,
    rows: options.rows,
  });
}

/**
 * Write raw input data (keystrokes / paste) into a PTY session.
 */
export async function writePty(id: PtyId, data: string): Promise<void> {
  return invoke<void>("write_pty", { id, data });
}

/**
 * Notify the backend of a terminal resize.
 */
export async function resizePty(
  id: PtyId,
  cols: number,
  rows: number
): Promise<void> {
  return invoke<void>("resize_pty", { id, cols, rows });
}

/**
 * Kill a PTY session.  The backend will emit a `"pty-exit"` event shortly after.
 */
export async function killPty(id: PtyId): Promise<void> {
  return invoke<void>("kill_pty", { id });
}
