import { Plus } from "lucide-react";
import { useTerminalStore } from "@/stores/terminal-store";
import { ptyKill } from "@/lib/tauri-pty";
import { useState, useCallback, memo } from "react";
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

const TabBarComponent = () => {
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sessionIds.indexOf(active.id as string);
      const newIndex = sessionIds.indexOf(over.id as string);

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderSessions(oldIndex, newIndex);
      }
    }

    setActiveId(null);
  };

  // Register keyboard shortcuts
  useActionHandler("terminal.new_tab", handleNewTab);
  useActionHandler("terminal.close_tab", useCallback(() => {
    if (activeSessionId) {
      handleCloseTab(activeSessionId);
    }
  }, [activeSessionId, handleCloseTab]));

  // Switch to specific tab (Cmd+1 through Cmd+9)
  for (let i = 1; i <= 9; i++) {
    useActionHandler(`terminal.switch_tab_${i}`, useCallback(() => {
      const tabSessions = sessions.filter(s => !s.isPane);
      const targetSession = tabSessions[i - 1];
      if (targetSession) {
        setActiveSession(targetSession.id);
      }
    }, [sessions, setActiveSession]));
  }

  const activeSession = sessions.find((s) => s.id === activeId);

  return (
    <div
      className="flex items-center gap-1 px-2 py-1.5 border-b select-none"
      role="tablist"
      aria-label="Terminal tabs"
      style={{
        backgroundColor: "var(--ui-background)",
        borderColor: "var(--ui-border)",
        // Add padding for macOS traffic lights when using overlay title bar
        paddingLeft: "80px", // Space for traffic lights on macOS
      }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sessionIds} strategy={horizontalListSortingStrategy}>
          {sessions
            .filter((s) => !s.isPane)
            .map((session) => (
              <SortableTab
                key={session.id}
                session={session}
                isActive={session.id === activeSessionId}
                onSelect={() => setActiveSession(session.id)}
                onClose={() => handleCloseTab(session.id)}
              />
            ))}
        </SortableContext>

        <DragOverlay>
          {activeSession && (
            <div
              className="px-3 py-1.5 rounded text-sm font-medium cursor-grabbing opacity-80"
              style={{
                backgroundColor: "var(--ui-accent)",
                color: "var(--ui-accent-foreground)",
              }}
            >
              {activeSession.title}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <button
        onClick={handleNewTab}
        className="p-1.5 rounded hover:bg-white/10 motion-safe:transition-colors ml-1"
        style={{ color: "var(--ui-foreground)" }}
        title="New Terminal (Cmd+T)"
        aria-label="New terminal tab"
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
};

export const TabBar = memo(TabBarComponent);
