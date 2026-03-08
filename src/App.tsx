import {
  useEffect,
  useRef,
  useState,
  useCallback,
  lazy,
  Suspense,
} from "react";
import { Toaster, toast } from "sonner";
import { FaTerminal, FaCode } from "react-icons/fa";
import { PiTerminalFill } from "react-icons/pi";
import { ChevronDown, FolderOpen, Server } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { IDETerminalTab } from "@/components/tabs/IDETerminalTab";
import { TerminalView } from "@/components/terminal/TerminalViewSSH";
import { TabBar } from "@/components/tabs/TabBar";
import { SplitContainer } from "@/components/terminal/SplitContainer";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { FileEditorPanel } from "@/components/sidebar/FileEditorPanel";
import { StatusBar } from "@/components/editor/StatusBar";
import { GitGraphView } from "@/components/git/GitGraphView";
import { GitGraphViewPanel } from "@/components/git/GitGraphViewPanel";
import { HostSidebar } from "@/components/ssh/HostSidebar";
import { UpdateNotification } from "@/components/UpdateNotification";
import { useTerminalStore } from "@/stores/terminal-store";
import { useConfigStore } from "@/stores/config-store";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useFileEditorStore } from "@/stores/file-editor-store";
import { useLayoutStore } from "@/stores/layout-store";
import { loadBuiltinTheme, applyTheme } from "@/lib/theme-engine";
import { getKeybindingManager } from "@/lib/keybinding-manager";
import { useActionHandler } from "@/lib/keybinding-manager";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  setWindowOpacity,
  setWindowVibrancy,
  getWindowState,
  restoreWindowState,
  toggleFullscreen,
  setAlwaysOnTop,
} from "@/lib/tauri-window";
import "./App.css";
import "./styles/editor-selection-debug.css";
import "./styles/markdown-preview.css";
import "./styles/reduced-motion.css";

// Lazy load heavy components for faster startup
const SettingsPanel = lazy(() =>
  import("@/components/settings/SettingsPanel").then((m) => ({
    default: m.SettingsPanel,
  })),
);
const QuickProjectSwitch = lazy(() =>
  import("@/components/sidebar/QuickProjectSwitch").then((m) => ({
    default: m.QuickProjectSwitch,
  })),
);
const FuzzyFileFinder = lazy(() =>
  import("@/components/sidebar/FuzzyFileFinder").then((m) => ({
    default: m.FuzzyFileFinder,
  })),
);
const CommandPalette = lazy(() =>
  import("@/components/command-palette/CommandPalette").then((m) => ({
    default: m.CommandPalette,
  })),
);
const GlobalSearch = lazy(() =>
  import("@/components/sidebar/GlobalSearch").then((m) => ({
    default: m.GlobalSearch,
  })),
);

function App() {
  const { sessions, addSession, activeSessionId } = useTerminalStore();
  const { isVisible: sidebarVisible, toggleVisibility: toggleSidebar } =
    useSidebarStore();
  const { tabs: fileTabs } = useFileEditorStore();
  const { mode: layoutMode, setMode: setLayoutMode, bottomPanelType, toggleBottomPanel, bottomPanelHeight, setBottomPanelHeight } = useLayoutStore();
  const { loadHistory, projectHistory, addProject } = useSidebarStore();
  const initializedRef = useRef(false);
  const keybindingManagerRef = useRef<ReturnType<
    typeof getKeybindingManager
  > | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectSwitchOpen, setProjectSwitchOpen] = useState(false);
  const [fileFinderOpen, setFileFinderOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalSearchShowReplace, setGlobalSearchShowReplace] = useState(false);
  const [editorWidth, setEditorWidth] = useState(600);
  const [isResizingEditor, setIsResizingEditor] = useState(false);
  const [isResizingBottomPanel, setIsResizingBottomPanel] = useState(false);
  const [activeTerminalDragId, setActiveTerminalDragId] = useState<string | null>(null);
  const { config } = useConfigStore();

  // Initialize keybinding manager
  useEffect(() => {
    if (!keybindingManagerRef.current) {
      keybindingManagerRef.current = getKeybindingManager();
    }

    // Don't destroy on cleanup - keep the singleton alive
  }, []);

  // Register global action handlers
  useActionHandler(
    "settings.open",
    useCallback(() => {
      setSettingsOpen(true);
    }, []),
  );

  useActionHandler(
    "sidebar.toggle",
    useCallback(() => {
      toggleSidebar();
    }, [toggleSidebar]),
  );

  useActionHandler(
    "command_palette.open",
    useCallback(() => {
      setCommandPaletteOpen(true);
    }, []),
  );

  useActionHandler(
    "command_palette.open_files",
    useCallback(() => {
      setFileFinderOpen(true);
    }, []),
  );

  useActionHandler(
    "search.global",
    useCallback(() => {
      setGlobalSearchShowReplace(false);
      setGlobalSearchOpen(true);
    }, []),
  );

  useActionHandler(
    "search.global_replace",
    useCallback(() => {
      setGlobalSearchShowReplace(true);
      setGlobalSearchOpen(true);
    }, []),
  );

  // Register window actions
  useActionHandler(
    "window.toggle_fullscreen",
    useCallback(() => {
      toggleFullscreen().catch(console.error);
    }, []),
  );

  useActionHandler(
    "window.toggle_always_on_top",
    useCallback(() => {
      // Toggle state
      const currentState = localStorage.getItem("always-on-top") === "true";
      const newState = !currentState;
      localStorage.setItem("always-on-top", String(newState));
      setAlwaysOnTop(newState).catch(console.error);
    }, []),
  );

  // Register file actions
  useActionHandler(
    "file.open_folder",
    useCallback(async () => {
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
    }, []),
  );

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

  // Load project history on mount
  useEffect(() => {
    loadHistory();

    // Auto-open last project if available
    if (projectHistory.length > 0 && !useSidebarStore.getState().activeProject) {
      const lastProject = projectHistory[0];
      if (lastProject) {
        addProject(lastProject.path);
      }
    }
  }, []);

  // Load config from backend on mount
  useEffect(() => {
    invoke<any>("get_config")
      .then((loadedConfig) => {
        // Transform Rust config (snake_case) to TypeScript config (camelCase)
        const transformedConfig = {
          appearance: {
            theme: loadedConfig.appearance?.theme || "refinex-dark",
            fontFamily:
              loadedConfig.appearance?.font_family || "JetBrains Mono",
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
        // Show toast notification for config errors
        toast.error("Config file has errors", {
          description: "Using default configuration",
          duration: 5000,
        });
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

        invoke("set_title_bar_theme", {
          theme: isDark ? "dark" : "light",
        }).catch(console.error);
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

  // Handle bottom panel resize (IDE mode)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingBottomPanel) return;
      const newHeight = window.innerHeight - e.clientY;
      setBottomPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizingBottomPanel(false);
    };

    if (isResizingBottomPanel) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingBottomPanel, setBottomPanelHeight]);

  // Drag and drop sensors for IDE terminal tabs
  const terminalTabSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleTerminalDragStart = (event: DragStartEvent) => {
    setActiveTerminalDragId(event.active.id as string);
  };

  const handleTerminalDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const { sessions, reorderSessions } = useTerminalStore.getState();
      const sessionIds = sessions.filter(s => !s.isPane).map(s => s.id);
      const oldIndex = sessionIds.indexOf(active.id as string);
      const newIndex = sessionIds.indexOf(over.id as string);

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderSessions(oldIndex, newIndex);
      }
    }

    setActiveTerminalDragId(null);
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--ui-background)",
      }}
    >
      {/* Draggable title bar area for macOS */}
      <div
        onMouseDown={async (e) => {
          // Only trigger drag on left mouse button
          if (e.button === 0) {
            const { getCurrentWindow } = await import("@tauri-apps/api/window");
            await getCurrentWindow().startDragging();
          }
        }}
        style={{
          height: "40px",
          backgroundColor: "var(--ui-background)",
          borderBottom: "1px solid var(--ui-border)",
          flexShrink: 0,
          cursor: "default",
          userSelect: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingLeft: "80px", // Space for macOS traffic lights
          paddingRight: "12px",
          gap: "8px",
        }}
      >
        {/* Terminal toggle button (only in IDE mode) */}
        {layoutMode === "ide" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleBottomPanel("terminal");
            }}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            style={{ color: "var(--ui-foreground)" }}
            title={bottomPanelType === "terminal" ? "Hide Terminal" : "Show Terminal"}
          >
            <PiTerminalFill className="size-4" />
          </button>
        )}

        {/* Layout Mode Toggle (Pill Button) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "2px",
            backgroundColor: "rgba(0, 0, 0, 0.3)",
            borderRadius: "12px",
            padding: "3px",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLayoutMode("terminal");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "3px 14px",
              borderRadius: "9px",
              backgroundColor: layoutMode === "terminal" ? "rgba(255, 255, 255, 0.15)" : "transparent",
              color: layoutMode === "terminal" ? "#ffffff" : "rgba(255, 255, 255, 0.45)",
              border: "none",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: layoutMode === "terminal" ? 600 : 400,
              transition: "all 0.2s",
              boxShadow: layoutMode === "terminal" ? "0 1px 2px rgba(0, 0, 0, 0.2)" : "none",
            }}
            title="Terminal Mode"
          >
            <FaTerminal className="size-3" />
            Terminal
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLayoutMode("ide");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "3px 14px",
              borderRadius: "9px",
              backgroundColor: layoutMode === "ide" ? "rgba(255, 255, 255, 0.15)" : "transparent",
              color: layoutMode === "ide" ? "#ffffff" : "rgba(255, 255, 255, 0.45)",
              border: "none",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: layoutMode === "ide" ? 600 : 400,
              transition: "all 0.2s",
              boxShadow: layoutMode === "ide" ? "0 1px 2px rgba(0, 0, 0, 0.2)" : "none",
            }}
            title="IDE Mode"
          >
            <FaCode className="size-3" />
            IDE
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLayoutMode("ssh");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "3px 14px",
              borderRadius: "9px",
              backgroundColor: layoutMode === "ssh" ? "rgba(255, 255, 255, 0.15)" : "transparent",
              color: layoutMode === "ssh" ? "#ffffff" : "rgba(255, 255, 255, 0.45)",
              border: "none",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: layoutMode === "ssh" ? 600 : 400,
              transition: "all 0.2s",
              boxShadow: layoutMode === "ssh" ? "0 1px 2px rgba(0, 0, 0, 0.2)" : "none",
            }}
            title="SSH Mode"
          >
            <Server className="size-3" />
            SSH
          </button>
        </div>
      </div>
      {/* Tab Bar - only show in Terminal mode */}
      {layoutMode === "terminal" && <TabBar />}

      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Sidebar - only show in Terminal and IDE modes */}
        {sidebarVisible && layoutMode !== "ssh" && (
          <Sidebar onOpenFileFinder={() => setFileFinderOpen(true)} />
        )}

        {/* Terminal Mode Layout */}
        {layoutMode === "terminal" && (
          <>
            {/* Terminal Area */}
            <div
              style={{
                flex: 1,
                position: "relative",
                overflow: "hidden",
                backgroundColor: "var(--ui-background)",
              }}
            >
              {sessions.map(
                (session) =>
                  session.isActive && (
                    <SplitContainer key={session.id} tabId={session.id} />
                  ),
              )}
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
                    backgroundColor: isResizingEditor
                      ? "rgba(59, 130, 246, 0.5)"
                      : "transparent",
                    zIndex: 10,
                  }}
                  className="hover:bg-blue-500/50 transition-colors"
                />
                <FileEditorPanel />
              </div>
            )}
          </>
        )}

        {/* IDE Mode Layout */}
        {layoutMode === "ide" && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* File Editor Area (full width) */}
            <div
              style={{
                flex: bottomPanelType ? `1 1 calc(100% - ${bottomPanelHeight}px)` : "1 1 100%",
                position: "relative",
                overflow: "hidden",
                backgroundColor: "var(--ui-background)",
              }}
            >
              {fileTabs.length > 0 ? (
                <FileEditorPanel />
              ) : sidebarVisible && useSidebarStore.getState().activeProject ? (
                // Project opened but no file selected - show shortcuts
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    gap: "32px",
                    padding: "40px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        color: "var(--ui-foreground)",
                        fontSize: "20px",
                        fontWeight: 600,
                      }}
                    >
                      {useSidebarStore.getState().activeProject?.name}
                    </div>
                    <div
                      style={{
                        color: "var(--ui-muted-foreground)",
                        fontSize: "14px",
                        opacity: 0.7,
                      }}
                    >
                      Select a file from the sidebar to start editing
                    </div>
        </div>

                  {/* Keyboard Shortcuts */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "16px",
                      width: "100%",
                      maxWidth: "500px",
                    }}
                  >
                    <div
                      style={{
                        color: "var(--ui-foreground)",
                        fontSize: "14px",
                        fontWeight: 600,
                        marginBottom: "4px",
                      }}
                    >
                      Keyboard Shortcuts
                    </div>

                    {[
                      { keys: ["⇧", "⇧"], description: "Quick file search" },
                      { keys: ["⌘", "P"], description: "Command palette" },
                      { keys: ["⌘", "B"], description: "Toggle sidebar" },
                      { keys: ["⌘", "⇧", "P"], description: "Global commands" },
                      { keys: ["⌘", ","], description: "Settings" },
                      { keys: ["⌘", "T"], description: "New terminal" },
                    ].map((shortcut, index) => (
                      <div
                        key={index}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "12px 16px",
                          backgroundColor: "rgba(255, 255, 255, 0.03)",
                          borderRadius: "6px",
                          border: "1px solid rgba(255, 255, 255, 0.05)",
                        }}
                      >
                        <div
                          style={{
                            color: "var(--ui-muted-foreground)",
                            fontSize: "13px",
                          }}
                        >
                          {shortcut.description}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "4px",
                          }}
                        >
                          {shortcut.keys.map((key, keyIndex) => (
                            <span
                              key={keyIndex}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                minWidth: "24px",
                                height: "24px",
                                padding: "0 8px",
                                backgroundColor: "rgba(255, 255, 255, 0.08)",
                                border: "1px solid rgba(255, 255, 255, 0.1)",
                                borderRadius: "4px",
                                color: "var(--ui-foreground)",
                                fontSize: "12px",
                                fontWeight: 500,
                                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
                              }}
                            >
                              {key}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                // No project opened - show open folder prompt
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    gap: "32px",
                    padding: "40px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <FolderOpen
                      style={{
                        width: "64px",
                        height: "64px",
                        color: "var(--ui-muted-foreground)",
                        opacity: 0.5,
                      }}
                    />
                    <div
                      style={{
                        color: "var(--ui-muted-foreground)",
                        fontSize: "16px",
                        fontWeight: 500,
                      }}
                    >
                      No project opened
                    </div>
                    <div
                      style={{
                        color: "var(--ui-muted-foreground)",
                        fontSize: "14px",
                        opacity: 0.7,
                        textAlign: "center",
                        maxWidth: "400px",
                      }}
                    >
                      Open a folder to start editing files, or switch to Terminal mode to use the terminal.
                    </div>
                  </div>

                  <button
                    onClick={async () => {
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
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.filter = "brightness(1.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.filter = "brightness(1)";
                    }}
                    onMouseDown={(e) => {
                      e.currentTarget.style.transform = "scale(0.95)";
                    }}
                    onMouseUp={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                    style={{
                      backgroundColor: "var(--ui-accent)",
                      color: "var(--ui-accent-foreground)",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: 500,
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 16px",
                      borderRadius: "6px",
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <FolderOpen className="size-4" />
                    Open Folder
                  </button>

                  {/* Recent Projects */}
                  {projectHistory.length > 0 && (
                    <div
                      style={{
                        width: "100%",
                        maxWidth: "500px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                      }}
                    >
                      <div
                        style={{
                          color: "var(--ui-foreground)",
                          fontSize: "14px",
                          fontWeight: 600,
                          paddingLeft: "4px",
                        }}
                      >
                        Recent Projects
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                        }}
                      >
                        {projectHistory.slice(0, 5).map((project, index) => (
                          <button
                            key={index}
                            onClick={() => addProject(project.path)}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.03)";
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              padding: "12px 16px",
                              backgroundColor: "rgba(255, 255, 255, 0.03)",
                              border: "1px solid rgba(255, 255, 255, 0.05)",
                              borderRadius: "6px",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                              textAlign: "left",
                            }}
                          >
                            <FolderOpen
                              className="size-4 flex-shrink-0"
                              style={{ color: "var(--ui-accent)", opacity: 0.8 }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  color: "var(--ui-foreground)",
                                  fontSize: "13px",
                                  fontWeight: 500,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {project.name}
                              </div>
                              <div
                                style={{
                                  color: "var(--ui-muted-foreground)",
                                  fontSize: "11px",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  marginTop: "2px",
                                }}
                              >
                                {project.path}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Panel (Terminal or Git Graph) */}
            {bottomPanelType && (
              <div
                style={{
                  height: `${bottomPanelHeight}px`,
                  minHeight: "200px",
                  maxHeight: "600px",
                  borderTop: "1px solid var(--ui-border)",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                  backgroundColor: "var(--ui-background)",
                }}
              >
                {/* Resize Handle */}
                <div
                  onMouseDown={() => setIsResizingBottomPanel(true)}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "4px",
                    cursor: "row-resize",
                    backgroundColor: isResizingBottomPanel
                      ? "rgba(59, 130, 246, 0.5)"
                      : "transparent",
                    zIndex: 10,
                  }}
                  className="hover:bg-blue-500/50 transition-colors"
                />

                {/* Panel Content */}
                {bottomPanelType === "terminal" && (
                  <>
                    {/* Terminal Tabs */}
                    <div
                      className="flex items-center gap-1 px-2 border-b"
                      style={{
                        backgroundColor: "var(--ui-background)",
                        borderColor: "var(--ui-border)",
                        paddingTop: "4px",
                        paddingBottom: "4px",
                        minHeight: "32px",
                      }}
                    >
                      <DndContext
                        sensors={terminalTabSensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleTerminalDragStart}
                        onDragEnd={handleTerminalDragEnd}
                      >
                        <div style={{ flex: 1, display: "flex", gap: "4px" }}>
                          <SortableContext
                            items={sessions.filter(s => !s.isPane).map(s => s.id)}
                            strategy={horizontalListSortingStrategy}
                          >
                            {sessions
                              .filter((s) => !s.isPane)
                              .map((session) => (
                                <IDETerminalTab
                                  key={session.id}
                                  session={session}
                                  isActive={session.id === activeSessionId}
                                  onSelect={() => useTerminalStore.getState().setActiveSession(session.id)}
                                  onClose={() => useTerminalStore.getState().removeSession(session.id)}
                                />
                              ))}
                          </SortableContext>
                        </div>

                        <DragOverlay>
                          {activeTerminalDragId && (() => {
                            const draggedSession = sessions.find(s => s.id === activeTerminalDragId);
                            return draggedSession ? (
                              <div
                                className="px-2 py-1 rounded text-xs font-medium cursor-grabbing opacity-80"
                                style={{
                                  backgroundColor: "rgba(255, 255, 255, 0.12)",
                                  color: "var(--ui-foreground)",
                                }}
                              >
                                {draggedSession.title}
                              </div>
                            ) : null;
                          })()}
                        </DragOverlay>
                      </DndContext>

                      <button
                        onClick={() => {
                          const { addSession } = useTerminalStore.getState();
                          const { activeProject } = useSidebarStore.getState();
                          const newSession = {
                            id: `terminal-${Date.now()}`,
                            title: `⌘ ${sessions.filter(s => !s.isPane).length + 1}`,
                            cwd: activeProject?.path || "~",
                            ptyId: null,
                          };
                          addSession(newSession);
                        }}
                        className="p-1 rounded hover:bg-white/10 transition-colors"
                        style={{ color: "var(--ui-foreground)", flexShrink: 0, fontSize: "14px" }}
                        title="New Terminal"
                      >
                        +
                      </button>
                      <button
                        onClick={() => toggleBottomPanel()}
                        className="p-1 rounded hover:bg-white/10 transition-colors"
                        style={{ color: "var(--ui-foreground)", flexShrink: 0 }}
                        title="Hide Terminal"
                      >
                        <ChevronDown className="size-3" />
                      </button>
                    </div>

                    {/* Terminal Content */}
                    <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                      {sessions.map(
                        (session) =>
                          session.isActive && (
                            <SplitContainer key={session.id} tabId={session.id} />
                          ),
                      )}
                    </div>
                  </>
                )}

                {bottomPanelType === "git-graph" && (
                  <GitGraphViewPanel
                    repoPath={useSidebarStore.getState().activeProject?.path || ""}
                    currentBranch=""
                    onClose={() => toggleBottomPanel()}
                    onOpenDiff={(filePath, commitHash) => {
                      // Open diff in main editor area (same as Terminal mode)
                      const { openFile } = useFileEditorStore.getState();
                      const activeProject = useSidebarStore.getState().activeProject;

                      if (!activeProject) return;

                      openFile({
                        path: `git-commit-diff://${activeProject.path}/${commitHash}/${filePath}`,
                        name: `${filePath} @ ${commitHash.substring(0, 8)}`,
                        content: JSON.stringify({
                          type: "commit-diff",
                          filePath,
                          commitHash,
                          repoPath: activeProject.path,
                        }),
                        language: "diff",
                      });
                    }}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* SSH Mode Layout */}
        {layoutMode === "ssh" && (
          <div
            style={{
              flex: 1,
              display: "flex",
              position: "relative",
              overflow: "hidden",
              backgroundColor: "var(--ui-background)",
            }}
          >
            {/* SSH Hosts Sidebar (Left) */}
            <div
              style={{
                width: "280px",
                borderRight: "1px solid var(--ui-border)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <HostSidebar />
            </div>

            {/* Remote Terminal (Center) */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {activeSessionId && sessions.find(s => s.id === activeSessionId)?.mode === "ssh" ? (
                <TerminalView sessionId={activeSessionId} />
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    color: "var(--ui-muted-foreground)",
                    fontSize: "14px",
                    gap: "8px",
                  }}
                >
                  <div>Remote Terminal Area</div>
                  <div style={{ fontSize: "12px", opacity: 0.7 }}>
                    Double-click a host in the left panel to connect
                  </div>
                </div>
              )}
            </div>
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
        {settingsOpen && (
          <SettingsPanel
            isOpen={settingsOpen}
            onClose={() => setSettingsOpen(false)}
          />
        )}

        {/* Quick Project Switch */}
        {projectSwitchOpen && (
          <QuickProjectSwitch
            isOpen={projectSwitchOpen}
            onClose={() => setProjectSwitchOpen(false)}
          />
        )}

        {/* Fuzzy File Finder */}
        {fileFinderOpen && (
          <FuzzyFileFinder
            isOpen={fileFinderOpen}
            onClose={() => setFileFinderOpen(false)}
          />
        )}

        {/* Global Search */}
        {globalSearchOpen && (
          <GlobalSearch
            isOpen={globalSearchOpen}
            onClose={() => setGlobalSearchOpen(false)}
            showReplace={globalSearchShowReplace}
          />
        )}

        {/* Command Palette */}
        {commandPaletteOpen && (
          <CommandPalette
            open={commandPaletteOpen}
            onOpenChange={setCommandPaletteOpen}
          />
        )}
      </Suspense>

      {/* Update notification */}
      <UpdateNotification />

      {/* Toast notifications */}
      <Toaster position="top-right" />
    </div>
  );
}

export default App;
