// SPDX-License-Identifier: MIT
// Copyright (c) 2026 refinex-lab

/**
 * useTabs — state management for terminal tab sessions.
 *
 * Each tab now carries:
 *  - `id` / `title`     — identity & display name
 *  - `tree: PaneNode`   — the pane-split tree for this tab
 *  - `focusedPaneId`    — which leaf currently has keyboard focus
 *
 * All TerminalPane instances remain mounted for the lifetime of their tab so
 * the underlying PTY sessions are preserved across tab switches.  Inactive
 * tabs are hidden via CSS (`display: none`) rather than unmounted.
 */

import { useCallback, useReducer } from "react";
import {
  makeLeaf,
  splitLeaf,
  removeLeaf,
  updateRatio,
  neighborLeaf,
  firstLeafId,
  type PaneNode,
  type SplitDir,
} from "../types/paneTree";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Tab {
  /** Stable unique identifier — also used as React key. */
  id: string;
  /** Human-readable label shown in the tab bar. */
  title: string;
  /** Root of the split-pane tree for this tab. */
  tree: PaneNode;
  /** Which leaf pane currently holds keyboard focus. */
  focusedPaneId: string;
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
  | { type: "RENAME"; id: string; title: string }
  | { type: "SPLIT_PANE"; tabId: string; dir: SplitDir }
  | { type: "CLOSE_PANE"; tabId: string; paneId: string }
  | { type: "FOCUS_PANE"; tabId: string; paneId: string }
  | { type: "RESIZE_SPLIT"; tabId: string; splitId: string; ratio: number }
  | { type: "NAV_PANE"; tabId: string; dir: "left" | "right" | "up" | "down" };

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
  const leaf = makeLeaf();
  return {
    id: uid(),
    title: `Shell ${counter}`,
    tree: leaf,
    focusedPaneId: leaf.id,
  };
}

/** Apply an update function only to the tab with the given id. */
function updateTab(tabs: Tab[], tabId: string, fn: (tab: Tab) => Tab): Tab[] {
  return tabs.map((t) => (t.id === tabId ? fn(t) : t));
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function reducer(state: TabsState, action: TabsAction): TabsState {
  switch (action.type) {
    // ---- Tab-level actions ------------------------------------------------

    case "ADD": {
      const counter = state.counter + 1;
      const tab = makeTab(counter);
      return { tabs: [...state.tabs, tab], activeId: tab.id, counter };
    }

    case "CLOSE": {
      const { id } = action;
      const idx = state.tabs.findIndex((t) => t.id === id);
      if (idx === -1) return state;

      const nextTabs = state.tabs.filter((t) => t.id !== id);
      let nextActiveId = state.activeId;
      if (state.activeId === id) {
        nextActiveId =
          nextTabs.length === 0
            ? null
            : (nextTabs[Math.min(idx, nextTabs.length - 1)]?.id ?? null);
      }

      return { ...state, tabs: nextTabs, activeId: nextActiveId };
    }

    case "ACTIVATE":
      return state.activeId === action.id
        ? state
        : { ...state, activeId: action.id };

    case "RENAME": {
      const trimmed = action.title.trim();
      if (!trimmed) return state;
      return {
        ...state,
        tabs: updateTab(state.tabs, action.id, (t) => ({
          ...t,
          title: trimmed,
        })),
      };
    }

    // ---- Pane-tree actions (scoped to one tab) ----------------------------

    case "SPLIT_PANE": {
      return {
        ...state,
        tabs: updateTab(state.tabs, action.tabId, (tab) => {
          const result = splitLeaf(tab.tree, tab.focusedPaneId, action.dir);
          if (result === null) return tab;
          return {
            ...tab,
            tree: result.tree,
            focusedPaneId: result.newLeafId,
          };
        }),
      };
    }

    case "CLOSE_PANE": {
      return {
        ...state,
        tabs: updateTab(state.tabs, action.tabId, (tab) => {
          const result = removeLeaf(tab.tree, action.paneId);
          if (result === null) return tab; // sole pane — caller closes the tab
          return {
            ...tab,
            tree: result.tree,
            focusedPaneId:
              tab.focusedPaneId === action.paneId
                ? result.focusId
                : tab.focusedPaneId,
          };
        }),
      };
    }

    case "FOCUS_PANE":
      return {
        ...state,
        tabs: updateTab(state.tabs, action.tabId, (tab) => ({
          ...tab,
          focusedPaneId: action.paneId,
        })),
      };

    case "RESIZE_SPLIT":
      return {
        ...state,
        tabs: updateTab(state.tabs, action.tabId, (tab) => ({
          ...tab,
          tree: updateRatio(tab.tree, action.splitId, action.ratio),
        })),
      };

    case "NAV_PANE": {
      return {
        ...state,
        tabs: updateTab(state.tabs, action.tabId, (tab) => {
          const neighbor = neighborLeaf(
            tab.tree,
            tab.focusedPaneId,
            action.dir
          );
          return neighbor !== null ? { ...tab, focusedPaneId: neighbor } : tab;
        }),
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
  splitPane: (tabId: string, dir: SplitDir) => void;
  closePane: (tabId: string, paneId: string) => void;
  focusPane: (tabId: string, paneId: string) => void;
  resizeSplit: (tabId: string, splitId: string, ratio: number) => void;
  navPane: (tabId: string, dir: "left" | "right" | "up" | "down") => void;
  /** focusedPaneId of the currently active tab, or null. */
  activeFocusedPaneId: string | null;
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
  const splitPane = useCallback(
    (tabId: string, dir: SplitDir) => dispatch({ type: "SPLIT_PANE", tabId, dir }),
    []
  );
  const closePane = useCallback(
    (tabId: string, paneId: string) => {
      // If this is the only leaf in the tab, close the whole tab.
      const tab = state.tabs.find((t) => t.id === tabId);
      if (tab?.tree.kind === "leaf") {
        dispatch({ type: "CLOSE", id: tabId });
      } else {
        dispatch({ type: "CLOSE_PANE", tabId, paneId });
      }
    },
    [state.tabs]
  );
  const focusPane = useCallback(
    (tabId: string, paneId: string) =>
      dispatch({ type: "FOCUS_PANE", tabId, paneId }),
    []
  );
  const resizeSplit = useCallback(
    (tabId: string, splitId: string, ratio: number) =>
      dispatch({ type: "RESIZE_SPLIT", tabId, splitId, ratio }),
    []
  );
  const navPane = useCallback(
    (tabId: string, dir: "left" | "right" | "up" | "down") =>
      dispatch({ type: "NAV_PANE", tabId, dir }),
    []
  );

  const activeTab = state.tabs.find((t) => t.id === state.activeId) ?? null;

  return {
    tabs: state.tabs,
    activeId: state.activeId,
    addTab,
    closeTab,
    activateTab,
    renameTab,
    splitPane,
    closePane,
    focusPane,
    resizeSplit,
    navPane,
    activeFocusedPaneId: activeTab?.focusedPaneId ?? null,
  };
}

// Re-export so callers (SplitPane.tsx) don't need to import paneTree directly.
export { firstLeafId };
