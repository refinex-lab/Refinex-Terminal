// SPDX-License-Identifier: MIT
// Copyright (c) 2026 refinex-lab

/**
 * SplitPane — recursive renderer for the PaneNode tree.
 *
 * Structure:
 *   SplitPane (public)
 *     └─ PaneNodeView (internal dispatcher)
 *          ├─ LeafView   — wraps a single TerminalPane
 *          └─ SplitView  — two PaneNodeViews + a draggable PaneDivider
 */

import React, { useCallback, useRef } from "react";
import type { LeafNode, PaneNode, SplitNode } from "../types/paneTree";
import { TerminalPane } from "./TerminalPane";

// ---------------------------------------------------------------------------
// Prop types
// ---------------------------------------------------------------------------

interface SplitPaneProps {
  /** Root of the current tab's pane tree. */
  tree: PaneNode;
  /** Which leaf currently holds keyboard focus (for the focus ring). */
  focusedPaneId: string;
  /** Callback fired when a leaf requests focus (click). */
  onFocus: (paneId: string) => void;
  /** Callback fired when a leaf's close button is clicked or PTY exits. */
  onClose: (paneId: string) => void;
  /** Callback fired when a divider drag updates a split ratio. */
  onResizeSplit: (splitId: string, ratio: number) => void;
}

// ---------------------------------------------------------------------------
// Internal: Leaf
// ---------------------------------------------------------------------------

interface LeafViewProps {
  leaf: LeafNode;
  isFocused: boolean;
  onFocus: (id: string) => void;
  onClose: (id: string) => void;
}

function LeafView({ leaf, isFocused, onFocus, onClose }: LeafViewProps) {
  return (
    <div
      className={`pane-leaf${isFocused ? " pane-leaf--focused" : ""}`}
      onClick={() => onFocus(leaf.id)}
      style={{ position: "relative", flex: 1, overflow: "hidden", display: "flex" }}
    >
      <TerminalPane
        key={leaf.id}
        onExit={() => onClose(leaf.id)}
      />
      {/* Close button — only visible on hover via CSS */}
      <button
        className="pane-close-btn"
        title="Close pane"
        onClick={(e) => {
          e.stopPropagation();
          onClose(leaf.id);
        }}
        aria-label="Close pane"
      >
        ×
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal: Draggable divider
// ---------------------------------------------------------------------------

interface PaneDividerProps {
  /** "h" → vertical bar between columns; "v" → horizontal bar between rows */
  isH: boolean;
  onDragDelta: (delta: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function PaneDivider({ isH, onDragDelta, containerRef }: PaneDividerProps) {
  const startPos = useRef<number>(0);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      startPos.current = isH ? e.clientX : e.clientY;
    },
    [isH]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const current = isH ? e.clientX : e.clientY;
      const delta = current - startPos.current;
      startPos.current = current;

      const containerEl = containerRef.current;
      if (!containerEl) return;
      const size = isH ? containerEl.offsetWidth : containerEl.offsetHeight;
      if (size === 0) return;

      onDragDelta(delta / size);
    },
    [isH, onDragDelta, containerRef]
  );

  return (
    <div
      className={`pane-divider pane-divider--${isH ? "h" : "v"}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
    />
  );
}

// ---------------------------------------------------------------------------
// Internal: Split node
// ---------------------------------------------------------------------------

interface SplitViewProps {
  split: SplitNode;
  focusedPaneId: string;
  onFocus: (id: string) => void;
  onClose: (id: string) => void;
  onResizeSplit: (splitId: string, ratio: number) => void;
  currentRatio: number;
}

function SplitView({
  split,
  focusedPaneId,
  onFocus,
  onClose,
  onResizeSplit,
  currentRatio,
}: SplitViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isH = split.dir === "h";

  const handleDragDelta = useCallback(
    (delta: number) => {
      const newRatio = Math.min(0.9, Math.max(0.1, currentRatio + delta));
      onResizeSplit(split.id, newRatio);
    },
    [split.id, currentRatio, onResizeSplit]
  );

  const aPercent = `${currentRatio * 100}%`;
  const bPercent = `${(1 - currentRatio) * 100}%`;

  return (
    <div
      ref={containerRef}
      className={`pane-split pane-split--${isH ? "h" : "v"}`}
    >
      <div
        className="pane-split-child"
        style={isH ? { width: aPercent } : { height: aPercent }}
      >
        <PaneNodeView
          node={split.a}
          focusedPaneId={focusedPaneId}
          onFocus={onFocus}
          onClose={onClose}
          onResizeSplit={onResizeSplit}
        />
      </div>

      <PaneDivider
        isH={isH}
        onDragDelta={handleDragDelta}
        containerRef={containerRef}
      />

      <div
        className="pane-split-child"
        style={isH ? { width: bPercent } : { height: bPercent }}
      >
        <PaneNodeView
          node={split.b}
          focusedPaneId={focusedPaneId}
          onFocus={onFocus}
          onClose={onClose}
          onResizeSplit={onResizeSplit}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal: recursive dispatcher
// ---------------------------------------------------------------------------

interface PaneNodeViewProps {
  node: PaneNode;
  focusedPaneId: string;
  onFocus: (id: string) => void;
  onClose: (id: string) => void;
  onResizeSplit: (splitId: string, ratio: number) => void;
}

function PaneNodeView({
  node,
  focusedPaneId,
  onFocus,
  onClose,
  onResizeSplit,
}: PaneNodeViewProps) {
  if (node.kind === "leaf") {
    return (
      <LeafView
        leaf={node}
        isFocused={node.id === focusedPaneId}
        onFocus={onFocus}
        onClose={onClose}
      />
    );
  }

  return (
    <SplitView
      split={node}
      currentRatio={node.ratio}
      focusedPaneId={focusedPaneId}
      onFocus={onFocus}
      onClose={onClose}
      onResizeSplit={onResizeSplit}
    />
  );
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

export default function SplitPane({
  tree,
  focusedPaneId,
  onFocus,
  onClose,
  onResizeSplit,
}: SplitPaneProps) {
  return (
    <div className="split-pane-root" style={{ width: "100%", height: "100%", display: "flex" }}>
      <PaneNodeView
        node={tree}
        focusedPaneId={focusedPaneId}
        onFocus={onFocus}
        onClose={onClose}
        onResizeSplit={onResizeSplit}
      />
    </div>
  );
}
