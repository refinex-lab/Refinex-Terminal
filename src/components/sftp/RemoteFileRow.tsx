import { useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { type RemoteFileEntry } from "@/lib/tauri-ssh";
import { getFileIcon } from "@/lib/file-icons";
import { formatBytes, formatDate } from "@/lib/utils";
import { Terminal, Download, Trash2, Edit3, FolderOpen } from "lucide-react";

interface RemoteFileRowProps {
  file: RemoteFileEntry;
  sessionId: string;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onOpenInTerminal?: (path: string) => void;
}

export function RemoteFileRow({
  file,
  sessionId,
  isSelected,
  onClick,
  onDoubleClick,
  onOpenInTerminal,
}: RemoteFileRowProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const Icon = getFileIcon(file.name, file.isDir);

  // Make file draggable
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `remote-file-${file.path}`,
    data: {
      type: "remote-file",
      file,
      sessionId,
    },
  });

  // Make directory droppable
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `remote-dir-${file.path}`,
    data: {
      type: "remote-directory",
      path: file.path,
      sessionId,
    },
    disabled: !file.isDir,
  });

  // Handle context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // Close context menu on click outside
  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  // Handle "Open in Terminal"
  const handleOpenInTerminal = () => {
    const targetPath = file.isDir ? file.path : file.path.substring(0, file.path.lastIndexOf("/"));
    onOpenInTerminal?.(targetPath);
    setContextMenu(null);
  };

  return (
    <>
      <tr
        ref={(node) => {
          setDragRef(node);
          if (file.isDir) {
            setDropRef(node);
          }
        }}
        className="hover:bg-white/5 cursor-pointer"
        style={{
          backgroundColor: isSelected
            ? "rgba(59, 130, 246, 0.2)"
            : undefined,
          opacity: isDragging ? 0.5 : 1,
          outline: isOver ? "2px solid #3b82f6" : "none",
          outlineOffset: "-2px",
        }}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={handleContextMenu}
        {...attributes}
        {...listeners}
      >
        <td className="px-4 py-2">
          <div className="flex items-center gap-2">
            <Icon className="size-4" style={{ color: "var(--ui-muted-foreground)" }} />
            <span style={{ color: "var(--ui-foreground)" }}>{file.name}</span>
          </div>
        </td>
        <td className="px-4 py-2 text-right" style={{ color: "var(--ui-muted-foreground)" }}>
          {file.isDir ? "-" : formatBytes(file.size)}
        </td>
        <td className="px-4 py-2" style={{ color: "var(--ui-muted-foreground)" }}>
          {file.modified ? formatDate(file.modified * 1000) : "-"}
        </td>
        <td className="px-4 py-2 font-mono text-xs" style={{ color: "var(--ui-muted-foreground)" }}>
          {file.permissions}
        </td>
      </tr>

      {/* Context Menu */}
      {contextMenu && (
        <>
          {/* Backdrop to close menu */}
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
            }}
            onClick={handleCloseContextMenu}
            onContextMenu={(e) => {
              e.preventDefault();
              handleCloseContextMenu();
            }}
          />

          {/* Menu */}
          <div
            style={{
              position: "fixed",
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`,
              backgroundColor: "var(--ui-background)",
              border: "1px solid var(--ui-border)",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
              minWidth: "200px",
              zIndex: 1000,
              padding: "4px 0",
            }}
          >
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
              style={{ color: "var(--ui-foreground)" }}
              onClick={handleOpenInTerminal}
            >
              <Terminal className="size-4" />
              Open in Terminal
            </button>

            <div className="h-px my-1" style={{ backgroundColor: "var(--ui-border)" }} />

            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
              style={{ color: "var(--ui-foreground)" }}
              onClick={() => {
                console.log("Download:", file.path);
                setContextMenu(null);
              }}
            >
              <Download className="size-4" />
              Download
            </button>

            <div className="h-px my-1" style={{ backgroundColor: "var(--ui-border)" }} />

            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
              style={{ color: "var(--ui-foreground)" }}
              onClick={() => {
                console.log("Rename:", file.path);
                setContextMenu(null);
              }}
            >
              <Edit3 className="size-4" />
              Rename
            </button>

            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors text-red-500"
              onClick={() => {
                console.log("Delete:", file.path);
                setContextMenu(null);
              }}
            >
              <Trash2 className="size-4" />
              Delete
            </button>
          </div>
        </>
      )}
    </>
  );
}
