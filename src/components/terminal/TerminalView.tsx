import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { listen } from "@tauri-apps/api/event";
import { ptySpawn, ptyWrite, ptyResize } from "@/lib/tauri-pty";
import { useTerminalStore } from "@/stores/terminal-store";
import { TerminalSearch } from "./TerminalSearch";
import { TerminalContextMenu } from "./TerminalContextMenu";
import "@xterm/xterm/css/xterm.css";

interface TerminalViewProps {
  sessionId: string;
  className?: string;
}

export function TerminalView({ sessionId, className = "" }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const { sessions } = useTerminalStore();

  const session = sessions.find((s) => s.id === sessionId);

  useEffect(() => {
    if (!containerRef.current || !session) return;

    // Initialize terminal
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      theme: {
        background: "transparent",
        foreground: "#d4d4d4",
        cursor: "#d4d4d4",
        black: "#000000",
        red: "#cd3131",
        green: "#0dbc79",
        yellow: "#e5e510",
        blue: "#2472c8",
        magenta: "#bc3fbc",
        cyan: "#11a8cd",
        white: "#e5e5e5",
        brightBlack: "#666666",
        brightRed: "#f14c4c",
        brightGreen: "#23d18b",
        brightYellow: "#f5f543",
        brightBlue: "#3b8eea",
        brightMagenta: "#d670d6",
        brightCyan: "#29b8db",
        brightWhite: "#ffffff",
      },
      allowProposedApi: true,
    });

    // Initialize addons
    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon();
    const unicode11Addon = new Unicode11Addon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(searchAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.loadAddon(unicode11Addon);

    // Store refs
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    // Activate unicode11
    terminal.unicode.activeVersion = "11";

    // Open terminal in container
    terminal.open(containerRef.current);

    // Load WebGL addon (must be after open)
    try {
      const webglAddon = new WebglAddon();
      terminal.loadAddon(webglAddon);
    } catch (e) {
      console.warn("WebGL addon failed to load, falling back to canvas renderer:", e);
    }

    // Fit terminal to container
    fitAddon.fit();

    // Configure copy on select (TODO: make configurable via settings)
    terminal.onSelectionChange(() => {
      if (terminal.hasSelection()) {
        const selection = terminal.getSelection();
        navigator.clipboard.writeText(selection).catch((error) => {
          console.error("Failed to copy selection:", error);
        });
      }
    });

    // Spawn PTY if not already spawned
    const initPty = async () => {
      if (session.ptyId !== null) {
        // PTY already spawned, just listen for output
        const unlisten = await listen<number[]>(
          `pty-output-${session.ptyId}`,
          (event) => {
            const data = new Uint8Array(event.payload);
            terminal.write(data);
          }
        );

        const unlistenExit = await listen(`pty-exit-${session.ptyId}`, () => {
          terminal.write("\r\n\r\n[Process completed]\r\n");
        });

        return () => {
          unlisten();
          unlistenExit();
        };
      }

      try {
        const cwd = await import("@tauri-apps/api/path").then((m) =>
          m.homeDir()
        );
        const id = await ptySpawn(
          cwd || "~",
          terminal.cols,
          terminal.rows
        );

        // Update session with PTY ID
        const store = useTerminalStore.getState();
        const updatedSessions = store.sessions.map((s) =>
          s.id === sessionId ? { ...s, ptyId: id } : s
        );
        store.sessions = updatedSessions;

        // Listen for PTY output
        const unlisten = await listen<number[]>(
          `pty-output-${id}`,
          (event) => {
            const data = new Uint8Array(event.payload);
            terminal.write(data);
          }
        );

        // Listen for PTY exit
        const unlistenExit = await listen(`pty-exit-${id}`, () => {
          terminal.write("\r\n\r\n[Process completed]\r\n");
        });

        return () => {
          unlisten();
          unlistenExit();
        };
      } catch (error) {
        console.error("Failed to spawn PTY:", error);
        terminal.write(`\r\nError: Failed to spawn PTY: ${error}\r\n`);
      }
    };

    let cleanupListeners: (() => void) | undefined;
    initPty().then((cleanup) => {
      cleanupListeners = cleanup;
    });

    // Handle terminal input
    const disposable = terminal.onData(async (data) => {
      // Wait for PTY to be initialized
      let currentPtyId = session.ptyId;
      if (currentPtyId === null) {
        // Wait a bit for PTY initialization
        await new Promise(resolve => setTimeout(resolve, 100));
        const store = useTerminalStore.getState();
        const currentSession = store.sessions.find(s => s.id === sessionId);
        currentPtyId = currentSession?.ptyId ?? null;
      }

      if (currentPtyId !== null) {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(data);
        ptyWrite(currentPtyId, bytes).catch((error) => {
          console.error("Failed to write to PTY:", error);
        });
      }
    });

    // Handle container resize
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current && terminalRef.current) {
        fitAddon.fit();
        if (session.ptyId !== null) {
          ptyResize(session.ptyId, terminal.cols, terminal.rows).catch((error) => {
            console.error("Failed to resize PTY:", error);
          });
        }
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Handle Cmd/Ctrl+F to open search and copy/paste shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl + F: Open search
      if (modifier && e.key === "f") {
        e.preventDefault();
        setShowSearch(true);
        return;
      }

      // Cmd/Ctrl + C: Copy selection (if text is selected)
      if (modifier && e.key === "c" && !e.shiftKey) {
        if (terminal.hasSelection()) {
          e.preventDefault();
          const selection = terminal.getSelection();
          navigator.clipboard.writeText(selection).catch((error) => {
            console.error("Failed to copy:", error);
          });
        }
        // If no selection, let Ctrl+C pass through to send SIGINT
        return;
      }

      // Cmd/Ctrl + Shift + C: Always copy selection
      if (modifier && e.shiftKey && e.key === "C") {
        e.preventDefault();
        if (terminal.hasSelection()) {
          const selection = terminal.getSelection();
          navigator.clipboard.writeText(selection).catch((error) => {
            console.error("Failed to copy:", error);
          });
        }
        return;
      }

      // Cmd/Ctrl + V: Paste from clipboard
      if (modifier && e.key === "v" && !e.shiftKey) {
        e.preventDefault();
        navigator.clipboard.readText().then((text) => {
          terminal.paste(text);
        }).catch((error) => {
          console.error("Failed to paste:", error);
        });
        return;
      }

      // Cmd/Ctrl + Shift + V: Always paste
      if (modifier && e.shiftKey && e.key === "V") {
        e.preventDefault();
        navigator.clipboard.readText().then((text) => {
          terminal.paste(text);
        }).catch((error) => {
          console.error("Failed to paste:", error);
        });
        return;
      }

      // Cmd/Ctrl + A: S
      if (modifier && e.key === "a") {
        e.preventDefault();
        terminal.selectAll();
        return;
      }

      // Cmd/Ctrl + K: Clear terminal
      if (modifier && e.key === "k") {
        e.preventDefault();
        terminal.clear();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    // Cleanup
    return () => {
      disposable.dispose();
      resizeObserver.disconnect();
      window.removeEventListener("keydown", handleKeyDown);
      if (cleanupListeners) {
        cleanupListeners();
      }
      terminal.dispose();
    };
  }, [sessionId]);

  if (!session) {
    return null;
  }

  return (
    <TerminalContextMenu terminal={terminalRef.current}>
      <div
        className="relative"
        style={{
          width: "100%",
          height: "100%",
          display: session.isActive ? "block" : "none",
        }}
      >
        <div
          ref={containerRef}
          className={`terminal-container ${className}`}
          style={{
            width: "100%",
            height: "100%",
          }}
        />
        {showSearch && session.isActive && (
          <TerminalSearch
            searchAddon={searchAddonRef.current}
            onClose={() => {
              setShowSearch(false);
              searchAddonRef.current?.clearDecorations();
            }}
          />
        )}
      </div>
    </TerminalContextMenu>
  );
}

