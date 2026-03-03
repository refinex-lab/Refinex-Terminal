// SPDX-License-Identifier: MIT
// Copyright (c) 2026 refinex-lab

/**
 * TabBar — horizontal tab strip for Refinex Terminal.
 *
 * Features:
 *  - Click tab → activate
 *  - Double-click tab title → inline rename (blur or Enter to confirm, Escape to cancel)
 *  - `×` button → close tab
 *  - `+` button → add tab
 *
 * Keyboard shortcuts (Cmd/Ctrl) are wired in the parent `App` component so
 * they remain active even when the tab bar is not focused.
 */

import {
  useRef,
  useState,
  useCallback,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import type { Tab } from "../hooks/useTabs";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TabBarProps {
  tabs: Tab[];
  activeId: string | null;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, title: string) => void;
}

// ---------------------------------------------------------------------------
// Internal: single tab item
// ---------------------------------------------------------------------------

interface TabItemProps {
  tab: Tab;
  isActive: boolean;
  onActivate: () => void;
  onClose: (e: MouseEvent<HTMLButtonElement>) => void;
  onRename: (title: string) => void;
}

function TabItem({ tab, isActive, onActivate, onClose, onRename }: TabItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tab.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback(() => {
    setDraft(tab.title);
    setEditing(true);
    // Focus the input on the next tick after it renders.
    setTimeout(() => inputRef.current?.select(), 0);
  }, [tab.title]);

  const commitEdit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed) onRename(trimmed);
    setEditing(false);
  }, [draft, onRename]);

  const cancelEdit = useCallback(() => {
    setDraft(tab.title);
    setEditing(false);
  }, [tab.title]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitEdit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      }
    },
    [commitEdit, cancelEdit]
  );

  return (
    <div
      className={`tab-item${isActive ? " tab-item--active" : ""}`}
      onClick={onActivate}
      role="tab"
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
    >
      {editing ? (
        <input
          ref={inputRef}
          className="tab-item__rename-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          // Prevent click-through to the tab activate handler.
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className="tab-item__title"
          onDoubleClick={(e) => {
            e.stopPropagation();
            startEdit();
          }}
          title={tab.title}
        >
          {tab.title}
        </span>
      )}

      <button
        className="tab-item__close"
        aria-label={`Close ${tab.title}`}
        onClick={onClose}
        tabIndex={-1}
      >
        ×
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TabBar
// ---------------------------------------------------------------------------

export function TabBar({
  tabs,
  activeId,
  onActivate,
  onClose,
  onAdd,
  onRename,
}: TabBarProps) {
  return (
    <div className="tab-bar" role="tablist" aria-label="Terminal tabs">
      <div className="tab-bar__tabs">
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeId}
            onActivate={() => onActivate(tab.id)}
            onClose={(e) => {
              e.stopPropagation();
              onClose(tab.id);
            }}
            onRename={(title) => onRename(tab.id, title)}
          />
        ))}
      </div>

      <button
        className="tab-bar__add"
        aria-label="New tab"
        onClick={onAdd}
        title="New tab (⌘T)"
      >
        +
      </button>
    </div>
  );
}

export default TabBar;
