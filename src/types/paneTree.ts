// SPDX-License-Identifier: MIT
// Copyright (c) 2026 refinex-lab

/**
 * PaneTree — immutable tree data structure for terminal split-pane layouts.
 *
 * Each node is either:
 *   - a `leaf`  — a single terminal pane identified by a stable `id`
 *   - a `split` — two child sub-trees arranged horizontally (side-by-side)
 *                 or vertically (top-bottom), separated by a draggable divider
 *
 * All operations return new tree values; no mutation in place.
 *
 * Reference: https://www.warp.dev/blog/using-tree-data-structures-to-implement-terminal-split-panes-more-fun-than-it-sounds
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Direction of a split node's layout. */
export type SplitDir =
  /** Left + right ("水平分屏", adds a vertical divider bar). */
  | "h"
  /** Top + bottom ("垂直分屏", adds a horizontal divider bar). */
  | "v";

/** A single leaf terminal pane. */
export interface LeafNode {
  kind: "leaf";
  /** Stable ID — used as React key for TerminalPane. Never re-used. */
  id: string;
}

/** A split container holding two child sub-trees. */
export interface SplitNode {
  kind: "split";
  /** Stable ID — used to target ratio updates. */
  id: string;
  dir: SplitDir;
  /** Fraction of total space given to `a` (first child). Range [0.1, 0.9]. */
  ratio: number;
  a: PaneNode;
  b: PaneNode;
}

export type PaneNode = LeafNode | SplitNode;

// ---------------------------------------------------------------------------
// ID generation (module-local monotonic counter)
// ---------------------------------------------------------------------------

let _seed = 0;
function nextId(prefix: string): string {
  _seed += 1;
  return `${prefix}-${Date.now()}-${_seed}`;
}

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

/** Create a new leaf node with a fresh stable ID. */
export function makeLeaf(): LeafNode {
  return { kind: "leaf", id: nextId("pane") };
}

/** Create a horizontal or vertical split from two existing nodes. */
function makeSplit(dir: SplitDir, a: PaneNode, b: PaneNode): SplitNode {
  return { kind: "split", id: nextId("split"), dir, ratio: 0.5, a, b };
}

// ---------------------------------------------------------------------------
// Tree queries
// ---------------------------------------------------------------------------

/** Collect every leaf ID in left-to-right, top-to-bottom order. */
export function allLeafIds(tree: PaneNode): string[] {
  if (tree.kind === "leaf") return [tree.id];
  return [...allLeafIds(tree.a), ...allLeafIds(tree.b)];
}

/** Return the leftmost-topmost leaf ID. */
export function firstLeafId(tree: PaneNode): string {
  if (tree.kind === "leaf") return tree.id;
  return firstLeafId(tree.a);
}

/** Return the rightmost-bottommost leaf ID. */
export function lastLeafId(tree: PaneNode): string {
  if (tree.kind === "leaf") return tree.id;
  return lastLeafId(tree.b);
}

// ---------------------------------------------------------------------------
// Path (used for navigation and structural queries)
// ---------------------------------------------------------------------------

/** One step along the path from root to a target leaf. */
interface PathStep {
  split: SplitNode;
  /** Which branch of `split` contains the target. */
  branch: "a" | "b";
}

/** Returns the path from root to the leaf with `targetId`, or null if not found. */
function pathTo(tree: PaneNode, targetId: string, acc: PathStep[] = []): PathStep[] | null {
  if (tree.kind === "leaf") {
    return tree.id === targetId ? acc : null;
  }
  return (
    pathTo(tree.a, targetId, [...acc, { split: tree, branch: "a" }]) ??
    pathTo(tree.b, targetId, [...acc, { split: tree, branch: "b" }])
  );
}

// ---------------------------------------------------------------------------
// Structural operations (return new tree)
// ---------------------------------------------------------------------------

/**
 * Split the leaf identified by `targetId` into two leaves.
 *
 * The original leaf becomes `a`; the new leaf (returned via `newLeafId`) is `b`.
 * Returns `null` if `targetId` is not found.
 */
export function splitLeaf(
  tree: PaneNode,
  targetId: string,
  dir: SplitDir
): { tree: PaneNode; newLeafId: string } | null {
  if (tree.kind === "leaf") {
    if (tree.id !== targetId) return null;
    const newLeaf = makeLeaf();
    return { tree: makeSplit(dir, tree, newLeaf), newLeafId: newLeaf.id };
  }
  const resultA = splitLeaf(tree.a, targetId, dir);
  if (resultA !== null) return { tree: { ...tree, a: resultA.tree }, newLeafId: resultA.newLeafId };
  const resultB = splitLeaf(tree.b, targetId, dir);
  if (resultB !== null) return { tree: { ...tree, b: resultB.tree }, newLeafId: resultB.newLeafId };
  return null;
}

/**
 * Remove the leaf identified by `targetId`.
 *
 * Its sibling takes over the parent split's slot.  Cannot remove the sole
 * remaining leaf (returns `null`).
 *
 * Also returns the ID to focus after removal:
 *  - If the sibling is a split, focuses its first leaf.
 *  - Otherwise focuses the sibling leaf itself.
 */
export function removeLeaf(
  tree: PaneNode,
  targetId: string
): { tree: PaneNode; focusId: string } | null {
  // Sole leaf — cannot remove.
  if (tree.kind === "leaf") return null;

  // Direct child in position `a`
  if (tree.a.kind === "leaf" && tree.a.id === targetId) {
    return { tree: tree.b, focusId: firstLeafId(tree.b) };
  }
  // Direct child in position `b`
  if (tree.b.kind === "leaf" && tree.b.id === targetId) {
    return { tree: tree.a, focusId: lastLeafId(tree.a) };
  }

  const ra = removeLeaf(tree.a, targetId);
  if (ra !== null) return { tree: { ...tree, a: ra.tree }, focusId: ra.focusId };
  const rb = removeLeaf(tree.b, targetId);
  if (rb !== null) return { tree: { ...tree, b: rb.tree }, focusId: rb.focusId };
  return null;
}

/**
 * Update the `ratio` of the split node identified by `splitId`.
 * Clamps to [0.1, 0.9].
 */
export function updateRatio(tree: PaneNode, splitId: string, ratio: number): PaneNode {
  const clamped = Math.max(0.1, Math.min(0.9, ratio));
  if (tree.kind === "leaf") return tree;
  if (tree.id === splitId) return { ...tree, ratio: clamped };
  return {
    ...tree,
    a: updateRatio(tree.a, splitId, clamped),
    b: updateRatio(tree.b, splitId, clamped),
  };
}

// ---------------------------------------------------------------------------
// Keyboard navigation
// ---------------------------------------------------------------------------

/**
 * Find the neighboring leaf in the given direction.
 *
 * "left" / "right" navigate within horizontal splits;
 * "up"   / "down"  navigate within vertical splits.
 *
 * Returns `null` if there is no neighbor in that direction.
 */
export function neighborLeaf(
  tree: PaneNode,
  currentId: string,
  dir: "left" | "right" | "up" | "down"
): string | null {
  const path = pathTo(tree, currentId);
  if (path === null) return null;

  const splitDir: SplitDir = dir === "left" || dir === "right" ? "h" : "v";
  const goToB = dir === "right" || dir === "down"; // moving toward the "b" subtree

  // Walk up the path (innermost first) looking for a split in our axis where we
  // can step across to the other subtree.
  for (let i = path.length - 1; i >= 0; i--) {
    const step = path[i];
    if (step.split.dir !== splitDir) continue;

    if (goToB && step.branch === "a") {
      // We're in the `a` subtree; step into `b`.
      return firstLeafId(step.split.b);
    }
    if (!goToB && step.branch === "b") {
      // We're in the `b` subtree; step into `a`.
      return lastLeafId(step.split.a);
    }
    // We're already on the "far" side for this split; keep walking up.
  }
  return null;
}
