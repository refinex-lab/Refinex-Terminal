// SPDX-License-Identifier: MIT
// Copyright (c) 2026 refinex-lab

/**
 * useTabs — state management for terminal tab sessions.
 *
 * Each tab carries:
 *  - a stable `id` (used as React key for TerminalPane — never recycled)
 *  - a mutable `title` (default "Shell N", user-editable via double-click)
 *
 * All TerminalPane instances remain mounted for the lifetime of their tab so
 * the underlying PTY session is preserved across tab switches.  Inactive tabs
 * are hidden via CSS (`display: none`) rather than unmounted.
 */

import { useCallback, useReducer } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Tab {
  /** Stable unique identifier — used as React key and for PTY event routing. */
  id: string;
  /** Human-readable label shown in the tab bar. */
  title: string;
}

interface TabsState {
  tabs: Tab[];
  activeId: string | null;
  /** Monotonically increasing counter used to generate default titles. */
  counter: number;
}

type TabsAction =
  | { type: "ADD" }
  | { type: "CLOSE"; id: string }
  | { type: "ACTIVATE"; id: string }
  | { type: "RENAME"; id: string; title: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _uidSeed = 0;
/** Generate a stable, unique tab ID that is safe to use as a React key. */
function uid(): string {
  _uidSeed += 1;
  return `tab-${Date.now()}-${_uidSeed}`;
}

function makeTab(counter: number): Tab {
  return { id: uid(), title: `Shell ${counter}` };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function reducer(state: TabsState, action: TabsAction): TabsState {
  switch (action.type) {
    case "ADD": {
      const counter = state.counter + 1;
      const tab = makeTab(counter);
      return {
        tabs: [...state.tabs, tab],
        activeId: tab.id,
        counter,
      };
    }

    case "CLOSE": {
      const { id } = action;
      const idx = state.tabs.findIndex((t) => t.id === id);
      if (idx === -1) return state;

      const nextTabs = state.tabs.filter((t) => t.id !== id);

      // If we're closing the active tab, activate the nearest remaining tab.
      let nextActiveId = state.activeId;
      if (state.activeId === id) {
        if (nextTabs.length === 0) {
          nextActiveId = null;
        } else {
          // Prefer the tab to the left, fall back to the tab now at the same index.
          const newIdx = Math.min(idx, nextTabs.length - 1);
          nextActiveId = nextTabs[newIdx]?.id ?? null;
        }
      }

      return { ...state, tabs: nextTabs, activeId: nextActiveId };
    }

    case "ACTIVATE":
      if (state.activeId === action.id) return state;
      return { ...state, activeId: action.id };

    case "RENAME": {
      const trimmed = action.title.trim();
      if (!trimmed) return state; // ignore empty rename
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.id ? { ...t, title: trimmed } : t
        ),
      };
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Initial state — one tab open on mount
// ---------------------------------------------------------------------------

const INITIAL_TAB = makeTab(1);
const INITIAL_STATE: TabsState = {
  tabs: [INITIAL_TAB],
  activeId: INITIAL_TAB.id,
  counter: 1,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseTabsResult {
  tabs: Tab[];
  activeId: string | null;
  addTab: () => void;
  closeTab: (id: string) => void;
  activateTab: (id: string) => void;
  renameTab: (id: string, title: string) => void;
}

export function useTabs(): UseTabsResult {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  const addTab = useCallback(() => dispatch({ type: "ADD" }), []);
  const closeTab = useCallback(
    (id: string) => dispatch({ type: "CLOSE", id }),
    []
  );
  const activateTab = useCallback(
    (id: string) => dispatch({ type: "ACTIVATE", id }),
    []
  );
  const renameTab = useCallback(
    (id: string, title: string) => dispatch({ type: "RENAME", id, title }),
    []
  );

  return {
    tabs: state.tabs,
    activeId: state.activeId,
    addTab,
    closeTab,
    activateTab,
    renameTab,
  };
}
