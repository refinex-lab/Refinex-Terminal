import { useEffect, useRef, useState, useCallback, lazy, Suspense } from "react";
import { Toaster } from "sonner";
import { TabBar } from "@/components/tabs/TabBar";
import { SplitContainer } from "@/components/terminal/SplitContainer";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { FileEditorPanel } from "@/components/sidebar/FileEditorPanel";
import { StatusBar } from "@/components/editor/StatusBar";
import { useTerminalStore } from "@/stores/terminal-store";
import { useConfigStore } from "@/stores/config-store";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useFileEditorStore } from "@/stores/file-editor-store";
import { loadBuiltinTheme, applyTheme } from "@/lib/theme-engine";
import { getKeybindingManager } from "@/lib/keybinding-manager";
import { useActionHandler } from "@/lib/keybinding-manager";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { setWindowOpacity, setWindowVibrancy, getWindowState, restoreWindowState, toggleFullscreen, setAlwaysOnTop } from "@/lib/tauri-window";
import "./App.css";
import "./styles/editor-selection-debug.css";
import "./styles/markdown-preview.css";

// Lazy load heavy components for faster startup
const SettingsPanel = lazy(() => import("@/components/settings/SettingsPanel").then(m => ({ default: m.SettingsPanel })));
const QuickProjectSwitch = lazy(() => import("@/components/sidebar/QuickProjectSwitch").then(m => ({ default: m.QuickProjectSwitch })));
const FuzzyFileFinder = lazy(() => import("@/components/sidebar/FuzzyFileFinder").then(m => ({ default: m.FuzzyFileFinder })));
const CommandPalette = lazy(() => import("@/components/command-palette/CommandPalette").then(m => ({ default: m.CommandPalette })));

function App() {
  const { sessions, addSession } = useTerminalStore();
  const { isVisible: sidebarVisible, toggleVisibility: toggleSidebar } = useSidebarStore();
  const { tabs: fileTabs } = useFileEditorStore();
  const initializedRef = useRef(false);
  const keybindingManagerRef = useRef<ReturnType<typeof getKeybindingManager> | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectSwitchOpen, setProjectSwitchOpen] = useState(false);
  const [fileFinderOpen, setFileFinderOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [editorWidth, setEditorWidth] = useState(600);
  const [isResizingEditor, setIsResizingEditor] = useState(false);
  const { config } = useConfigStore();

  // Initialize keybinding manager
  useEffect(() => {
    if (!keybindingManagerRef.current) {
      keybindingManagerRef.current = getKeybindingManager();
    }

    // Don't destroy on cleanup - keep the singleton alive
  }, []);

  // Register global action handlers
  useActionHandler("settings.open", useCallback(() => {
    setSettingsOpen(true);
  }, []));

  useActionHandler("sidebar.toggle", useCallback(() => {
    toggleSidebar();
  }, [toggleSidebar]));

  useActionHandler("command_palette.open", useCallback(() => {
    setCommandPaletteOpen(true);
  }, []));

  useActionHandler("command_palette.open_files", useCallback(() => {
    setFileFinderOpen(true);
  }, []));

  // Register window actions
  useActionHandler("window.toggle_fullscreen", useCallback(() => {
    toggleFullscreen().catch(console.error);
  }, []));

  useActionHandler("window.toggle_always_on_top", useCallback(() => {
    // Toggle state
    const currentState = localStorage.getItem("always-on-top") === "true";
    const newState = !currentState;
    localStorage.setItem("always-on-top", String(newState));
    setAlwaysOnTop(newState).catch(console.error);
  }, []));

  // Register file actions
  useActionHandler("file.open_folder", useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
      });

      if (selected) {
        const { addProject } = useSidebarStore.getState();
        addProject(selected as string);
      }
    } catch (error) {
      console.error("Failed to open folder:", error);
    }
  }, []));

  // Initialize with one terminal session
  useEffect(() => {
    if (!initializedRef.current && sessions.length === 0) {
      initializedRef.current = true;
      addSession({
        id: `terminal-${Date.now()}`,
        title: "⌘ 1",
        cwd: "~",
        ptyId: null,
      });
    }
  }, [sessions.length, addSession]);

  // Load config from backend on mount
  useEffect(() => {
    invoke<any>("get_config")
      .then((loadedConfig) => {
        // Transform Rust config (snake_case) to TypeScript config (camelCase)
        const transformedConfig = {
          appearance: {
            theme: loadedConfig.appearance?.theme || "refinex-dark",
            fontFamily: loadedConfig.appearance?.font_family || "JetBrains Mono",
            fontSize: loadedConfig.appearance?.font_size || 14,
            lineHeight: loadedConfig.appearance?.line_height || 1.5,
            ligatures: loadedConfig.appearance?.font_ligatures ?? true,
            opacity: loadedConfig.appearance?.opacity || 1.0,
            vibrancy: loadedConfig.appearance?.vibrancy ?? false,
            cursorStyle: loadedConfig.appearance?.cursor_style || "block",
          },
          terminal: {
            shell: loadedConfig.terminal?.shell || "",
            scrollbackLines: loadedConfig.terminal?.scrollback_lines || 10000,
            copyOnSelect: loadedConfig.terminal?.copy_on_select ?? true,
            bellMode: loadedConfig.terminal?.bell_mode || "none",
            env: {},
          },
          ai: {
            detectCLI: loadedConfig.ai?.detect_cli ?? true,
            blockMode: loadedConfig.ai?.block_mode ?? true,
            streamingThrottle: loadedConfig.ai?.streaming_throttle_ms || 16,
            maxBlockLines: loadedConfig.ai?.max_block_lines || 50000,
          },
          git: {
            enabled: loadedConfig.git?.enabled ?? true,
            autoFetchInterval: loadedConfig.git?.auto_fetch_interval || 300,
            showDiff: loadedConfig.git?.show_diff ?? true,
          },
          keybindings: config.keybindings, // Keep existing keybindings
          projects: config.projects, // Keep existing projects
        };

        useConfigStore.setState({ config: transformedConfig });
      })
      .catch((error) => {
        console.error("Failed to load config:", error);
      });
  }, []);

  // Apply theme to UI and window
  useEffect(() => {
    loadBuiltinTheme(config.appearance.theme)
      .then((theme) => {
        applyTheme(theme);

        // Set window theme based on background brightness
        const bgColor = theme.ui.background;
        const isDark = isColorDark(bgColor);

        invoke("set_title_bar_theme", { theme: isDark ? "dark" : "light" })
          .catch(console.error);
      })
      .catch(console.error);
  }, [config.appearance.theme]);

  // Apply opacity and vibrancy settings
  useEffect(() => {
    setWindowOpacity(config.appearance.opacity).catch(console.error);
  }, [config.appearance.opacity]);

  useEffect(() => {
    setWindowVibrancy(config.appearance.vibrancy).catch(console.error);
  }, [config.appearance.vibrancy]);

  // Save and restore window state
  useEffect(() => {
    // Restore window state on mount
    const savedState = localStorage.getItem("window-state");
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        restoreWindowState(state).catch(console.error);
      } catch (error) {
        console.error("Failed to restore window state:", error);
      }
    }

    // Save window state periodically and on unmount
    const saveWindowState = () => {
      getWindowState()
        .then((state) => {
          localStorage.setItem("window-state", JSON.stringify(state));
        })
        .catch(console.error);
    };

    const interval = setInterval(saveWindowState, 5000); // Save every 5 seconds

    // Save on beforeunload
    window.addEventListener("beforeunload", saveWindowState);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", saveWindowState);
      saveWindowState(); // Final save on unmount
    };
  }, []);

  // Helper function to determine if a color is dark
  const isColorDark = (color: string): boolean => {
    // Parse hex color
    const hex = color.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance < 0.5;
  };

  // Global keyboard shortcut for double shift (file finder)
  useEffect(() => {
    let lastShiftTime = 0;
    const DOUBLE_SHIFT_THRESHOLD = 300; // ms

    const handleKeyDown = (e: KeyboardEvent) => {
      // Double Shift: Open file finder
      if (e.key === "Shift") {
        const now = Date.now();
        if (now - lastShiftTime < DOUBLE_SHIFT_THRESHOLD) {
          e.preventDefault();
          setFileFinderOpen(true);
          lastShiftTime = 0; // Reset to prevent triple shift
        } else {
          lastShiftTime = now;
        }
        return;
      }

      // Escape: Close modals
      if (e.key === "Escape") {
        if (settingsOpen) {
          e.preventDefault();
          setSettingsOpen(false);
        } else if (commandPaletteOpen) {
          e.preventDefault();
          setCommandPaletteOpen(false);
        } else if (fileFinderOpen) {
          e.preventDefault();
          setFileFinderOpen(false);
        } else if (projectSwitchOpen) {
          e.preventDefault();
          setProjectSwitchOpen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [settingsOpen, commandPaletteOpen, fileFinderOpen, projectSwitchOpen]);

  // Listen for menu events from Rust backend
  useEffect(() => {
    const unlisten = listen("open-settings", () => {
      setSettingsOpen(true);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Handle editor resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingEditor) return;
      const newWidth = window.innerWidth - e.clientX;
      setEditorWidth(Math.max(300, Math.min(1200, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizingEditor(false);
    };

    if (isResizingEditor) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingEditor]);

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", backgroundColor: "var(--ui-background)" }}>
      <TabBar />
      <div style={{ flex: 1, display: "flex", position: "relative", overflow: "hidden" }}>
        {/* Sidebar */}
        {sidebarVisible && <Sidebar onOpenFileFinder={() => setFileFinderOpen(true)} />}

        {/* Terminal Area */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden", backgroundColor: "var(--ui-background)" }}>
          {sessions.map((session) => (
            session.isActive && <SplitContainer key={session.id} tabId={session.id} />
          ))}
        </div>

        {/* File Editor Panel */}
        {fileTabs.length > 0 && (
          <div
            style={{
              width: `${editorWidth}px`,
              minWidth: "300px",
              maxWidth: "1200px",
              borderLeft: "1px solid var(--ui-border)",
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            {/* Resize Handle */}
            <div
              onMouseDown={() => setIsResizingEditor(true)}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: "4px",
                cursor: "col-resize",
                backgroundColor: isResizingEditor ? "rgba(59, 130, 246, 0.5)" : "transparent",
                zIndex: 10,
              }}
              className="hover:bg-blue-500/50 transition-colors"
            />
            <FileEditorPanel />
          </div>
        )}
      </div>

      {/* Status Bar */}
      {fileTabs.length > 0 && <StatusBar />}

      {/* Toast Notifications */}
      <Toaster position="bottom-right" theme="dark" />

      {/* Lazy-loaded overlays */}
      <Suspense fallback={null}>
        {/* Settings Panel */}
        {settingsOpen && <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />}

        {/* Quick Project Switch */}
        {projectSwitchOpen && <QuickProjectSwitch isOpen={projectSwitchOpen} onClose={() => setProjectSwitchOpen(false)} />}

        {/* Fuzzy File Finder */}
        {fileFinderOpen && <FuzzyFileFinder isOpen={fileFinderOpen} onClose={() => setFileFinderOpen(false)} />}

        {/* Command Palette */}
        {commandPaletteOpen && <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />}
      </Suspense>
    </div>
  );
}

export default App;
