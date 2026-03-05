import { useEffect, useRef, useState } from "react";
import { Terminal, type ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { listen } from "@tauri-apps/api/event";
import { ptySpawn, ptyWrite, ptyResize, detectPtyCli } from "@/lib/tauri-pty";
import { useTerminalStore } from "@/stores/terminal-store";
import { useConfigStore } from "@/stores/config-store";
import { TerminalSearch } from "./TerminalSearch";
import { TerminalContextMenu } from "./TerminalContextMenu";
import { AIBlockOverlay } from "./AIBlockOverlay";
import { AgentStatus } from "./AgentStatus";
import { useBlockTracker, type CLIType } from "@/lib/ai-block-detector";
import { createFontZoomHandler, applyFont } from "@/lib/font-manager";
import { loadBuiltinTheme, applyTheme, themeToXtermTheme } from "@/lib/theme-engine";
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
  const [fontSize, setFontSize] = useState(14);
  const { sessions } = useTerminalStore();
  const { config } = useConfigStore();
  const blockTracker = useBlockTracker(sessionId);

  // Output batching for streaming performance
  const outputBufferRef = useRef<Uint8Array[]>([]);
  const flushScheduledRef = useRef(false);
  const lastFlushTimeRef = useRef(0);
  const writeQueueSizeRef = useRef(0);

  const session = sessions.find((s) => s.id === sessionId);

  // Apply config changes to terminal in real-time
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    // Apply font settings
    applyFont({
      family: config.appearance.fontFamily,
      size: config.appearance.fontSize,
      lineHeight: config.appearance.lineHeight,
      ligatures: config.appearance.ligatures,
    }, terminal);

    // Apply cursor style
    terminal.options.cursorStyle = config.appearance.cursorStyle;

    // Apply theme
    loadBuiltinTheme(config.appearance.theme)
      .then((theme) => {
        applyTheme(theme);
        terminal.options.theme = themeToXtermTheme(theme);
      })
      .catch(console.error);

    // Refit terminal after changes
    if (fitAddonRef.current) {
      fitAddonRef.current.fit();
      if (session?.ptyId !== null && session?.ptyId !== undefined) {
        ptyResize(session.ptyId, terminal.cols, terminal.rows).catch(console.error);
      }
    }
  }, [
    config.appearance.fontFamily,
    config.appearance.fontSize,
    config.appearance.lineHeight,
    config.appearance.ligatures,
    config.appearance.cursorStyle,
    config.appearance.theme,
    session?.ptyId,
  ]);

  // Refit terminal when tab becomes active
  useEffect(() => {
    if (!session?.isActive || !terminalRef.current || !fitAddonRef.current) return;

    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => {
      if (fitAddonRef.current && terminalRef.current) {
        fitAddonRef.current.fit();
        if (session.ptyId !== null && session.ptyId !== undefined) {
          const terminal = terminalRef.current;
          ptyResize(session.ptyId, terminal.cols, terminal.rows).catch(console.error);
        }
      }
    });
  }, [session?.isActive, session?.ptyId]);

  useEffect(() => {
    if (!containerRef.current || !session) return;

    // Load theme synchronously before terminal initialization
    let initialTheme: ITheme = {
      background: "transparent",
      foreground: "#d4d4d4",
      cursor: "#d4d4d4",
    };

    // Initialize terminal with config
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: config.appearance.fontSize,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      lineHeight: config.appearance.lineHeight,
      letterSpacing: 0,
      cursorWidth: 1,
      cursorStyle: config.appearance.cursorStyle,
      theme: initialTheme,
      scrollback: config.terminal.scrollbackLines || 10000,
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

    // Apply theme immediately after opening
    loadBuiltinTheme(config.appearance.theme)
      .then((theme) => {
        terminal.options.theme = themeToXtermTheme(theme);
      })
      .catch(console.error);

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

    // Batched output flushing for streaming performance
    const flushOutputBuffer = () => {
      if (outputBufferRef.current.length === 0) {
        flushScheduledRef.current = false;
        return;
      }

      // Concatenate all buffered data
      const totalLength = outputBufferRef.current.reduce((sum, arr) => sum + arr.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of outputBufferRef.current) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      // Write to terminal
      terminal.write(combined);

      // Process for AI block detection
      const decoder = new TextDecoder();
      const text = decoder.decode(combined);
      const lines = text.split(/\r?\n/);
      const currentLine = terminal.buffer.active.cursorY + terminal.buffer.active.baseY;

      lines.forEach((line, index) => {
        if (line.trim()) {
          blockTracker.processLine(line, currentLine + index);
        }
      });

      // Check for large blocks and auto-collapse
      if (config.ai.blockMode) {
        const blocks = blockTracker.getBlocks();
        const maxLines = config.ai.maxBlockLines || 50000;
        blocks.forEach((block) => {
          const lineCount = block.endLine - block.startLine + 1;
          if (lineCount > maxLines && !block.isCollapsed) {
            blockTracker.toggleCollapse(block.id);
          }
        });
      }

      // Clear buffer and update metrics
      outputBufferRef.current = [];
      writeQueueSizeRef.current = 0;
      lastFlushTimeRef.current = performance.now();
      flushScheduledRef.current = false;
    };

    const scheduleFlush = () => {
      if (flushScheduledRef.current) return;

      flushScheduledRef.current = true;
      const throttleMs = config.ai.streamingThrottle || 16;
      const timeSinceLastFlush = performance.now() - lastFlushTimeRef.current;

      // Implement backpressure: delay if write queue is large
      const hasBackpressure = writeQueueSizeRef.current > 10000;
      const delay = hasBackpressure ? throttleMs * 2 : Math.max(0, throttleMs - timeSinceLastFlush);

      if (delay > 0) {
        setTimeout(() => {
          requestAnimationFrame(flushOutputBuffer);
        }, delay);
      } else {
        requestAnimationFrame(flushOutputBuffer);
      }
    };

    const queueOutput = (data: Uint8Array) => {
      outputBufferRef.current.push(data);
      writeQueueSizeRef.current += data.length;
      scheduleFlush();
    };

    // Spawn PTY if not already spawned
    const initPty = async () => {
      if (session.ptyId !== null) {
        // PTY already spawned, just listen for output
        const unlisten = await listen<number[]>(
          `pty-output-${session.ptyId}`,
          (event) => {
            const data = new Uint8Array(event.payload);
            queueOutput(data);
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
        // Use session's cwd if specified, otherwise use home directory
        let cwd = session.cwd;
        if (!cwd) {
          cwd = await import("@tauri-apps/api/path").then((m) =>
            m.homeDir()
          );
        }
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

        // Detect CLI type from PTY process and set it in block tracker
        // Poll periodically to detect CLI tools launched after shell starts
        const detectCLI = async () => {
          try {
            const cliType = await detectPtyCli(id);
            if (cliType) {
              blockTracker.setActiveCLI(cliType as CLIType);
            }
          } catch (error) {
            console.error("Failed to detect CLI type:", error);
          }
        };

        // Initial detection
        detectCLI();

        // Poll every 2 seconds to detect newly launched CLI tools
        const cliDetectionInterval = setInterval(detectCLI, 2000);

        // Listen for PTY output with batching
        const unlisten = await listen<number[]>(
          `pty-output-${id}`,
          (event) => {
            const data = new Uint8Array(event.payload);
            queueOutput(data);
          }
        );

        // Listen for PTY exit
        const unlistenExit = await listen(`pty-exit-${id}`, () => {
          terminal.write("\r\n\r\n[Process completed]\r\n");
          clearInterval(cliDetectionInterval);
        });

        return () => {
          unlisten();
          unlistenExit();
          clearInterval(cliDetectionInterval);
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

    // Handle Cmd/Ctrl+F to open search, copy/paste shortcuts, and font zoom
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

      // Cmd/Ctrl + A: Select all
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

    // Handle font zoom (Cmd/Ctrl + Plus/Minus/0)
    const fontZoomHandler = createFontZoomHandler(
      () => fontSize,
      (newSize) => {
        setFontSize(newSize);
        applyFont({
          family: config.appearance.fontFamily,
          size: newSize,
          lineHeight: config.appearance.lineHeight,
          ligatures: config.appearance.ligatures,
        }, terminal);
        // Refit terminal after font size change
        if (fitAddonRef.current) {
          fitAddon.fit();
          if (session.ptyId !== null) {
            ptyResize(session.ptyId, terminal.cols, terminal.rows).catch((error) => {
              console.error("Failed to resize PTY:", error);
            });
          }
        }
      }
    );

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keydown", fontZoomHandler);

    // Cleanup
    return () => {
      disposable.dispose();
      resizeObserver.disconnect();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keydown", fontZoomHandler);
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
          visibility: session.isActive ? "visible" : "hidden",
          position: session.isActive ? "relative" : "absolute",
          backgroundColor: "var(--terminal-background)",
        }}
      >
        <div
          ref={containerRef}
          className={`terminal-container ${className}`}
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "var(--terminal-background)",
          }}
        />
        {/* AI Block Overlay */}
        {session.isActive && config.ai.blockMode && (
          <AIBlockOverlay sessionId={sessionId} terminal={terminalRef.current} />
        )}
        {/* Agent Status Indicator */}
        {session.isActive && config.ai.detectCLI && (
          <div className="absolute bottom-4 right-4 pointer-events-auto">
            <AgentStatus sessionId={sessionId} variant="terminal" />
          </div>
        )}
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

