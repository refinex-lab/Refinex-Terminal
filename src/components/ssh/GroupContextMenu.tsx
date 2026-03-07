import { useEffect, useRef } from "react";
import { Edit, Trash2 } from "lucide-react";

interface GroupContextMenuProps {
  x: number;
  y: number;
  group: string;
  hostCount: number;
  onClose: () => void;
  onRename: (group: string) => void;
  onDelete: (group: string) => void;
}

export function GroupContextMenu({
  x,
  y,
  group,
  hostCount,
  onClose,
  onRename,
  onDelete,
}: GroupContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const handleRename = () => {
    onRename(group);
    onClose();
  };

  const handleDelete = () => {
    onDelete(group);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] rounded-md shadow-lg backdrop-blur-sm"
      style={{
        left: x,
        top: y,
        backgroundColor: "rgba(30, 30, 30, 0.95)",
        border: "1px solid var(--ui-border)",
      }}
    >
      <div className="py-1">
        <button
          onClick={handleRename}
          className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 transition-colors flex items-center gap-2"
          style={{ color: "var(--ui-foreground)" }}
        >
          <Edit className="size-4" />
          Rename Group
        </button>

        <button
          onClick={handleDelete}
          className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 transition-colors text-red-500 flex items-center gap-2"
        >
          <Trash2 className="size-4" />
          Delete Group
        </button>
      </div>
    </div>
  );
}
