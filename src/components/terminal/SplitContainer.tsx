import { useState, useEffect, useRef, useCallback } from "react";
import { TerminalView } from "./TerminalView";
import { useTerminalStore } from "@/stores/terminal-store";
import { useActionHandler } from "@/lib/keybinding-manager";

/**
 * Split node types - recursive tree structure for split layout
 */
export type SplitNode =
  | { type: "terminal"; sessionId: string }
  | {
      type: "split";
      direction: "horizontal" | "vertical";
      children: [SplitNode, SplitNode];
      ratio: number; // 0-100, percentage of first child
    };

interface SplitContainerProps {
  tabId: string;
}

export function SplitContainer({ tabId }: SplitContainerProps) {
  const addSession = useTerminalStore((state) => state.addSession);
  const removeSession = useTerminalStore((state) => state.removeSession);
  const [layout, setLayout] = useState<SplitNode | null>(null);
  const [activePaneId, setActivePaneId] = useState<string | null>(null);
  const [resizing, setResizing] = useState<{
    node: SplitNode;
    startPos: number;
    startRatio: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize layout with the first session for this tab
  useEffect(() => {
    if (!layout) {
      // Initialize with the tab's main session
      setLayout({ type: "terminal", sessionId: tabId });
      setActivePaneId(tabId);
    }
  }, [tabId, layout]);

  // Collect all session IDs from layout
  const collectSessionIds = useCallback((node: SplitNode | null): string[] => {
    if (!node) return [];
    if (node.type === "terminal") return [node.sessionId];
    return [
      ...collectSessionIds(node.children[0]),
      ...collectSessionIds(node.children[1]),
    ];
  }, []);

  // Count total panes in layout
  const countPanes = useCallback((node: SplitNode | null): number => {
    if (!node) return 0;
    if (node.type === "terminal") return 1;
    return countPanes(node.children[0]) + countPanes(node.children[1]);
  }, []);

  // Find parent of a terminal node
  const findParent = useCallback(
    (
      root: SplitNode,
      targetId: string,
      parent: SplitNode | null = null
    ): { parent: SplitNode | null; childIndex: number } | null => {
      if (root.type === "terminal") {
        return root.sessionId === targetId ? { parent, childIndex: -1 } : null;
      }

      for (let i = 0; i < 2; i++) {
        const child = root.children[i];
        if (child) {
          const result = findParent(child, targetId, root);
          if (result) {
            if (result.parent === root) {
              return { parent: root, childIndex: i };
            }
            return result;
          }
        }
      }
      return null;
    },
    []
  );

  // Split the active pane
  const splitPane = useCallback(
    (direction: "horizontal" | "vertical") => {
      if (!layout || !activePaneId) {
        return;
      }

      const paneCount = countPanes(layout);

      if (paneCount >= 4) {
        console.warn("Maximum 4 panes reached");
        return;
      }

      // Create new session for the split
      const newSessionId = `${tabId}-pane-${Date.now()}`;

      addSession({
        id: newSessionId,
        title: `Pane ${paneCount + 1}`,
        cwd: "~",
        ptyId: null,
        isPane: true, // Mark as pane, not tab
      });

      // Find the node to split
      const replaceNode = (node: SplitNode): SplitNode => {
        if (node.type === "terminal") {
          if (node.sessionId === activePaneId) {
            return {
              type: "split",
              direction,
              children: [node, { type: "terminal", sessionId: newSessionId }],
              ratio: 50,
            };
          }
          return node;
        }

        return {
          ...node,
          children: [
            replaceNode(node.children[0]),
            replaceNode(node.children[1]),
          ] as [SplitNode, SplitNode],
        };
      };

      const newLayout = replaceNode(layout);
      setLayout(newLayout);
      setActivePaneId(newSessionId);
    },
    [layout, activePaneId, tabId, addSession, countPanes]
  );

  // Close a pane
  const closePane = useCallback(
    (sessionId: string) => {
      if (!layout) return;

      // If only one pane, don't close
      if (layout.type === "terminal") {
        console.warn("Cannot close the last pane");
        return;
      }

      // Find parent and sibling
      const parentInfo = findParent(layout, sessionId);
      if (!parentInfo || !parentInfo.parent) return;

      const parent = parentInfo.parent as Extract<SplitNode, { type: "split" }>;
      const siblingIndex = parentInfo.childIndex === 0 ? 1 : 0;
      const sibling = parent.children[siblingIndex];

      // Replace parent with sibling
      const replaceNode = (node: SplitNode): SplitNode => {
        if (node === parent) {
          return sibling;
        }
        if (node.type === "split") {
          return {
            ...node,
            children: [
              replaceNode(node.children[0]),
              replaceNode(node.children[1]),
            ] as [SplitNode, SplitNode],
          };
        }
        return node;
      };

      const newLayout = replaceNode(layout);
      setLayout(newLayout);

      // Remove session
      removeSession(sessionId);

      // Set active pane to sibling if we closed the active pane
      if (activePaneId === sessionId) {
        if (sibling.type === "terminal") {
          setActivePaneId(sibling.sessionId);
        } else {
          // Find first terminal in sibling tree
          const findFirstTerminal = (node: SplitNode): string | null => {
            if (node.type === "terminal") return node.sessionId;
            return findFirstTerminal(node.children[0]);
          };
          const firstTerminal = findFirstTerminal(sibling);
          if (firstTerminal) setActivePaneId(firstTerminal);
        }
      }
    },
    [layout, activePaneId, findParent, removeSession]
  );

  // Navigate between panes
  const navigatePane = useCallback(
    (direction: "left" | "right" | "up" | "down") => {
      if (!layout || !activePaneId || !containerRef.current) return;

      // Get all terminal nodes with their positions by querying DOM directly
      const terminals: Array<{ id: string; bounds: DOMRect }> = [];
      const terminalElements = containerRef.current.querySelectorAll('[data-session-id]');

      terminalElements.forEach((element) => {
        const sessionId = element.getAttribute('data-session-id');
        if (sessionId) {
          terminals.push({
            id: sessionId,
            bounds: element.getBoundingClientRect(),
          });
        }
      });

      const current = terminals.find((t) => t.id === activePaneId);
      if (!current) return;

      // Find the best candidate in the given direction
      let bestCandidate: { id: string; distance: number } | null = null;

      for (const terminal of terminals) {
        if (terminal.id === activePaneId) continue;

        const dx = terminal.bounds.left - current.bounds.left;
        const dy = terminal.bounds.top - current.bounds.top;

        let isInDirection = false;
        let distance = 0;

        switch (direction) {
          case "left":
            isInDirection = dx < -10;
            distance = Math.abs(dx) + Math.abs(dy) * 0.5;
            break;
          case "right":
            isInDirection = dx > 10;
            distance = Math.abs(dx) + Math.abs(dy) * 0.5;
            break;
          case "up":
            isInDirection = dy < -10;
            distance = Math.abs(dy) + Math.abs(dx) * 0.5;
            break;
          case "down":
            isInDirection = dy > 10;
            distance = Math.abs(dy) + Math.abs(dx) * 0.5;
            break;
        }

        if (
          isInDirection &&
          (!bestCandidate || distance < bestCandidate.distance)
        ) {
          bestCandidate = { id: terminal.id, distance };
        }
      }

      if (bestCandidate) {
        setActivePaneId(bestCandidate.id);
      }
    },
    [layout, activePaneId]
  );

  // Handle resize start
  const handleResizeStart = useCallback(
    (node: SplitNode, e: React.MouseEvent) => {
      if (node.type !== "split") return;

      e.preventDefault();
      e.stopPropagation();

      const startPos =
        node.direction === "horizontal" ? e.clientX : e.clientY;

      setResizing({
        node,
        startPos,
        startRatio: node.ratio,
      });
    },
    []
  );

  // Handle resize move
  useEffect(() => {
    if (!resizing || !containerRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const bounds = container.getBoundingClientRect();
      const node = resizing.node as Extract<SplitNode, { type: "split" }>;

      const currentPos =
        node.direction === "horizontal" ? e.clientX : e.clientY;
      const containerSize =
        node.direction === "horizontal" ? bounds.width : bounds.height;
      const delta = currentPos - resizing.startPos;
      const deltaPercent = (delta / containerSize) * 100;

      const newRatio = Math.max(
        10,
        Math.min(90, resizing.startRatio + deltaPercent)
      );

      // Update ratio in layout
      const updateRatio = (n: SplitNode): SplitNode => {
        if (n === node) {
          return { ...n, ratio: newRatio };
        }
        if (n.type === "split") {
          return {
            ...n,
            children: [
              updateRatio(n.children[0]),
              updateRatio(n.children[1]),
            ] as [SplitNode, SplitNode],
          };
        }
        return n;
      };

      if (layout) {
        setLayout(updateRatio(layout));
      }
    };

    const handleMouseUp = () => {
      setResizing(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizing, layout]);

  // Register action handlers for split pane operations
  useActionHandler("terminal.split_horizontal", useCallback(() => {
    splitPane("horizontal");
  }, [splitPane]));

  useActionHandler("terminal.split_vertical", useCallback(() => {
    splitPane("vertical");
  }, [splitPane]));

  useActionHandler("terminal.close_pane", useCallback(() => {
    if (activePaneId) {
      closePane(activePaneId);
    }
  }, [activePaneId, closePane]));

  useActionHandler("terminal.focus_pane_left", useCallback(() => {
    navigatePane("left");
  }, [navigatePane]));

  useActionHandler("terminal.focus_pane_right", useCallback(() => {
    navigatePane("right");
  }, [navigatePane]));

  useActionHandler("terminal.focus_pane_up", useCallback(() => {
    navigatePane("up");
  }, [navigatePane]));

  useActionHandler("terminal.focus_pane_down", useCallback(() => {
    navigatePane("down");
  }, [navigatePane]));

  // Render split layout recursively
  const renderNode = (node: SplitNode, depth = 0): React.ReactNode => {
    if (node.type === "terminal") {
      return (
        <div
          key={node.sessionId}
          data-session-id={node.sessionId}
          className="relative"
          style={{
            width: "100%",
            height: "100%",
            border: (countPanes(layout) > 1 && activePaneId === node.sessionId)
              ? "2px solid rgba(59, 130, 246, 0.5)"
              : "2px solid transparent",
            transition: "border-color 0.2s",
          }}
          onClick={() => setActivePaneId(node.sessionId)}
        >
          <TerminalView key={node.sessionId} sessionId={node.sessionId} className="split-pane-terminal" forceVisible={true} />
        </div>
      );
    }

    const isHorizontal = node.direction === "horizontal";

    // Use depth and direction as key to ensure stability
    const nodeKey = `split-${depth}-${isHorizontal ? 'h' : 'v'}`;

    return (
      <div
        key={nodeKey}
        style={{
          display: "flex",
          flexDirection: isHorizontal ? "row" : "column",
          width: "100%",
          height: "100%",
        }}
      >
        <div
          style={{
            [isHorizontal ? "width" : "height"]: `${node.ratio}%`,
            overflow: "hidden",
          }}
        >
          {renderNode(node.children[0], depth + 1)}
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={(e) => handleResizeStart(node, e)}
          style={{
            [isHorizontal ? "width" : "height"]: "4px",
            [isHorizontal ? "height" : "width"]: "100%",
            cursor: isHorizontal ? "col-resize" : "row-resize",
            backgroundColor:
              resizing?.node === node
                ? "rgba(59, 130, 246, 0.5)"
                : "var(--ui-border)",
            transition: "background-color 0.2s",
            flexShrink: 0,
          }}
          className="hover:bg-blue-500/50"
        />

        <div
          style={{
            [isHorizontal ? "width" : "height"]: `${100 - node.ratio}%`,
            overflow: "hidden",
          }}
        >
          {renderNode(node.children[1], depth + 1)}
        </div>
      </div>
    );
  };

  if (!layout) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ opacity: 0.5 }}>No terminal session</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {layout && renderNode(layout)}
    </div>
  );
}
