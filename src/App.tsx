import { useEffect, useRef, useState } from "react";
import { TabBar } from "@/components/tabs/TabBar";
import { TerminalView } from "@/components/terminal/TerminalView";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { useTerminalStore } from "@/stores/terminal-store";
import { useConfigStore } from "@/stores/config-store";
import { useSidebarStore } from "@/stores/sidebar-store";
import { loadBuiltinTheme, applyTheme } from "@/lib/theme-engine";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

function App() {
  const { sessions, addSession } = useTerminalStore();
  const { isVisible: sidebarVisible } = useSidebarStore();
  const initializedRef = useRef(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
      </div>
      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default App;
