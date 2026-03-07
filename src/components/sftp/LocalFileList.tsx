import { useState, useEffect } from "react";
import { ChevronRight, ChevronDown, Folder, File } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { getFileIcon } from "@/lib/file-icons";

/**
 * File entry from Rust backend
 */
interface FileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  is_symlink: boolean;
  size: number;
  modified: number;
}

/**
 * Tree node with UI state
 */
interface TreeNode extends FileEntry {
  isExpanded: boolean;
  children: TreeNode[] | null;
  depth: number;
}

interface LocalFileListProps {
  projectPath: string;
  className?: string;
}

/**
 * Draggable local file row component for SFTP
 */
function LocalFileRow({
  node,
  onToggle,
}: {
  node: TreeNode;
  onToggle: () => void;
}) {
  const iconConfig = getFileIcon(node.name, node.is_directory);
  const Icon = node.is_directory ? Folder : iconConfig.icon;
  const iconColor = node.is_directory ? "var(--ui-foreground)" : iconConfig.color;

  // Make file/folder draggable
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `local-file-${node.path}`,
    data: {
      type: "local-file",
      path: node.path,
      name: node.name,
      isDirectory: node.is_directory,
    },
  });

  // Make directory droppable
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `local-dir-${node.path}`,
    data: {
      type: "local-directory",
      path: node.path,
    },
    disabled: !node.is_directory,
  });

  const handleClick = () => {
    if (node.is_directory) {
      onToggle();
    }
  };

  return (
    <div
      ref={(el) => {
        setDragRef(el);
        if (node.is_directory) {
          setDropRef(el);
        }
      }}
      className="group flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-white/5 transition-colors"
      style={{
        paddingLeft: `${node.depth * 12 + 8}px`,
        opacity: isDragging ? 0.5 : 1,
        outline: isOver ? "2px solid #3b82f6" : "none",
        outlineOffset: "-2px",
      }}
      onClick={handleClick}
      {...attributes}
      {...listeners}
    >
      {node.is_directory && (
        <div className="flex-shrink-0">
          {node.isExpanded ? (
            <ChevronDown className="size-3.5" style={{ color: "var(--ui-foreground)", opacity: 0.7 }} />
          ) : (
            <ChevronRight className="size-3.5" style={{ color: "var(--ui-foreground)", opacity: 0.7 }} />
          )}
        </div>
      )}
      {!node.is_directory && <div className="w-3.5" />}

      <Icon
        className="size-4 flex-shrink-0"
        style={{ color: iconColor, opacity: node.is_directory ? 0.7 : 0.9 }}
      />

      <span
        className="text-sm truncate flex-1"
        style={{ color: "var(--ui-foreground)" }}
        title={node.name}
      >
        {node.name}
      </span>
    </div>
  );
}

/**
 * Local file list component for SFTP panel
 * Simplified version of FileTree with drag-drop support
 */
export function LocalFileList({ projectPath, className = "" }: LocalFileListProps) {
  const [rootNodes, setRootNodes] = useState<TreeNode[]>([]);

  // Load root directory on mount
  useEffect(() => {
    loadDirectory(projectPath, 0).then((nodes) => {
      setRootNodes(nodes);
    });
  }, [projectPath]);

  // Load directory contents
  const loadDirectory = async (path: string, depth: number): Promise<TreeNode[]> => {
    try {
      const entries = await invoke<FileEntry[]>("read_directory", { path });
      return entries.map((entry) => ({
        ...entry,
        isExpanded: false,
        children: null,
        depth,
      }));
    } catch (error) {
      console.error("Failed to load directory:", error);
      return [];
    }
  };

  // Toggle directory expansion
  const toggleDirectory = async (node: TreeNode) => {
    if (!node.is_directory) return;

    const updateNode = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.map((n) => {
        if (n.path === node.path) {
          if (!n.isExpanded && n.children === null) {
            // Load children
            loadDirectory(n.path, n.depth + 1).then((children) => {
              setRootNodes((prev) => updateNodeChildren(prev, n.path, children));
            });
          }
          return { ...n, isExpanded: !n.isExpanded };
        }
        if (n.children) {
          return { ...n, children: updateNode(n.children) };
        }
        return n;
      });
    };
    setRootNodes(updateNode(rootNodes));
  };

  // Update node children after loading
  const updateNodeChildren = (
    nodes: TreeNode[],
    path: string,
    children: TreeNode[]
  ): TreeNode[] => {
    return nodes.map((n) => {
      if (n.path === path) {
        return { ...n, children };
      }
      if (n.children) {
        return { ...n, children: updateNodeChildren(n.children, path, children) };
      }
      return n;
    });
  };

  // Render tree node recursively
  const renderNode = (node: TreeNode): JSX.Element => {
    return (
      <div key={node.path}>
        <LocalFileRow node={node} onToggle={() => toggleDirectory(node)} />

        {/* Children */}
        {node.is_directory && node.isExpanded && node.children && (
          <div>{node.children.map((child) => renderNode(child))}</div>
        )}
      </div>
    );
  };

  return (
    <div className={`overflow-y-auto ${className}`}>
      {rootNodes.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <span className="text-sm" style={{ color: "var(--ui-foreground)", opacity: 0.7 }}>
            No files found
          </span>
        </div>
      ) : (
        <div className="py-2">{rootNodes.map((node) => renderNode(node))}</div>
      )}
    </div>
  );
}
