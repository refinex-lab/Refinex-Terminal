import { Plus } from "lucide-react";
import { useTerminalStore } from "@/stores/terminal-store";
import { ptyKill } from "@/lib/tauri-pty";
import { useState, useCallback } from "react";
import { useActionHandler } from "@/lib/keybinding-manager";
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

  const sessionIds = sessions.filter(s => !s.isPane).map((s) => s.id);

  const handleNewTab = useCallback(() => {
    const newSession = {
      id: `terminal-${Date.now()}`,
      title: `⌘ ${sessions.filter(s => !s.isPane).length + 1}`, // Will be renumbered by store
      cwd: "~",
      ptyId: null,
    };
    addSession(newSession);
  }, [sessions, addSession]);

  const handleCloseTab = useCallback(async (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (session?.ptyId !== null && session?.ptyId !== undefined) {
      try {
        await ptyKill(session.ptyId);
      } catch (error) {
        console.error("Failed to kill PTY:", error);
      }
    }
    removeSession(sessionId);
  }, [sessions, removeSession]);

  // Register action handlers
  useActionHandler("terminal.new_tab", handleNewTab);

  useActionHandler("terminal.close_tab", useCallback(() => {
    if (activeSessionId) {
      handleCloseTab(activeSessionId);
    }
  }, [activeSessionId, handleCloseTab]));

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
    <div className="tab-bar-container flex items-center h-10 border-b px-3 gap-1.5" style={{ backgroundColor: "var(--ui-tab-background)", borderColor: "var(--ui-border)" }}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sessionIds} strategy={horizontalListSortingStrategy}>
          <div className="flex items-center gap-1.5 flex-1">
            {sessions.filter(s => !s.isPane).map((session) => (
              <SortableTab
                key={session.id}
                id={session.id}
                title={session.title}
                isActive={session.isActive}
                onActivate={() => setActiveSession(session.id)}
                onClose={() => handleCloseTab(session.id)}
                totalTabs={sessions.filter(s => !s.isPane).length}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeId ? (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full shadow-lg cursor-grabbing min-w-[100px] max-w-[180px]"
              style={{
                backgroundColor: "var(--ui-tab-background-active)",
                color: "var(--ui-tab-foreground-active)",
              }}
            >
              <span className="text-xs font-medium truncate flex-1">
                {sessions.find((s) => s.id === activeId)?.title}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <button
        onClick={handleNewTab}
        className="flex items-center justify-center size-7 rounded-full transition-all duration-200 flex-shrink-0"
        style={{
          backgroundColor: "var(--ui-button-background)",
          color: "var(--ui-foreground)",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.05)";
          e.currentTarget.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.15)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.1)";
        }}
        aria-label="New tab"
        title="New tab (Cmd/Ctrl+T)"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
