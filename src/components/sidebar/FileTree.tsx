import { useState, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  MoreVertical,
  Terminal,
  Copy,
  Edit3,
  Trash2,
  FilePlus,
  FolderPlus,
  ExternalLink,
  File as FileIcon,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useTerminalStore } from "@/stores/terminal-store";
import { getFileIcon } from "@/lib/file-icons";
import { watchDirectory, unwatchDirectory, onFsChanged, type FsChangeEvent } from "@/lib/fs-watcher";

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
 * File tree node with UI state
 */
interface TreeNode extends FileEntry {
  isExpanded: boolean;
  children: TreeNode[] | null;
  depth: number;
}

interface FileTreeProps {
  projectPath: string;
  className?: string;
  triggerCreate?: { type: "file" | "folder" } | null;
  onCreateComplete?: () => void;
  triggerCollapseAll?: boolean;
  onFileClick?: (filePath: string, fileName: string) => void;
}

/**
 * File tree component with lazy loading
 */
export function FileTree({ projectPath, className = "", triggerCreate, onCreateComplete, triggerCollapseAll, onFileClick }: FileTreeProps) {
  const [rootNodes, setRootNodes] = useState<TreeNode[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: TreeNode;
  } | null>(null);
  const [renamingNode, setRenamingNode] = useState<TreeNode | null>(null);
  const [newName, setNewName] = useState("");
  const [creatingNode, setCreatingNode] = useState<{ parent: TreeNode | null; type: "file" | "folder" } | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const { addSession } = useTerminalStore();

  // Handle external trigger to create file/folder at root
  useEffect(() => {
    if (triggerCreate) {
      setCreatingNode({ parent: null, type: triggerCreate.type });
      setNewItemName("");
      if (onCreateComplete) {
        onCreateComplete();
      }
    }
  }, [triggerCreate, onCreateComplete]);

  // Handle collapse all trigger
  useEffect(() => {
    if (triggerCollapseAll) {
      const collapseAllNodes = (nodes: TreeNode[]): TreeNode[] => {
        return nodes.map((node) => ({
          ...node,
          isExpanded: false,
          children: node.children ? collapseAllNodes(node.children) : node.children,
        }));
      };
      setRootNodes(collapseAllNodes(rootNodes));
    }
  }, [triggerCollapseAll]);

  // Load root directory on mount and setup file watcher
  useEffect(() => {
    loadDirectory(projectPath, 0).then((nodes) => {
      setRootNodes(nodes);
    });

    // Start watching the project directory
    watchDirectory(projectPath).catch((error) => {
      console.error("Failed to start file watcher:", error);
    });

    // Listen for file system changes
    const unlistenPromise = onFsChanged((event: FsChangeEvent) => {
      const { path, kind } = event;

      if (kind === "create") {
        // Reload parent directory to show new file/folder
        const parentPath = path.substring(0, path.lastIndexOf("/"));

        // If it's the root directory, reload root nodes
        if (parentPath === projectPath || parentPath === "") {
          loadDirectory(projectPath, 0).then((nodes) => {
            setRootNodes(nodes);
          });
        } else {
          // Reload specific directory
          const reloadDir = async (nodes: TreeNode[]): Promise<TreeNode[]> => {
            const updated: TreeNode[] = [];
            for (const node of nodes) {
              if (node.path === parentPath && node.is_directory && node.isExpanded) {
                const newChildren = await loadDirectory(node.path, node.depth + 1);
                updated.push({ ...node, children: newChildren });
              } else if (node.children) {
                const updatedChildren = await reloadDir(node.children);
                updated.push({ ...node, children: updatedChildren });
              } else {
                updated.push(node);
              }
            }
            return updated;
          };

          setRootNodes((prevNodes) => {
            reloadDir(prevNodes).then(setRootNodes);
            return prevNodes; // Keep current nodes while async update is in progress
          });
        }
      } else if (kind === "remove") {
        // Remove node from tree
        setRootNodes((prevNodes) => {
          const removeFromNodes = (nodes: TreeNode[]): TreeNode[] => {
            return nodes
              .filter((n) => n.path !== path)
              .map((n) => {
                if (n.children) {
                  return { ...n, children: removeFromNodes(n.children) };
                }
                return n;
              });
          };

          return removeFromNodes(prevNodes);
        });
      }
    });

    // Cleanup on unmount or project change
    return () => {
      unwatchDirectory().catch((error) => {
        console.error("Failed to stop file watcher:", error);
      });
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [projectPath]);

  // Load directory contents
  const loadDirectory = async (
    path: string,
    depth: number
  ): Promise<TreeNode[]> => {
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

  // Handle context menu
  const handleContextMenu = (e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  // Close context menu
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    const handleContextMenuGlobal = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener("click", handleClick);
      document.addEventListener("contextmenu", handleContextMenuGlobal);
      return () => {
        document.removeEventListener("click", handleClick);
        document.removeEventListener("contextmenu", handleContextMenuGlobal);
      };
    }
  }, [contextMenu]);

  // Context menu actions
  const handleOpenInTerminal = (node: TreeNode) => {
    const targetPath = node.is_directory ? node.path : node.path.substring(0, node.path.lastIndexOf("/"));
    addSession({
      id: `terminal-${Date.now()}`,
      title: "Terminal",
      cwd: targetPath,
      ptyId: null,
    });
    setContextMenu(null);
  };

  const handleCopyPath = async (node: TreeNode) => {
    try {
      await navigator.clipboard.writeText(node.path);
    } catch (error) {
      console.error("Failed to copy path:", error);
    }
    setContextMenu(null);
  };

  const handleCopyRelativePath = async (node: TreeNode) => {
    try {
      const relativePath = node.path.replace(projectPath + "/", "");
      await navigator.clipboard.writeText(relativePath);
    } catch (error) {
      console.error("Failed to copy relative path:", error);
    }
    setContextMenu(null);
  };

  const handleRevealInFinder = async (node: TreeNode) => {
    try {
      await invoke("reveal_in_finder", { path: node.path });
    } catch (error) {
      console.error("Failed to reveal in finder:", error);
      alert(`Failed to reveal in finder: ${error}`);
    }
    setContextMenu(null);
  };

  const handleRename = (node: TreeNode) => {
    setRenamingNode(node);
    setNewName(node.name);
    setContextMenu(null);
  };

  const handleRenameSubmit = async () => {
    if (!renamingNode || !newName || newName === renamingNode.name) {
      setRenamingNode(null);
      return;
    }

    try {
      const oldPath = renamingNode.path;
      const newPath = oldPath.substring(0, oldPath.lastIndexOf("/")) + "/" + newName;

      await invoke("fs_rename", { oldPath, newPath });

      // Reload the parent directory
      const parentPath = oldPath.substring(0, oldPath.lastIndexOf("/"));
      const depth = renamingNode.depth;
      const newNodes = await loadDirectory(parentPath, depth - 1);

      // Update the tree
      if (depth === 0) {
        setRootNodes(newNodes);
      } else {
        // Find and update parent node's children
        const updateParentChildren = (nodes: TreeNode[]): TreeNode[] => {
          return nodes.map((n) => {
            if (n.path === parentPath) {
              return { ...n, children: newNodes };
            }
            if (n.children) {
              return { ...n, children: updateParentChildren(n.children) };
            }
            return n;
          });
        };
        setRootNodes(updateParentChildren(rootNodes));
      }
    } catch (error) {
      console.error("Failed to rename:", error);
      alert(`Failed to rename: ${error}`);
    }

    setRenamingNode(null);
    setNewName("");
  };

  const handleRenameCancel = () => {
    setRenamingNode(null);
    setNewName("");
  };

  const handleDelete = (node: TreeNode) => {
    if (!confirm(`Are you sure you want to delete "${node.name}"?`)) {
      setContextMenu(null);
      return;
    }

    invoke("fs_delete", { path: node.path })
      .then(() => {
        // Reload the parent directory
        const parentPath = node.path.substring(0, node.path.lastIndexOf("/"));
        const depth = node.depth;
        loadDirectory(parentPath, depth - 1).then((newNodes) => {
          if (depth === 0) {
            setRootNodes(newNodes);
          } else {
            const updateParentChildren = (nodes: TreeNode[]): TreeNode[] => {
              return nodes.map((n) => {
                if (n.path === parentPath) {
                  return { ...n, children: newNodes };
                }
                if (n.children) {
                  return { ...n, children: updateParentChildren(n.children) };
                }
                return n;
              });
            };
            setRootNodes(updateParentChildren(rootNodes));
          }
        });
      })
      .catch((error) => {
        console.error("Failed to delete:", error);
        alert(`Failed to delete: ${error}`);
      });

    setContextMenu(null);
  };

  const handleNewFile = (parent: TreeNode | null) => {
    setCreatingNode({ parent, type: "file" });
    setNewItemName("");
    setContextMenu(null);
  };

  const handleNewFolder = (parent: TreeNode | null) => {
    setCreatingNode({ parent, type: "folder" });
    setNewItemName("");
    setContextMenu(null);
  };

  const handleCreateSubmit = async () => {
    if (!creatingNode || !newItemName) {
      setCreatingNode(null);
      return;
    }

    try {
      const parentPath = creatingNode.parent?.path || projectPath;
      const newPath = `${parentPath}/${newItemName}`;

      if (creatingNode.type === "folder") {
        await invoke("fs_create_folder", { path: newPath });
      } else {
        await invoke("fs_create_file", { path: newPath });
      }

      // Reload the parent directory
      const depth = creatingNode.parent?.depth ?? -1;
      const newNodes = await loadDirectory(parentPath, depth + 1);

      if (!creatingNode.parent) {
        // Creating at root level
        setRootNodes(newNodes);
      } else {
        // Update parent's children
        const updateParentChildren = (nodes: TreeNode[]): TreeNode[] => {
          return nodes.map((n) => {
            if (n.path === parentPath) {
              return { ...n, children: newNodes, isExpanded: true };
            }
            if (n.children) {
              return { ...n, children: updateParentChildren(n.children) };
            }
            return n;
          });
        };
        setRootNodes(updateParentChildren(rootNodes));
      }
    } catch (error) {
      console.error("Failed to create:", error);
      alert(`Failed to create: ${error}`);
    }

    setCreatingNode(null);
    setNewItemName("");
  };

  const handleCreateCancel = () => {
    setCreatingNode(null);
    setNewItemName("");
  };

  // Render tree node
  const renderNode = (node: TreeNode) => {
    const iconConfig = getFileIcon(node.name, node.is_directory);
    const Icon = node.is_directory ? Folder : iconConfig.icon;
    const iconColor = node.is_directory ? "var(--ui-foreground)" : iconConfig.color;
    const hasChildren = node.is_directory;
    const isExpanded = node.isExpanded;

    const handleNodeClick = () => {
      if (node.is_directory) {
        toggleDirectory(node);
      } else {
        // Open file preview
        onFileClick?.(node.path, node.name);
      }
    };

    return (
      <div key={node.path}>
        <div
          className="group flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-white/5 transition-colors"
          style={{
            paddingLeft: `${node.depth * 12 + 8}px`,
          }}
          onClick={handleNodeClick}
          onContextMenu={(e) => handleContextMenu(e, node)}
        >
          {/* Expand/Collapse Icon */}
          {hasChildren && (
            <div className="flex-shrink-0">
              {isExpanded ? (
                <ChevronDown className="size-3.5" style={{ color: "var(--ui-foreground)", opacity: 0.7 }} />
              ) : (
                <ChevronRight className="size-3.5" style={{ color: "var(--ui-foreground)", opacity: 0.7 }} />
              )}
            </div>
          )}
          {!hasChildren && <div className="w-3.5" />}

          {/* File/Folder Icon */}
          <Icon
            className="size-4 flex-shrink-0"
            style={{ color: iconColor, opacity: node.is_directory ? 0.7 : 0.9 }}
          />

          {/* File Name or Rename Input */}
          {renamingNode?.path === node.path ? (
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleRenameSubmit();
                } else if (e.key === "Escape") {
                  handleRenameCancel();
                }
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              className="text-sm flex-1 px-1 rounded"
              style={{
                backgroundColor: "var(--ui-button-background)",
                color: "var(--ui-foreground)",
                border: "1px solid var(--ui-border)",
                outline: "none",
              }}
            />
          ) : (
            <span
              className="text-sm truncate flex-1"
              style={{ color: "var(--ui-foreground)" }}
              title={node.name}
            >
              {node.name}
            </span>
          )}

          {/* More Options */}
          <button
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-all"
            onClick={(e) => {
              e.stopPropagation();
              handleContextMenu(e, node);
            }}
            style={{ color: "var(--ui-foreground)" }}
          >
            <MoreVertical className="size-3" />
          </button>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && node.children && (
          <div>
            {node.children.map((child) => renderNode(child))}
            {/* New item input */}
            {creatingNode?.parent?.path === node.path && (
              <div
                className="flex items-center gap-1 px-2 py-1"
                style={{
                  paddingLeft: `${(node.depth + 1) * 12 + 8}px`,
                }}
              >
                <div className="w-3.5" />
                {creatingNode.type === "folder" ? (
                  <Folder className="size-4 flex-shrink-0" style={{ color: "var(--ui-foreground)", opacity: 0.7 }} />
                ) : (
                  <FileIcon className="size-4 flex-shrink-0" style={{ color: "var(--ui-foreground)", opacity: 0.7 }} />
                )}
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onBlur={handleCreateSubmit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleCreateSubmit();
                    } else if (e.key === "Escape") {
                      handleCreateCancel();
                    }
                    e.stopPropagation();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  placeholder={creatingNode.type === "folder" ? "Folder name" : "File name"}
                  className="text-sm flex-1 px-1 rounded"
                  style={{
                    backgroundColor: "var(--ui-button-background)",
                    color: "var(--ui-foreground)",
                    border: "1px solid var(--ui-border)",
                    outline: "none",
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div
        className={`overflow-y-auto ${className}`}
        onContextMenu={(e) => {
          // Check if clicking on empty space (not on a node)
          const target = e.target as HTMLElement;
          if (target.classList.contains('overflow-y-auto') || target.closest('.py-2') === target) {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, node: null as any });
          }
        }}
      >
        {rootNodes.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-sm" style={{ color: "var(--ui-foreground)", opacity: 0.7 }}>
              No files found
            </span>
          </div>
        ) : (
          <div className="py-2">
            {rootNodes.map((node) => renderNode(node))}
            {/* New item input at root level */}
            {creatingNode?.parent === null && (
              <div className="flex items-center gap-1 px-2 py-1" style={{ paddingLeft: "8px" }}>
                <div className="w-3.5" />
                {creatingNode.type === "folder" ? (
                  <Folder className="size-4 flex-shrink-0" style={{ color: "var(--ui-foreground)", opacity: 0.7 }} />
                ) : (
                  <FileIcon className="size-4 flex-shrink-0" style={{ color: "var(--ui-foreground)", opacity: 0.7 }} />
                )}
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onBlur={handleCreateSubmit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleCreateSubmit();
                    } else if (e.key === "Escape") {
                      handleCreateCancel();
                    }
                    e.stopPropagation();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  placeholder={creatingNode.type === "folder" ? "Folder name" : "File name"}
                  className="text-sm flex-1 px-1 rounded"
                  style={{
                    backgroundColor: "var(--ui-button-background)",
                    color: "var(--ui-foreground)",
                    border: "1px solid var(--ui-border)",
                    outline: "none",
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 py-1 rounded-lg shadow-lg"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            backgroundColor: "var(--ui-background)",
            border: "1px solid var(--ui-border)",
            minWidth: "200px",
          }}
        >
          {contextMenu.node ? (
            <>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
                style={{ color: "var(--ui-foreground)" }}
                onClick={() => handleOpenInTerminal(contextMenu.node)}
              >
                <Terminal className="size-4" />
                Open in Terminal
              </button>
              {contextMenu.node.is_directory && (
                <>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
                    style={{ color: "var(--ui-foreground)" }}
                    onClick={() => handleNewFile(contextMenu.node)}
                  >
                    <FilePlus className="size-4" />
                    New File
                  </button>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
                    style={{ color: "var(--ui-foreground)" }}
                    onClick={() => handleNewFolder(contextMenu.node)}
                  >
                    <FolderPlus className="size-4" />
                    New Folder
                  </button>
                </>
              )}
              <div className="h-px my-1" style={{ backgroundColor: "var(--ui-border)" }} />
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
                style={{ color: "var(--ui-foreground)" }}
                onClick={() => handleCopyPath(contextMenu.node)}
              >
                <Copy className="size-4" />
                Copy Path
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
                style={{ color: "var(--ui-foreground)" }}
                onClick={() => handleCopyRelativePath(contextMenu.node)}
              >
                <Copy className="size-4" />
                Copy Relative Path
              </button>
              <div className="h-px my-1" style={{ backgroundColor: "var(--ui-border)" }} />
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
                style={{ color: "var(--ui-foreground)" }}
                onClick={() => handleRevealInFinder(contextMenu.node)}
              >
                <ExternalLink className="size-4" />
                Reveal in Finder
              </button>
              <div className="h-px my-1" style={{ backgroundColor: "var(--ui-border)" }} />
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
                style={{ color: "var(--ui-foreground)" }}
                onClick={() => handleRename(contextMenu.node)}
              >
                <Edit3 className="size-4" />
                Rename
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors text-red-500"
                onClick={() => handleDelete(contextMenu.node)}
              >
                <Trash2 className="size-4" />
                Delete
              </button>
            </>
          ) : (
            <>
              {/* Root level context menu */}
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
                style={{ color: "var(--ui-foreground)" }}
                onClick={() => handleNewFile(null)}
              >
                <FilePlus className="size-4" />
                New File
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
                style={{ color: "var(--ui-foreground)" }}
                onClick={() => handleNewFolder(null)}
              >
                <FolderPlus className="size-4" />
                New Folder
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
