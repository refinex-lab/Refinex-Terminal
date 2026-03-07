import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X } from "lucide-react";
import { useState } from "react";
import { AgentStatus } from "@/components/terminal/AgentStatus";
import type { TerminalSession } from "@/stores/terminal-store";

interface SortableTabProps {
  session: TerminalSession;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}

export function SortableTab({
  session,
  isActive,
  onSelect,
  onClose,
}: SortableTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: session.id });

  const [isHovered, setIsHovered] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 10 : "auto",
    backgroundColor: isActive ? "var(--ui-tab-background-active)" : isHovered ? "var(--ui-button-background)" : "transparent",
    color: isActive ? "var(--ui-tab-foreground-active)" : "var(--ui-tab-foreground)",
    boxShadow: isActive ? "0 1px 3px rgba(0, 0, 0, 0.1)" : "none",
    flex: 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        group relative flex items-center justify-center gap-2 px-3 py-1.5 rounded-full cursor-grab
        transition-all duration-200
        ${isDragging ? "cursor-grabbing" : ""}
      `}
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className="text-xs font-medium truncate pointer-events-none">
        {session.title}
      </span>

      {/* Agent status indicator */}
      <div className="pointer-events-none">
        <AgentStatus sessionId={session.id} variant="tab" />
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className={`
          absolute right-2 flex items-center justify-center size-4 rounded-full transition-all duration-200 cursor-pointer
          ${isActive || isHovered ? "opacity-70 hover:opacity-100" : "opacity-0"}
        `}
        style={{
          backgroundColor: "transparent",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "rgba(128, 128, 128, 0.2)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
        }}
        aria-label="Close tab"
      >
        <X className="size-3 pointer-events-none" />
      </button>
    </div>
  );
}
