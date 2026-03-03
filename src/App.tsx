// SPDX-License-Identifier: MIT
// Copyright (c) 2026 refinex-lab

/**
 * Root application component for Refinex Terminal.
 *
 * Layout:
 *   ┌──────────────────────────────────────┐
 *   │  TabBar  (Cmd+T / Cmd+W / Cmd+1-9)  │
 *   ├──────────────────────────────────────┤
 *   │  TerminalPane (one per tab,          │
 *   │  all mounted — inactive = hidden)    │
 *   └──────────────────────────────────────┘
 *
 * All TerminalPane instances stay mounted so their PTY sessions are
 * preserved across tab switches.  Only the active pane is visible.
 */

import { useEffect } from "react";
import "./App.css";
import { TabBar } from "./components/TabBar";
import { TerminalPane } from "./components/TerminalPane";
import { useTabs } from "./hooks/useTabs";

function App() {
  const { tabs, activeId, addTab, closeTab, activateTab, renameTab } =
    useTabs();

  // ---------------------------------------------------------------------------
  // Global keyboard shortcuts
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      // Cmd/Ctrl+T — new tab
      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        addTab();
        return;
      }

      // Cmd/Ctrl+W — close active tab
      if (e.key === "w" || e.key === "W") {
        e.preventDefault();
        if (activeId !== null) closeTab(activeId);
        return;
      }

      // Cmd/Ctrl+1…9 — switch to tab by position
      const digit = parseInt(e.key, 10);
      if (digit >= 1 && digit <= 9) {
        e.preventDefault();
        const tab = tabs[digit - 1];
        if (tab) activateTab(tab.id);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeId, tabs, addTab, closeTab, activateTab]);

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
          // The CSS `display: none` hides inactive panes entirely so they
          // do not consume layout space, but the underlying PTY sessions
          // continue running uninterrupted.
          <div
            key={tab.id}
            className="tab-pane"
            style={tab.id === activeId ? undefined : { display: "none" }}
            aria-hidden={tab.id !== activeId}
          >
            <TerminalPane
              onExit={() => closeTab(tab.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
