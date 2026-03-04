import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X } from "lucide-react";

interface SortableTabProps {
  id: string;
  title: string;
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
}

export function SortableTab({
  id,
  title,
  isActive,
  onActivate,
  onClose,
}: SortableTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 10 : "auto",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        group relative flex items-center gap-1.5 px-3 py-1.5 rounded-t-md cursor-grab
        transition-all duration-150 min-w-[120px] max-w-[200px]
        ${
          isActive
            ? "bg-secondary/80 text-foreground border-t border-x border-border/40"
            : "bg-transparent text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
        }
        ${isDragging ? "cursor-grabbing" : ""}
      `}
      onClick={onActivate}
    >
      <span className="text-xs font-medium truncate flex-1 pointer-events-none">
        {title}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className={`
          flex items-center justify-center size-4 rounded hover:bg-muted-foreground/20
          transition-all duration-150 cursor-pointer
          ${isActive ? "opacity-60 hover:opacity-100" : "opacity-0 group-hover:opacity-60 group-hover:hover:opacity-100"}
        `}
        aria-label="Close tab"
      >
        <X className="size-3 pointer-events-none" />
      </button>
    </div>
  );
}
