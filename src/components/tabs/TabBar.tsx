import { Plus } from "lucide-react";
import { useTerminalStore } from "@/stores/terminal-store";
import { ptyKill } from "@/lib/tauri-pty";
import { useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableTab } from "./SortableTab";

export function TabBar() {
  const { sessions, activeSessionId, setActiveSession, removeSession, addSession, reorderSessions } =
    useTerminalStore();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Move 8px before starting drag, prevents conflict with onClick
      },
    }),
    useSensor(KeyboardSensor)
  );

  const sessionIds = sessions.map((s) => s.id);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (!modifier) return;

      // Cmd/Ctrl + T - New tab
      if (e.key === "t") {
        e.preventDefault();
        handleNewTab();
        return;
      }

      // Cmd/Ctrl + W - Close current tab
      if (e.key === "w") {
        e.preventDefault();
        if (activeSessionId) {
          handleCloseTab(activeSessionId);
        }
        return;
      }

      // Cmd/Ctrl + 1-9 - Switch to tab
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) {
        e.preventDefault();
        const session = sessions[num - 1];
        if (session) {
          setActiveSession(session.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sessions, activeSessionId, setActiveSession]);

  const handleNewTab = () => {
    const newSession = {
      id: `terminal-${Date.now()}`,
      title: `Terminal ${sessions.length + 1}`,
      cwd: "~",
      ptyId: null,
    };
    addSession(newSession);
  };

  const handleCloseTab = async (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (session?.ptyId !== null && session?.ptyId !== undefined) {
      try {
        await ptyKill(session.ptyId);
      } catch (error) {
        console.error("Failed to kill PTY:", error);
      }
    }
    removeSession(sessionId);
  };

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = sessionIds.indexOf(active.id as string);
      const newIndex = sessionIds.indexOf(over.id as string);
      reorderSessions(oldIndex, newIndex);
    }
  }

  return (
    <div className="tab-bar-container flex items-center h-10 bg-background border-b border-border/40 px-2 gap-0.5">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sessionIds} strategy={horizontalListSortingStrategy}>
          {sessions.map((session) => (
            <SortableTab
              key={session.id}
              id={session.id}
              title={session.title}
              isActive={session.isActive}
              onActivate={() => setActiveSession(session.id)}
              onClose={() => handleCloseTab(session.id)}
            />
          ))}
        </SortableContext>

        <DragOverlay>
          {activeId ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-t-md bg-secondary/80 text-foreground border-t border-x border-border/40 shadow-lg cursor-grabbing min-w-[120px] max-w-[200px]">
              <span className="text-xs font-medium truncate flex-1">
                {sessions.find((s) => s.id === activeId)?.title}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <button
        onClick={handleNewTab}
        className="flex items-center justify-center size-7 rounded hover:bg-secondary/60 transition-colors ml-1"
        aria-label="New tab"
        title="New tab (Cmd/Ctrl+T)"
      >
        <Plus className="size-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}
