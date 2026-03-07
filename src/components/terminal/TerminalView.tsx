import { useEffect, useRef, useState } from "react";
import React from "react";
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
import { loadBuiltinTheme, themeToXtermTheme } from "@/lib/theme-engine";
import { terminalManager } from "@/lib/terminal-manager";
import "@xterm/xterm/css/xterm.css";

// Global registry to track initialized terminals
// This prevents re-initialization when React remounts the component
const initializedTerminals = new Map<string, boolean>();

interface TerminalViewProps {
  sessionId: string;
  className?: string;
  forceVisible?: boolean; // Force visibility regardless of isActive state
}

const TerminalViewComponent = ({ sessionId, className = "", forceVisible = false }: TerminalViewProps) => {
  const mountPointRef = useRef<HTMLDivElement>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const { config } = useConfigStore();
  const blockTracker = useBlockTracker(sessionId);
  const sessions = useTerminalStore((state) => state.sessions);

  const session = sessions.find((s) => s.id === sessionId);

  // Initialize terminal instance (only once globally)
  useEffect(() => {
    if (!session) return;

    // Check if terminal instance already exists
    if (terminalManager.hasInstance(sessionId)) {
      // Terminal already initialized, just attach to mount point
      const instance = terminalManager.getInstance(sessionId);
      if (instance && mountPointRef.current) {
        // Move the terminal container to the new mount point
        mountPointRef.current.appendChild(instance.container);
        // Refit terminal
        instance.fitAddon.fit();
        if (session.ptyId !== null && session.ptyId !== undefined) {
          ptyResize(session.ptyId, instance.terminal.cols, instance.terminal.rows).catch(console.error);
        }
      }
      return;
    }

    // Mark as initialized
    initializedTerminals.set(sessionId, true);

    // Create terminal container (will be managed globally)
    const container = document.createElement('div');
    container.className = `terminal-container ${className}`;
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.backgroundColor = 'var(--terminal-background)';

    // Attach to mount point
    if (mountPointRef.current) {
      mountPointRef.current.appendChild(container);
    }

    // Output batching refs
    const outputBufferRef = { current: [] as Uint8Array[] };
    const flushScheduledRef = { current: false };
    const lastFlushTimeRef = { current: 0 };
    const writeQueueSizeRef = { current: 0 };

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

    // Activate unicode11
    terminal.unicode.activeVersion = "11";

    // Open terminal in container
    terminal.open(container);

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

    // Configure copy on select
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
      fitAddon.fit();
      if (session.ptyId !== null) {
        ptyResize(session.ptyId, terminal.cols, terminal.rows).catch((error) => {
          console.error("Failed to resize PTY:", error);
        });
      }
    });

    if (container) {
      resizeObserver.observe(container);
    }

    // Handle keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInTerminal = container.contains(target) || false;

      if (!isInTerminal) return;

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

    // Handle font zoom
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
        fitAddon.fit();
        if (session.ptyId !== null) {
          ptyResize(session.ptyId, terminal.cols, terminal.rows).catch((error) => {
            console.error("Failed to resize PTY:", error);
          });
        }
      }
    );

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keydown", fontZoomHandler);

    // Register terminal instance globally
    terminalManager.registerInstance(sessionId, {
      terminal,
      fitAddon,
      searchAddon,
      container,
      cleanupListeners,
      disposable,
      resizeObserver,
    });

    // Cleanup function (only removes from current mount point, doesn't destroy terminal)
    return () => {
      // Remove container from current mount point
      if (mountPointRef.current && container.parentNode === mountPointRef.current) {
        mountPointRef.current.removeChild(container);
      }
      // Don't dispose terminal, disposable, or cleanup listeners - they're managed globally
      // Don't disconnect resizeObserver - it's managed globally
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keydown", fontZoomHandler);
    };
  }, [sessionId, session, className, config, blockTracker, fontSize]);

  if (!session) {
    return null;
  }

  const instance = terminalManager.getInstance(sessionId);

  return (
    <TerminalContextMenu terminal={instance?.terminal || null}>
      <div
        className="relative"
        style={{
          width: "100%",
          height: "100%",
          visibility: forceVisible || session.isActive ? "visible" : "hidden",
          position: forceVisible || session.isActive ? "relative" : "absolute",
          backgroundColor: "var(--terminal-background)",
        }}
      >
        <div
          ref={mountPointRef}
          className={`terminal-mount-point ${className}`}
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "var(--terminal-background)",
          }}
        />
        {/* AI Block Overlay */}
        {session.isActive && config.ai.blockMode && instance && (
          <AIBlockOverlay sessionId={sessionId} terminal={instance.terminal} />
        )}
        {/* Agent Status Indicator */}
        {session.isActive && config.ai.detectCLI && (
          <div className="absolute bottom-4 right-4 pointer-events-auto">
            <AgentStatus sessionId={sessionId} variant="terminal" />
          </div>
        )}
        {showSearch && session.isActive && instance && (
          <TerminalSearch
            searchAddon={instance.searchAddon}
            onClose={() => {
              setShowSearch(false);
              instance.searchAddon.clearDecorations();
            }}
          />
        )}
      </div>
    </TerminalContextMenu>
  );
}

// Memoize the component to prevent unnecessary re-renders
export const TerminalView = React.memo(TerminalViewComponent, (prevProps, nextProps) => {
  // Only re-render if sessionId changes
  return prevProps.sessionId === nextProps.sessionId;
});
