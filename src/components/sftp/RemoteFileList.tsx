import { useState, useEffect } from "react";
import { ChevronRight, RefreshCw, FolderPlus, ArrowUp, List, Grid } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { sftpReaddir, sftpMkdir, sftpUpload, sftpDownload, type RemoteFileEntry } from "@/lib/tauri-ssh";
import { getFileIcon } from "@/lib/file-icons";
import { formatBytes, formatDate } from "@/lib/utils";
import { RemoteFileRow } from "./RemoteFileRow";

interface RemoteFileListProps {
  sessionId: string;
  currentPath: string;
  onPathChange: (path: string) => void;
  selectedFiles: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
  onOpenInTerminal?: (path: string) => void;
}

export function RemoteFileList({
  sessionId,
  currentPath,
  onPathChange,
  selectedFiles,
  onSelectionChange,
  onOpenInTerminal,
}: RemoteFileListProps) {
  const [files, setFiles] = useState<RemoteFileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "size" | "modified">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // Make the entire remote panel a drop zone for local files
  const { setNodeRef, isOver } = useDroppable({
    id: `remote-panel-${currentPath}`,
    data: {
      type: "remote-directory",
      path: currentPath,
      sessionId,
    },
  });

  // Load directory contents
  const loadDirectory = async (path: string) => {
    setLoading(true);
    try {
      const entries = await sftpReaddir(sessionId, path);
      setFiles(entries);
      onSelectionChange(new Set()); // Clear selection when changing directory
    } catch (error) {
      console.error("Failed to read directory:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory(currentPath);
  }, [sessionId, currentPath]);

  // Navigate to parent directory
  const goUp = () => {
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    const newPath = "/" + parts.join("/");
    onPathChange(newPath || "/");
  };

  // Navigate to directory
  const navigateTo = (path: string) => {
    onPathChange(path);
  };

  // Handle double click
  const handleDoubleClick = (file: RemoteFileEntry) => {
    if (file.isDir) {
      navigateTo(file.path);
    } else {
      // TODO: Preview or download
      console.log("Open file:", file.path);
    }
  };

  // Handle file selection
  const handleFileClick = (file: RemoteFileEntry, event: React.MouseEvent) => {
    const isMultiSelect = event.metaKey || event.ctrlKey;

    if (isMultiSelect) {
      const newSelection = new Set(selectedFiles);
      if (newSelection.has(file.path)) {
        newSelection.delete(file.path);
      } else {
        newSelection.add(file.path);
      }
      onSelectionChange(newSelection);
    } else {
      onSelectionChange(new Set([file.path]));
    }
  };

  // Sort files
  const sortedFiles = [...files].sort((a, b) => {
    // Directories first
    if (a.isDir !== b.isDir) {
      return a.isDir ? -1 : 1;
    }

    let comparison = 0;
    switch (sortBy) {
      case "name":
        comparison = a.name.localeCompare(b.name);
        break;
      case "size":
        comparison = a.size - b.size;
        break;
      case "modified":
        comparison = (a.modified || 0) - (b.modified || 0);
        break;
    }

    return sortOrder === "asc" ? comparison : -comparison;
  });

  // Parse path into breadcrumbs
  const pathParts = currentPath.split("/").filter(Boolean);
  const breadcrumbs = [
    { name: "/", path: "/" },
    ...pathParts.map((part, index) => ({
      name: part,
      path: "/" + pathParts.slice(0, index + 1).join("/"),
    })),
  ];

  return (
    <div
      ref={setNodeRef}
      className="h-full flex flex-col"
      style={{
        outline: isOver ? "2px solid #3b82f6" : "none",
        outlineOffset: "-2px",
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-2 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--ui-border)" }}
      >
   <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Breadcrumb navigation */}
          <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.path} className="flex items-center gap-1">
                {index > 0 && (
                  <ChevronRight className="size-3" style={{ color: "var(--ui-muted-foreground)" }} />
                )}
                <button
                  onClick={() => navigateTo(crumb.path)}
                  className="text-xs px-1 py-0.5 rounded hover:bg-white/10 transition-colors truncate"
                  style={{ color: "var(--ui-foreground)" }}
                >
                  {crumb.name}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1">
          <button
            onClick={goUp}
            disabled={currentPath === "/"}
            className="p-1 rounded hover:bg-white/10 transition-colors disabled:opacity-50"
            style={{ color: "var(--ui-foreground)" }}
            title="Parent directory"
          >
            <ArrowUp className="size-4" />
          </button>

          <button
            onClick={() => loadDirectory(currentPath)}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            style={{ color: "var(--ui-foreground)" }}
            title="Refresh"
          >
            <RefreshCw className="size-4" />
          </button>

          <button
            onClick={() => {
              const name = prompt("New folder name:");
              if (name) {
                const newPath = currentPath.endsWith("/")
                  ? `${currentPath}${name}`
                  : `${currentPath}/${name}`;
                sftpMkdir(sessionId, newPath)
                  .then(() => loadDirectory(currentPath))
                  .catch(console.error);
              }
            }}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            style={{ color: "var(--ui-foreground)" }}
            title="New folder"
          >
            <FolderPlus className="size-4" />
          </button>

          <button
            onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            style={{ color: "var(--ui-foreground)" }}
            title="Toggle view"
          >
            {viewMode === "list" ? <Grid className="size-4" /> : <List className="size-4" />}
          </button>
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm" style={{ color: "var(--ui-muted-foreground)" }}>
              Loading...
            </div>
          </div>
        ) : viewMode === "list" ? (
          <table className="w-full text-sm">
            <thead>
              <tr
                className="sticky top-0"
                style={{
                  backgroundColor: "var(--ui-background)",
                  borderBottom: "1px solid var(--ui-border)",
                }}
              >
                <th
                  className="text-left px-4 py-2 cursor-pointer hover:bg-white/5"
                  onClick={() => {
                    if (sortBy === "name") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("name");
                      setSortOrder("asc");
                    }
                  }}
                  style={{ color: "var(--ui-muted-foreground)" }}
                >
                  Name {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="text-right px-4 py-2 cursor-pointer hover:bg-white/5"
                  onClick={() => {
                    if (sortBy === "size") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("size");
                      setSortOrder("asc");
                    }
                  }}
                  style={{ color: "var(--ui-muted-foreground)" }}
                >
                  Size {sortBy === "size" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="text-left px-4 py-2 cursor-pointer hover:bg-white/5"
                  onClick={() => {
                    if (sortBy === "modified") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("modified");
                      setSortOrder("asc");
                    }
                  }}
                  style={{ color: "var(--ui-muted-foreground)" }}
                >
                  Modified {sortBy === "modified" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="text-left px-4 py-2"
                  style={{ color: "var(--ui-muted-foreground)" }}
                >
                  Permissions
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedFiles.map((file) => (
                <RemoteFileRow
                  key={file.path}
                  file={file}
                  sessionId={sessionId}
                  isSelected={selectedFiles.has(file.path)}
                  onClick={(e) => handleFileClick(file, e)}
                  onDoubleClick={() => handleDoubleClick(file)}
                  onOpenInTerminal={onOpenInTerminal}
                />
              ))}
            </tbody>
          </table>
        ) : (
          <div className="grid grid-cols-4 gap-4 p-4">
            {sortedFiles.map((file) => {
              const Icon = getFileIcon(file.name, file.isDir);
              const isSelected = selectedFiles.has(file.path);
              return (
                <div
                  key={file.path}
                  className="flex flex-col items-center gap-2 p-4 rounded hover:bg-white/5 cursor-pointer"
                  style={{
                    backgroundColor: isSelected ? "rgba(59, 130, 246, 0.2)" : undefined,
                  }}
                  onClick={(e) => handleFileClick(file, e)}
                  onDoubleClick={() => handleDoubleClick(file)}
                >
                  <Icon className="size-8" style={{ color: "var(--ui-muted-foreground)" }} />
                  <span
                    className="text-xs text-center truncate w-full"
                    style={{ color: "var(--ui-foreground)" }}
                  >
                    {file.name}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
