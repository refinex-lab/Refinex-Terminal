// SPDX-License-Identifier: MIT
// Copyright (c) 2026 refinex-lab

/**
 * Root application component for Refinex Terminal.
 *
 * Layout:
 *   ┌──────────────────────────────────────┐
 *   │  TabBar  (Cmd+T / Cmd+W / Cmd+1-9)  │
 *   ├──────────────────────────────────────┤
 *   │  SplitPane (one per tab,             │
 *   │  all mounted — inactive = hidden)    │
 *   └──────────────────────────────────────┘
 *
 * Keyboard shortcuts:
 *   Cmd+T              → new tab
 *   Cmd+W              → close active tab
 *   Cmd+D              → split focused pane horizontally (left/right)
 *   Cmd+Shift+D        → split focused pane vertically (top/bottom)
 *   Cmd+Shift+W        → close focused pane (or tab if sole pane)
 *   Cmd+Alt+Arrow      → navigate focus between panes
 *   Cmd+1…9            → switch to tab by position
 */

import { useEffect } from "react";
import "./App.css";
import { TabBar } from "./components/TabBar";
import SplitPane from "./components/SplitPane";
import { useTabs } from "./hooks/useTabs";

function App() {
  const {
    tabs,
    activeId,
    addTab,
    closeTab,
    activateTab,
    renameTab,
    splitPane,
    closePane,
    focusPane,
    resizeSplit,
    navPane,
    activeFocusedPaneId,
  } = useTabs();

  // ---------------------------------------------------------------------------
  // Global keyboard shortcuts
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      // Cmd/Ctrl+T — new tab
      if (!e.shiftKey && !e.altKey && (e.key === "t" || e.key === "T")) {
        e.preventDefault();
        addTab();
        return;
      }

      // Cmd/Ctrl+W — close active tab
      if (!e.shiftKey && !e.altKey && (e.key === "w" || e.key === "W")) {
        e.preventDefault();
        if (activeId !== null) closeTab(activeId);
        return;
      }

      // Cmd/Ctrl+D — split focused pane horizontally (creates left/right halves)
      if (!e.shiftKey && !e.altKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        if (activeId !== null) splitPane(activeId, "h");
        return;
      }

      // Cmd/Ctrl+Shift+D — split focused pane vertically (creates top/bottom halves)
      if (e.shiftKey && !e.altKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        if (activeId !== null) splitPane(activeId, "v");
        return;
      }

      // Cmd/Ctrl+Shift+W — close focused pane (or close tab if sole pane)
      if (e.shiftKey && !e.altKey && (e.key === "w" || e.key === "W")) {
        e.preventDefault();
        if (activeId !== null && activeFocusedPaneId !== null) {
          closePane(activeId, activeFocusedPaneId);
        }
        return;
      }

      // Cmd/Ctrl+Alt+Arrow — navigate focus between panes
      if (e.altKey && !e.shiftKey) {
        const dirMap: Record<string, "left" | "right" | "up" | "down"> = {
          ArrowLeft: "left",
          ArrowRight: "right",
          ArrowUp: "up",
          ArrowDown: "down",
        };
        const dir = dirMap[e.key];
        if (dir !== undefined && activeId !== null) {
          e.preventDefault();
          navPane(activeId, dir);
          return;
        }
      }

      // Cmd/Ctrl+1…9 — switch to tab by position
      const digit = parseInt(e.key, 10);
      if (!e.shiftKey && !e.altKey && digit >= 1 && digit <= 9) {
        e.preventDefault();
        const tab = tabs[digit - 1];
        if (tab) activateTab(tab.id);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    activeId,
    activeFocusedPaneId,
    tabs,
    addTab,
    closeTab,
    activateTab,
    splitPane,
    closePane,
    navPane,
  ]);

  return (
    <div className="app">
      <TabBar
        tabs={tabs}
        activeId={activeId}
        onActivate={activateTab}
        onClose={closeTab}
        onAdd={addTab}
        onRename={renameTab}
      />

      <div className="tab-panes">
        {tabs.map((tab) => (
          // All panes stay mounted; only the active one is shown.
          <div
            key={tab.id}
            className="tab-pane"
            style={tab.id === activeId ? undefined : { display: "none" }}
            aria-hidden={tab.id !== activeId}
          >
            <SplitPane
              tree={tab.tree}
              focusedPaneId={tab.focusedPaneId}
              onFocus={(paneId) => focusPane(tab.id, paneId)}
              onClose={(paneId) => closePane(tab.id, paneId)}
              onResizeSplit={(splitId, ratio) =>
                resizeSplit(tab.id, splitId, ratio)
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
