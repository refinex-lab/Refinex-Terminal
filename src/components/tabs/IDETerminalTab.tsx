import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TerminalSession } from "@/stores/terminal-store";
import { ptyKill } from "@/lib/tauri-pty";
import { useTerminalStore } from "@/stores/terminal-store";

interface IDETerminalTabProps {
  session: TerminalSession;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}

export function IDETerminalTab({
  session,
  isActive,
  onSelect,
  onClose,
}: IDETerminalTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: session.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative"
      {...attributes}
      {...listeners}
    >
      <button
        onClick={onSelect}
        className="px-2 py-1 rounded text-xs font-medium transition-colors"
        style={{
          backgroundColor: isActive
            ? "rgba(255, 255, 255, 0.12)"
            : "transparent",
          color: isActive
            ? "var(--ui-foreground)"
            : "var(--ui-muted-foreground)",
          paddingRight: "24px",
          cursor: isDragging ? "grabbing" : "pointer",
          borderBottom: isActive ? "2px solid var(--ui-accent)" : "2px solid transparent",
        }}
      >
        {session.title}
      </button>
      <button
        onClick={async (e) => {
          e.stopPropagation();
          if (session.ptyId !== null && session.ptyId !== undefined) {
            try {
              await ptyKill(session.ptyId);
            } catch (error) {
              console.error("Failed to kill PTY:", error);
            }
          }
          onClose();
        }}
        className="absolute right-1 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/20 transition-all"
        style={{
          color: isActive
            ? "var(--ui-foreground)"
            : "var(--ui-muted-foreground)",
          fontSize: "10px",
          top: "50%",
          transform: "translateY(-50%)",
        }}
        title="Close Terminal"
      >
        ×
      </button>
    </div>
  );
}
