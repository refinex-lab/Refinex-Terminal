import { useState, useEffect } from "react";
import {
  ChevronRight,
  RefreshCw,
  FolderPlus,
  Upload,
  Download,
  Trash2,
  List,
  Grid,
} from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { sftpReaddir, sftpMkdir, sftpRemove, sftpRemoveRecursive } from "@/lib/tauri-ssh";
import { invoke } from "@tauri-apps/api/core";
import { FileRow } from "./FileRow";
import { DeleteFileDialog } from "./DeleteFileDialog";
import { CreateFolderDialog } from "./CreateFolderDialog";

interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modified: number;
}

interface FilePanelProps {
  type: "local" | "remote";
  title: string;
  initialPath: string;
  sessionId: string | null;
  onOpenInTerminal?: (path: string) => void | undefined;
  onPathChange?: (path: string) => void;
  onUploadFile?: (localPath: string, fileName: string, isDirectory: boolean) => Promise<void>;
  onDownloadFile?: (remotePath: string, fileName: string) => Promise<void>;
  onRefreshTrigger?: number;
}

type ViewMode = "list" | "grid";
type SortBy = "name" | "size" | "modified";

export function FilePanel({
  type,
  title,
  initialPath,
  sessionId,
  onOpenInTerminal,
  onPathChange,
  onUploadFile,
  onDownloadFile,
  onRefreshTrigger,
}: FilePanelProps) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    files: FileEntry[];
  }>({ open: false, files: [] });
  const [createFolderDialog, setCreateFolderDialog] = useState(false);

  // Notify parent of path changes
  useEffect(() => {
    if (onPathChange) {
      onPathChange(currentPath);
    }
  }, [currentPath, onPathChange]);

  // Refresh when trigger changes
  useEffect(() => {
    if (onRefreshTrigger !== undefined) {
      loadDirectory(currentPath);
    }
  }, [onRefreshTrigger]);

  // Make panel a drop zone
  const { setNodeRef, isOver } = useDroppable({
    id: `${type}-drop-zone-${currentPath}`,
    data: {
      type: `${type}-drop-zone`,
      path: currentPath,
      sessionId: type === "remote" ? sessionId : null,
    },
  });

  // Load directory contents
  const loadDirectory = async (path: string) => {
    setLoading(true);
    try {
      if (type === "local") {
        const entries = await invoke<Array<{
          name: string;
          path: string;
          is_directory: boolean;
          size: number;
          modified: number;
        }>>("read_directory", { path });

        setFiles(
          entries.map((e) => ({
            name: e.name,
            path: e.path,
            isDir: e.is_directory,
            size: e.size,
            modified: e.modified,
          }))
        );
      } else if (sessionId) {
        const entries = await sftpReaddir(sessionId, path);
        console.log("[FilePanel] Remote entries:", entries);
        setFiles(
          entries.map((e) => ({
            name: e.name,
            path: e.path,
            isDir: e.isDir,
            size: e.size,
            modified: e.modified || 0,
          }))
        );
      }
      setSelectedFiles(new Set());
    } catch (error) {
      console.error(`[FilePanel] Failed to read ${type} directory:`, error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath, sessionId, type]);

  // Navigate to directory
  const navigateTo = (path: string) => {
    setCurrentPath(path);
  };

  // Handle double click
  const handleDoubleClick = (file: FileEntry) => {
    if (file.isDir) {
      navigateTo(file.path);
    }
  };

  // Handle file selection
  const handleFileClick = (file: FileEntry, event: React.MouseEvent) => {
    const isMultiSelect = event.metaKey || event.ctrlKey;

    if (isMultiSelect) {
      const newSelection = new Set(selectedFiles);
      if (newSelection.has(file.path)) {
        newSelection.delete(file.path);
      } else {
        newSelection.add(file.path);
      }
      setSelectedFiles(newSelection);
    } else {
      setSelectedFiles(new Set([file.path]));
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
        comparison = a.modified - b.modified;
        break;
    }

    return sortOrder === "asc" ? comparison : -comparison;
  });

  // Parse path into breadcrumbs
  const pathParts = currentPath.split("/").filter(Boolean);
  const breadcrumbs = [
    { name: type === "local" ? "~" : "/", path: type === "local" ? initialPath : "/", id: "root" },
    ...pathParts.map((part, index) => ({
      name: part,
      path: "/" + pathParts.slice(0, index + 1).join("/"),
      id: `breadcrumb-${index}-${part}`,
    })),
  ];

  // Handle create folder
  const handleCreateFolder = () => {
    setCreateFolderDialog(true);
  };

  const handleConfirmCreateFolder = async (name: string) => {
    const newPath = currentPath.endsWith("/")
      ? `${currentPath}${name}`
      : `${currentPath}/${name}`;

    try {
      if (type === "remote" && sessionId) {
        await sftpMkdir(sessionId, newPath);
      } else {
        // Local folder creation
        await invoke("fs_create_folder", { path: newPath });
      }
      await loadDirectory(currentPath);
    } catch (error) {
      console.error("Failed to create folder:", error);
      alert(`Failed to create folder: ${error}`);
    }
  };

  // Handle upload selected files (local -> remote)
  const handleUploadSelected = async () => {
    if (selectedFiles.size === 0 || type !== "local" || !onUploadFile) return;

    const filesToUpload = Array.from(selectedFiles)
      .map((path) => files.find((f) => f.path === path))
      .filter((f): f is FileEntry => f !== undefined);

    if (filesToUpload.length === 0) {
      alert("Please select files or directories to upload");
      return;
    }

    for (const file of filesToUpload) {
      await onUploadFile(file.path, file.name, file.isDir);
    }
  };

  // Handle download selected files (remote -> local)
  const handleDownloadSelected = async () => {
    if (selectedFiles.size === 0 || type !== "remote" || !onDownloadFile) return;

    const filesToDownload = Array.from(selectedFiles)
      .map((path) => files.find((f) => f.path === path))
      .filter((f): f is FileEntry => f !== undefined && !f.isDir);

    if (filesToDownload.length === 0) {
      alert("Please select files to download (directories are not supported yet)");
      return;
    }

    for (const file of filesToDownload) {
      await onDownloadFile(file.path, file.name);
    }
  };

  // Handle delete single file
  const handleDeleteFile = (file: FileEntry) => {
    setDeleteDialog({ open: true, files: [file] });
  };

  // Handle delete selected files
  const handleDeleteSelected = () => {
    if (selectedFiles.size === 0) return;

    const filesToDelete = Array.from(selectedFiles)
      .map((path) => files.find((f) => f.path === path))
      .filter((f): f is FileEntry => f !== undefined);

    setDeleteDialog({ open: true, files: filesToDelete });
  };

  // Confirm delete
  const handleConfirmDelete = async () => {
    try {
      for (const file of deleteDialog.files) {
        if (type === "remote" && sessionId) {
          if (file.isDir) {
            await sftpRemoveRecursive(sessionId, file.path);
          } else {
            await sftpRemove(sessionId, file.path);
          }
        } else {
          // Local file deletion
          await invoke("fs_delete", { path: file.path });
        }
      }
      await loadDirectory(currentPath);
      setDeleteDialog({ open: false, files: [] });
    } catch (error) {
      console.error("Failed to delete files:", error);
      alert(`Failed to delete files: ${error}`);
    }
  };

  return (
    <div
      ref={setNodeRef}
      className="h-full flex flex-col bg-[var(--ui-background)]"
      style={{
        outline: isOver ? "2px solid #3b82f6" : "none",
        outlineOffset: "-2px",
      }}
    >
      {/* Header */}
      <div className="px-3 py-2 flex flex-col gap-2 border-b border-[var(--ui-border)]">
        {/* Title */}
        <div className="text-xs font-semibold text-[var(--ui-muted-foreground)]">
          {title}
        </div>

        {/* Breadcrumb navigation */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {breadcrumbs.map((crumb) => (
            <div key={crumb.id} className="flex items-center gap-1 flex-shrink-0">
              {crumb.id !== "root" && (
                <ChevronRight className="size-3 text-[var(--ui-muted-foreground)]" />
              )}
              <button
                onClick={() => navigateTo(crumb.path)}
                className="text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors whitespace-nowrap text-[var(--ui-foreground)]"
                title={crumb.path}
              >
                {crumb.name}
              </button>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadDirectory(currentPath)}
            className="p-1.5 rounded hover:bg-white/10 transition-colors text-[var(--ui-foreground)]"
            title="Refresh"
          >
            <RefreshCw className="size-4" />
          </button>

          <button
            onClick={handleCreateFolder}
            className="p-1.5 rounded hover:bg-white/10 transition-colors text-[var(--ui-foreground)]"
            title="New folder"
          >
            <FolderPlus className="size-4" />
          </button>

          {selectedFiles.size > 0 && (
            <>
              <div className="w-px h-4 bg-[var(--ui-border)]" />

              {type === "remote" && (
                <button
                  onClick={handleDownloadSelected}
                  className="p-1.5 rounded hover:bg-white/10 transition-colors text-[var(--ui-foreground)]"
                  title="Download selected"
                >
                  <Download className="size-4" />
                </button>
              )}

              {type === "local" && (
                <button
                  onClick={handleUploadSelected}
                  className="p-1.5 rounded hover:bg-white/10 transition-colors text-[var(--ui-foreground)]"
                  title="Upload selected"
                >
                  <Upload className="size-4" />
                </button>
              )}

              <button
                onClick={handleDeleteSelected}
                className="p-1.5 rounded hover:bg-white/10 transition-colors text-[var(--ui-foreground)]"
                title="Delete selected"
              >
                <Trash2 className="size-4" />
              </button>
            </>
          )}

          <div className="flex-1" />

          <button
            onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")}
            className="p-1.5 rounded hover:bg-white/10 transition-colors text-[var(--ui-foreground)]"
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
            <div className="text-sm text-[var(--ui-muted-foreground)]">Loading...</div>
          </div>
        ) : viewMode === "list" ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="sticky top-0 bg-[var(--ui-background)] border-b border-[var(--ui-border)]">
                <th
                  className="text-left px-4 py-2 cursor-pointer hover:bg-white/5 text-[var(--ui-muted-foreground)]"
                  style={{ width: "50%" }}
                  onClick={() => {
                    if (sortBy === "name") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("name");
                      setSortOrder("asc");
                    }
                  }}
                >
                  Name {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="text-right px-4 py-2 cursor-pointer hover:bg-white/5 text-[var(--ui-muted-foreground)]"
                  style={{ width: "20%" }}
                  onClick={() => {
                    if (sortBy === "size") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("size");
                      setSortOrder("asc");
                    }
                  }}
                >
                  Size {sortBy === "size" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="text-left px-4 py-2 cursor-pointer hover:bg-white/5 text-[var(--ui-muted-foreground)]"
                  style={{ width: "30%" }}
                  onClick={() => {
                    if (sortBy === "modified") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("modified");
                      setSortOrder("asc");
                    }
                  }}
                >
                  Modified {sortBy === "modified" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedFiles.map((file) => (
                <FileRow
                  key={file.path}
                  file={file}
                  type={type}
                  sessionId={sessionId}
                  isSelected={selectedFiles.has(file.path)}
                  selectedFiles={Array.from(selectedFiles)
                    .map((path) => files.find((f) => f.path === path))
                    .filter((f): f is FileEntry => f !== undefined)}
                  onClick={(e) => handleFileClick(file, e)}
                  onDoubleClick={() => handleDoubleClick(file)}
                  onOpenInTerminal={onOpenInTerminal}
                  onDelete={handleDeleteFile}
                  onUpload={onUploadFile ? (file) => onUploadFile(file.path, file.name, file.isDir) : undefined}
                  onDownload={onDownloadFile ? (file) => onDownloadFile(file.path, file.name) : undefined}
                />
              ))}
            </tbody>
          </table>
        ) : (
          <div className="grid grid-cols-4 gap-4 p-4">
            {sortedFiles.map((file) => {
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
                  <div className="size-8 text-[var(--ui-muted-foreground)]">
                    {/* Icon placeholder */}
                  </div>
                  <span className="text-xs text-center truncate w-full text-[var(--ui-foreground)]">
                    {file.name}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteFileDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}
        files={deleteDialog.files}
        onConfirm={handleConfirmDelete}
      />

      {/* Create Folder Dialog */}
      <CreateFolderDialog
        open={createFolderDialog}
        onOpenChange={setCreateFolderDialog}
        onConfirm={handleConfirmCreateFolder}
      />
    </div>
  );
}
