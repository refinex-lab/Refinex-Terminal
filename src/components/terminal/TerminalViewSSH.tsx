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
import { useTerminalTransport, type TerminalTransportConfig } from "@/hooks/useTerminalTransport";
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
  const [sessionEnded, setSessionEnded] = useState(false);
  const { config } = useConfigStore();
  const blockTracker = useBlockTracker(sessionId);
  const sessions = useTerminalStore((state) => state.sessions);

  const session = sessions.find((s) => s.id === sessionId);

  // Determine terminal mode and transport config
  const transportConfig: TerminalTransportConfig | null = session
    ? {
        mode: session.mode || "local",
        localPtyId: session.mode === "local" || !session.mode ? session.ptyId ?? undefined : undefined,
        sshConnectionId: session.mode === "ssh" ? session.sshConnectionId : undefined,
        sshChannelId: session.mode === "ssh" ? session.sshChannelId : undefined,
      }
    : null;

  // Get terminal transport layer
  const transport = useTerminalTransport(transportConfig!);

  // Apply config changes to terminal in real-time (for existing terminals)
  useEffect(() => {
    const instance = terminalManager.getInstance(sessionId);
    if (!instance || !transport) return;

    const terminal = instance.terminal;

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
        const xtermTheme = themeToXtermTheme(theme);
        terminal.options.theme = xtermTheme;

        // Force refresh the terminal to apply theme immediately
        terminal.refresh(0, terminal.rows - 1);
      })
      .catch(console.error);

    // Refit terminal after changes
    instance.fitAddon.fit();
    transport.resize(terminal.cols, terminal.rows).catch(console.error);
  }, [
    sessionId,
    config.appearance.fontFamily,
    config.appearance.fontSize,
    config.appearance.lineHeight,
    config.appearance.ligatures,
    config.appearance.cursorStyle,
    config.appearance.theme,
    transport,
  ]);

  // Initialize terminal instance (only once globally)
  useEffect(() => {
    if (!session || !transport) return;

    // Check if terminal instance already exists
    if (terminalManager.hasInstance(sessionId)) {
      // Terminal already initialized, just attach to mount point
      const instance = terminalManager.getInstance(sessionId);
      if (instance && mountPointRef.current) {
        // Move the terminal container to the new mount point
        mountPointRef.current.appendChild(instance.container);
        // Refit terminal
        instance.fitAddon.fit();
        transport.resize(instance.terminal.cols, instance.terminal.rows).catch(console.error);
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
      background: "#1e1e1e",
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
      windowOptions: {
        setWinLines: true,
      },
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

    // Handle terminal input (user typing)
    terminal.onData((data) => {
      if (transport) {
        transport.write(data).catch((error) => {
          console.error("Failed to write to terminal:", error);
          // Show error to user if connection is lost
          terminal.write("\r\n\x1b[31mError: Connection lost. Please reconnect.\x1b[0m\r\n");
        });
      }
    });

    // Handle terminal resize
    terminal.onResize(({ cols, rows }) => {
      transport.resize(cols, rows).catch((error) => {
        console.error("Failed to resize terminal:", error);
      });
    });

    // Listen for output from transport layer
    transport.onData((data) => {
      // Batch output for better performance
      outputBufferRef.current.push(data);
      writeQueueSizeRef.current += data.length;

      const now = Date.now();
      const timeSinceLastFlush = now - lastFlushTimeRef.current;

      // Flush immediately if:
      // 1. Buffer is large (>64KB)
      // 2. It's been a while since last flush (>16ms)
      // 3. No flush is scheduled
      if (
        writeQueueSizeRef.current > 65536 ||
        timeSinceLastFlush > 16 ||
        !flushScheduledRef.current
      ) {
        if (flushScheduledRef.current) {
          // Cancel scheduled flush since we're flushing now
          flushScheduledRef.current = false;
        }

        // Flush immediately
        const buffer = outputBufferRef.current;
        outputBufferRef.current = [];
        writeQueueSizeRef.current = 0;
        lastFlushTimeRef.current = now;

        // Combine all chunks and write to terminal
        const totalLength = buffer.reduce((sum, chunk) => sum + chunk.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of buffer) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }

        terminal.write(combined);
      } else if (!flushScheduledRef.current) {
        // Schedule a flush for next frame
        flushScheduledRef.current = true;
        requestAnimationFrame(() => {
          flushScheduledRef.current = false;

          if (outputBufferRef.current.length > 0) {
            const buffer = outputBufferRef.current;
            outputBufferRef.current = [];
            writeQueueSizeRef.current = 0;
            lastFlushTimeRef.current = Date.now();

            const totalLength = buffer.reduce((sum, chunk) => sum + chunk.length, 0);
            const combined = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of buffer) {
              combined.set(chunk, offset);
              offset += chunk.length;
            }

            terminal.write(combined);
          }
        });
      }
    }).catch(console.error);

    // Listen for session end
    transport.onClose(() => {
      setSessionEnded(true);
      terminal.write("\r\n\x1b[1;31m[Session ended]\x1b[0m\r\n");
    }).catch(console.error);

    // Apply font settings
    applyFont({
      family: config.appearance.fontFamily,
      size: config.appearance.fontSize,
      lineHeight: config.appearance.lineHeight,
      ligatures: config.appearance.ligatures,
    }, terminal);

    // Setup font zoom handler
    const cleanupZoom = createFontZoomHandler(terminal, (newSize) => {
      setFontSize(newSize);
    });

    // Store terminal instance globally
    terminalManager.registerInstance(sessionId, {
      terminal,
      fitAddon,
      searchAddon,
      container,
      cleanupListeners: undefined,
      disposable: undefined,
      resizeObserver: new ResizeObserver(() => {}),
    });

    // Cleanup function
    return () => {
      cleanupZoom();
      // Don't dispose terminal here - it's managed globally
      // Only remove from DOM if component unmounts
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    };
  }, [sessionId, session, transport, className, config]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const instance = terminalManager.getInstance(sessionId);
      if (instance && transport) {
        instance.fitAddon.fit();
        transport.resize(instance.terminal.cols, instance.terminal.rows).catch(console.error);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [sessionId, transport]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Safety check for event object
      if (!e) return;

      // Cmd/Ctrl + F: Open search
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full">
        <p style={{ color: "var(--ui-muted-foreground)" }}>Session not found</p>
      </div>
    );
  }

  const isVisible = forceVisible || session.isActive;

  return (
    <div
      className="relative w-full h-full"
      style={{
        display: isVisible ? "block" : "none",
      }}
    >
      {/* Terminal mount point */}
      <div ref={mountPointRef} className="w-full h-full" />

      {/* Search overlay */}
      {showSearch && (
        <TerminalSearch
          sessionId={sessionId}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* Context menu */}
      <TerminalContextMenu sessionId={sessionId} />

      {/* AI Block overlay */}
      {blockTracker.activeBlock && (
        <AIBlockOverlay
          sessionId={sessionId}
          block={blockTracker.activeBlock}
          onAccept={blockTracker.acceptBlock}
          onReject={blockTracker.rejectBlock}
        />
      )}

      {/* Agent status indicator */}
      {blockTracker.agentActive && (
        <AgentStatus
          cliType={blockTracker.cliType as CLIType}
          isStreaming={blockTracker.isStreaming}
        />
      )}

      {/* SSH connection status bar (only for SSH mode) */}
      {session.mode === "ssh" && session.sshHostLabel && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "24px",
            backgroundColor: "var(--ui-background)",
            borderTop: "1px solid var(--ui-border)",
            display: "flex",
            alignItems: "center",
            paddingLeft: "12px",
            paddingRight: "12px",
            fontSize: "12px",
            color: "var(--ui-muted-foreground)",
            gap: "8px",
          }}
        >
          {session.sshColor && (
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: session.sshColor,
              }}
            />
          )}
          <span>SSH · {session.sshHostLabel}</span>
          {!sessionEnded && <span>· Connected</span>}
          {sessionEnded && <span style={{ color: "var(--terminal-red)" }}>· Disconnected</span>}
        </div>
      )}

      {/* Session ended overlay */}
      {sessionEnded && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            backgroundColor: "var(--ui-background)",
            border: "1px solid var(--ui-border)",
            borderRadius: "8px",
            padding: "24px",
            textAlign: "center",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
          }}
        >
          <div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
            {session.mode === "ssh" ? "SSH Connection Closed" : "Session Ended"}
          </div>
          <div style={{ fontSize: "14px", color: "var(--ui-muted-foreground)" }}>
            {session.mode === "ssh"
              ? "The remote connection has been closed"
              : "Press Enter to reconnect or close this tab"}
          </div>
        </div>
      )}
    </div>
  );
};

export const TerminalView = React.memo(TerminalViewComponent);
