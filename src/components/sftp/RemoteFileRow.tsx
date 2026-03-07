import { useDraggable, useDroppable } from "@dnd-kit/core";
import { type RemoteFileEntry } from "@/lib/tauri-ssh";
import { getFileIcon } from "@/lib/file-icons";
import { formatBytes, formatDate } from "@/lib/utils";

interface RemoteFileRowProps {
  file: RemoteFileEntry;
  sessionId: string;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
}

export function RemoteFileRow({
  file,
  sessionId,
  isSelected,
  onClick,
  onDoubleClick,
}: RemoteFileRowProps) {
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

  return (
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
  );
}
