import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { listen } from "@tauri-apps/api/event";
import { ptySpawn, ptyWrite, ptyResize, ptyKill } from "@/lib/tauri-pty";
import "@xterm/xterm/css/xterm.css";

interface TerminalViewProps {
  className?: string;
}

export function TerminalView({ className = "" }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [ptyId, setPtyId] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize terminal
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      theme: {
        background: "#1e1e1e",
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

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Spawn PTY
    const initPty = async () => {
      try {
        const cwd = await import("@tauri-apps/api/path").then((m) =>
          m.homeDir()
        );
        const id = await ptySpawn(
          cwd || "~",
          terminal.cols,
          terminal.rows
        );
        setPtyId(id);

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
    const disposable = terminal.onData((data) => {
      if (ptyId !== null) {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(data);
        ptyWrite(ptyId, bytes).catch((error) => {
          console.error("Failed to write to PTY:", error);
        });
      }
    });

    // Handle container resize
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current && terminalRef.current) {
        fitAddon.fit();
        if (ptyId !== null) {
          ptyResize(ptyId, terminal.cols, terminal.rows).catch((error) => {
            console.error("Failed to resize PTY:", error);
          });
        }
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Cleanup
    return () => {
      disposable.dispose();
      resizeObserver.disconnect();
      if (cleanupListeners) {
        cleanupListeners();
      }
      if (ptyId !== null) {
        ptyKill(ptyId).catch((error) => {
          console.error("Failed to kill PTY:", error);
        });
      }
      terminal.dispose();
    };
  }, []);

  // Update ptyId in the onData handler
  useEffect(() => {
    if (!terminalRef.current || ptyId === null) return;

    const terminal = terminalRef.current;
    const disposable = terminal.onData((data) => {
      const encoder = new TextEncoder();
      const bytes = encoder.encode(data);
      ptyWrite(ptyId, bytes).catch((error) => {
        console.error("Failed to write to PTY:", error);
      });
    });

    return () => {
      disposable.dispose();
    };
  }, [ptyId]);

  return (
    <div
      ref={containerRef}
      className={`terminal-container ${className}`}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
