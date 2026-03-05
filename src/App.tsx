import { useEffect, useRef, useState } from "react";
import { TabBar } from "@/components/tabs/TabBar";
import { TerminalView } from "@/components/terminal/TerminalView";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { FileEditorPanel } from "@/components/sidebar/FileEditorPanel";
import { useTerminalStore } from "@/stores/terminal-store";
import { useConfigStore } from "@/stores/config-store";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useFileEditorStore } from "@/stores/file-editor-store";
import { loadBuiltinTheme, applyTheme } from "@/lib/theme-engine";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

function App() {
  const { sessions, addSession } = useTerminalStore();
  const { isVisible: sidebarVisible } = useSidebarStore();
  const { tabs: fileTabs } = useFileEditorStore();
  const initializedRef = useRef(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editorWidth, setEditorWidth] = useState(600);
  const [isResizingEditor, setIsResizingEditor] = useState(false);
  const { config } = useConfigStore();

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

  // Global keyboard shortcut for settings and sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl + ,: Open settings
      if (modifier && e.key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
      }

      // Cmd/Ctrl + B: Toggle sidebar
      if (modifier && e.key === "b") {
        e.preventDefault();
        useSidebarStore.getState().toggleVisibility();
      }

      // Escape: Close settings
      if (e.key === "Escape" && settingsOpen) {
        e.preventDefault();
        setSettingsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [settingsOpen]);

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
        {sidebarVisible && <Sidebar />}

        {/* Terminal Area */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {sessions.map((session) => (
            <TerminalView key={session.id} sessionId={session.id} />
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
      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default App;
