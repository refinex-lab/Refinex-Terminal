// SPDX-License-Identifier: MIT
// Copyright (c) 2026 refinex-lab

/**
 * TerminalPane — a single xterm.js terminal wired to a backend PTY session.
 *
 * Lifecycle:
 *   1. Mount  → open xterm, call `create_pty`, begin listening for output.
 *   2. Resize → FitAddon.fit() + `resize_pty` to keep backend in sync.
 *   3. Input  → xterm `onData` → `write_pty`.
 *   4. Output → `pty-output` Tauri event (Base64) → `terminal.write(bytes)`.
 *   5. Exit   → `pty-exit` Tauri event → show "session ended" banner.
 *   6. Unmount → `kill_pty`, unlisten, dispose xterm.
 *
 * Designed for future multi-pane use: each instance manages its own PTY and
 * only processes events whose `id` matches its own session.
 */

import { useEffect, useRef } from "react";
import { Terminal, type ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { listen } from "@tauri-apps/api/event";
import "@xterm/xterm/css/xterm.css";

import {
  createPty,
  writePty,
  resizePty,
  killPty,
  type PtyId,
  type PtyOutputPayload,
  type PtyExitPayload,
} from "../lib/pty";

// ---------------------------------------------------------------------------
// Theme definitions
// ---------------------------------------------------------------------------

/** Tokyo Night — default Refinex color scheme. */
const THEME_TOKYO_NIGHT: ITheme = {
  background: "#1a1b26",
  foreground: "#c0caf5",
  cursor: "#c0caf5",
  cursorAccent: "#1a1b26",
  selectionBackground: "#283457",
  black: "#15161e",
  red: "#f7768e",
  green: "#9ece6a",
  yellow: "#e0af68",
  blue: "#7aa2f7",
  magenta: "#bb9af7",
  cyan: "#7dcfff",
  white: "#a9b1d6",
  brightBlack: "#414868",
  brightRed: "#f7768e",
  brightGreen: "#9ece6a",
  brightYellow: "#e0af68",
  brightBlue: "#7aa2f7",
  brightMagenta: "#bb9af7",
  brightCyan: "#7dcfff",
  brightWhite: "#c0caf5",
};

/** Reserved interface for future system-theme integration. */
export type TerminalThemeKey = "tokyo-night";

/** Map from theme key to xterm ITheme. Easy to extend in future phases. */
const THEMES: Record<TerminalThemeKey, ITheme> = {
  "tokyo-night": THEME_TOKYO_NIGHT,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TerminalPaneProps {
  /**
   * Shell binary to launch. Omit to use the backend default
   * (`$SHELL` on macOS/Linux, `powershell.exe` on Windows).
   */
  shell?: string;
  /** Initial working directory. Omit to use the user's home directory. */
  cwd?: string;
  /** Color theme key. Defaults to `"tokyo-night"`. */
  theme?: TerminalThemeKey;
  /** Called when the PTY process exits. */
  onExit?: (id: PtyId) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * A single terminal pane that creates and manages one PTY session.
 */
export function TerminalPane({
  shell,
  cwd,
  theme = "tokyo-night",
  onExit,
}: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // We store mutable refs for objects that must not trigger re-renders.
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const ptyIdRef = useRef<PtyId | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // --- 1. Initialise xterm terminal ---
    const terminal = new Terminal({
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      fontSize: 14,
      lineHeight: 1.2,
      theme: THEMES[theme],
      cursorBlink: true,
      cursorStyle: "block",
      allowTransparency: true,
      scrollback: 10_000,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());
    terminal.open(containerRef.current);
    fitAddon.fit();

    termRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // --- 2. Wire xterm input → write_pty ---
    const onDataDispose = terminal.onData((data) => {
      if (ptyIdRef.current !== null) {
        writePty(ptyIdRef.current, data).catch((err: unknown) => {
          terminal.writeln(`\r\n\x1b[31m[write error] ${String(err)}\x1b[0m`);
        });
      }
    });

    // --- 3. Create the backend PTY session ---
    // We defer until after the first fit() so we have accurate col/row counts.
    let unlistenOutput: (() => void) | null = null;
    let unlistenExit: (() => void) | null = null;
    let destroyed = false; // guard for async teardown race

    const initPty = async () => {
      const { cols, rows } = terminal;

      let id: PtyId;
      try {
        id = await createPty({ shell, cwd, cols, rows });
      } catch (err: unknown) {
        if (destroyed) return;
        terminal.writeln(
          `\r\n\x1b[31m[Refinex] Failed to create PTY: ${String(err)}\x1b[0m`
        );
        return;
      }

      if (destroyed) {
        // Component unmounted while we were awaiting — clean up immediately.
        killPty(id).catch(() => {});
        return;
      }

      ptyIdRef.current = id;

      // --- 4. pty-output → terminal.write ---
      unlistenOutput = await listen<PtyOutputPayload>("pty-output", (event) => {
        if (event.payload.id !== id) return; // ignore other sessions
        // Decode Base64 → Uint8Array so xterm handles binary VT sequences correctly.
        const binary = atob(event.payload.data);
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        terminal.write(bytes);
      });

      // --- 5. pty-exit → show banner, call onExit ---
      unlistenExit = await listen<PtyExitPayload>("pty-exit", (event) => {
        if (event.payload.id !== id) return;
        terminal.writeln(
          "\r\n\x1b[2m[Refinex Terminal] Session ended. Press any key to close.\x1b[0m"
        );
        onExit?.(id);
      });
    };

    initPty().catch((err: unknown) => {
      console.error("TerminalPane initPty unexpected error", err);
    });

    // --- 6. ResizeObserver — keeps backend cols/rows in sync ---
    // ResizeObserver is used instead of `window.resize` so each pane tracks
    // its own dimensions independently in future split-pane layouts.
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      if (ptyIdRef.current !== null) {
        const { cols, rows } = terminal;
        resizePty(ptyIdRef.current, cols, rows).catch(() => {});
      }
    });
    resizeObserver.observe(containerRef.current);

    // --- Cleanup ---
    return () => {
      destroyed = true;
      resizeObserver.disconnect();
      onDataDispose.dispose();
      unlistenOutput?.();
      unlistenExit?.();
      if (ptyIdRef.current !== null) {
        killPty(ptyIdRef.current).catch(() => {});
        ptyIdRef.current = null;
      }
      terminal.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
    // Shell and cwd are intentionally excluded from the dep array:
    // the PTY is created once on mount and lives until unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="terminal-pane" />;
}

export default TerminalPane;
