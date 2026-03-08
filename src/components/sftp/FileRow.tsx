import { useDraggable } from "@dnd-kit/core";
import { formatBytes, formatDate } from "@/lib/utils";
import { Terminal, Folder, File, Download, Upload, Trash2 } from "lucide-react";
import { useState } from "react";

interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modified: number;
}

interface FileRowProps {
  file: FileEntry;
  type: "local" | "remote";
  sessionId: string | null;
  isSelected: boolean;
  selectedFiles: FileEntry[];
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onOpenInTerminal?: (path: string) => void | undefined;
  onDelete?: (file: FileEntry) => void;
  onUpload?: (file: FileEntry) => void;
  onDownload?: (file: FileEntry) => void;
}

export function FileRow({
  file,
  type,
  isSelected,
  selectedFiles,
  onClick,
  onDoubleClick,
  onOpenInTerminal,
  onDelete,
  onUpload,
  onDownload,
}: FileRowProps) {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  const Icon = file.isDir ? Folder : File;

  // Make file draggable
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${type}-file-${file.path}`,
    data: {
      type: `${type}-file`,
      file,
      files: isSelected ? selectedFiles : [file],
      selectedCount: isSelected ? selectedFiles.length : 1,
      name: file.name,
      path: file.path,
    },
  });

  // Separate drag handle to avoid conflicts with context menu
  const dragHandleListeners = {
    onPointerDown: listeners?.onPointerDown,
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  return (
    <>
      <tr
        ref={setNodeRef}
        className="hover:bg-white/5 cursor-pointer"
        style={{
          backgroundColor: isSelected ? "rgba(59, 130, 246, 0.2)" : undefined,
          opacity: isDragging ? 0.5 : 1,
        }}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={handleContextMenu}
        {...attributes}
      >
        <td className="px-4 py-2" {...dragHandleListeners}>
          <div className="flex items-center gap-2">
            <Icon className="size-4 text-[var(--ui-muted-foreground)]" />
            <span className="text-[var(--ui-foreground)] truncate">{file.name}</span>
          </div>
        </td>
        <td className="px-4 py-2 text-right text-[var(--ui-foreground)]">
          {file.isDir ? "-" : formatBytes(file.size)}
        </td>
        <td className="px-4 py-2 text-[var(--ui-foreground)]">
          {formatDate(file.modified)}
        </td>
      </tr>

      {/* Context menu */}
      {showContextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowContextMenu(false)}
          />
          <div
            className="fixed z-50 bg-[var(--ui-background)] border border-[var(--ui-border)] rounded shadow-lg py-1 min-w-[160px]"
            style={{
              top: `${menuPosition.y}px`,
              left: `${menuPosition.x}px`,
            }}
          >
            {type === "remote" && (
              <>
                <button
                  className="w-full px-4 py-2 text-left text-sm hover:bg-white/10 text-[var(--ui-foreground)] flex items-center gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowContextMenu(false);
                    if (onDownload) {
                      onDownload(file);
                    }
                  }}
                >
                  <Download className="size-4" />
                  Download
                </button>
                {file.isDir && onOpenInTerminal && (
                  <button
                    className="w-full px-4 py-2 text-left text-sm hover:bg-white/10 text-[var(--ui-foreground)] flex items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowContextMenu(false);
                      onOpenInTerminal(file.path);
                    }}
                  >
                    <Terminal className="size-4" />
                    Open in Terminal
                  </button>
                )}
              </>
            )}
            {type === "local" && (
              <button
                className="w-full px-4 py-2 text-left text-sm hover:bg-white/10 text-[var(--ui-foreground)] flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowContextMenu(false);
                  if (onUpload) {
                    onUpload(file);
                  }
                }}
              >
                <Upload className="size-4" />
                Upload
              </button>
            )}
            <div className="h-px bg-[var(--ui-border)] my-1" />
            <button
              className="w-full px-4 py-2 text-left text-sm hover:bg-white/10 text-red-500 flex items-center gap-2"
              onClick={(e) => {
                e.stopPropagation();
                setShowContextMenu(false);
                if (onDelete) {
                  onDelete(file);
                }
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
