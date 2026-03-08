import { useState, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { FilePanel } from "./FilePanel";
import { TransferQueue } from "./TransferQueue";
import { FileConflictDialog } from "./FileConflictDialog";
import {
  sftpOpen,
  sftpClose,
  sftpUpload,
  sftpDownload,
  sftpStat,
  sftpMkdir,
  type RemoteFileEntry,
  type TransferProgress,
} from "@/lib/tauri-ssh";
import { listen } from "@tauri-apps/api/event";
import { File } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface SftpPanelProps {
  connectionId: string;
  hostLabel: string;
  projectPath: string;
  onClose?: () => void;
  onOpenInTerminal?: (path: string) => void;
}

export function SftpPanel({
  connectionId,
  hostLabel,
  projectPath,
  onClose,
  onOpenInTerminal,
}: SftpPanelProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [splitRatio, setSplitRatio] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const [transfers, setTransfers] = useState<Map<string, TransferProgress>>(new Map());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<{
    type: "local" | "remote";
    name: string;
    count: number;
  } | null>(null);
  const [localPath, setLocalPath] = useState(projectPath);
  const [remotePath, setRemotePath] = useState("/");
  const [conflictDialog, setConflictDialog] = useState<{
    open: boolean;
    fileName: string;
    showApplyToAll: boolean;
    onResolve: (action: "overwrite" | "skip", applyToAll: boolean) => void;
  }>({ open: false, fileName: "", showApplyToAll: false, onResolve: () => {} });
  const [localRefreshTrigger, setLocalRefreshTrigger] = useState(0);
  const [remoteRefreshTrigger, setRemoteRefreshTrigger] = useState(0);

  // Handle transfer removal
  const handleRemoveTransfer = (transferId: string) => {
    setTransfers((prev) => {
      const next = new Map(prev);
      next.delete(transferId);
      return next;
    });
  };

  // Handle clear completed transfers
  const handleClearCompleted = () => {
    setTransfers((prev) => {
      const next = new Map(prev);
      Array.from(next.entries()).forEach(([id, transfer]) => {
        if (transfer.bytesTransferred >= transfer.totalBytes) {
          next.delete(id);
        }
      });
      return next;
    });
  };

  // Handle clear all transfers
  const handleClearAll = () => {
    setTransfers(new Map());
  };

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Open SFTP session
  useEffect(() => {
    let mounted = true;

    const openSession = async () => {
      try {
        const sid = await sftpOpen(connectionId);
        if (mounted) {
          setSessionId(sid);

          // Force a layout recalculation after session opens
          setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
          }, 16);
        }
      } catch (error) {
        console.error("[SftpPanel] Failed to open SFTP session:", error);
      }
    };

    openSession();

    return () => {
      mounted = false;
      if (sessionId) {
        sftpClose(sessionId).catch(console.error);
      }
    };
  }, [connectionId]);

  // Listen for transfer progress events
  useEffect(() => {
    const unlisten = listen<TransferProgress>("sftp-progress", (event) => {
      setTransfers((prev) => {
        const next = new Map(prev);
        next.set(event.payload.transferId, event.payload);
        return next;
      });
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Handle resize
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = document.getElementById("sftp-container");
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const newRatio = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitRatio(Math.max(20, Math.min(80, newRatio)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);

    const data = event.active.data.current;
    if (data?.type === "remote-file") {
      const file = data.file as RemoteFileEntry;
      setDraggedItem({
        type: "remote",
        name: file.name,
        count: data.selectedCount || 1,
      });
    } else if (data?.type === "local-file") {
      setDraggedItem({
        type: "local",
        name: data.name as string,
        count: data.selectedCount || 1,
      });
    }
  };

  // Handle upload (local -> remote) - supports files and directories
  const handleUpload = async (localFilePath: string, fileName: string, isDirectory: boolean = false) => {
    if (!sessionId) return;

    if (isDirectory) {
      // Upload directory recursively
      await uploadDirectory(localFilePath, fileName);
    } else {
      // Upload single file
      await uploadFile(localFilePath, fileName);
    }
  };

  // Upload single file
  const uploadFile = async (localFilePath: string, fileName: string, conflictAction?: "overwrite" | "skip") => {
    if (!sessionId) return;

    const remoteFilePath = remotePath.endsWith("/")
      ? `${remotePath}${fileName}`
      : `${remotePath}/${fileName}`;

    try {
      // Check if file exists on remote (unless we already have a conflict action)
      if (!conflictAction) {
        const exists = await sftpStat(sessionId, remoteFilePath)
          .then(() => true)
          .catch(() => false);

        if (exists) {
          // Show conflict dialog
          return new Promise<void>((resolve) => {
            setConflictDialog({
              open: true,
              fileName,
              showApplyToAll: false,
              onResolve: async (action) => {
                if (action === "overwrite") {
                  await sftpUpload(sessionId, localFilePath, remoteFilePath);
                  console.log(`Uploaded ${fileName} to ${remoteFilePath}`);
                }
                resolve();
              },
            });
          });
        }
      } else if (conflictAction === "skip") {
        console.log(`Skipped ${fileName}`);
        return;
      }

      // Upload directly
      await sftpUpload(sessionId, localFilePath, remoteFilePath);
      console.log(`Uploaded ${fileName} to ${remoteFilePath}`);
    } catch (error) {
      console.error("Upload failed:", error);
      throw error;
    }
  };

  // Upload directory recursively with conflict detection
  const uploadDirectory = async (localDirPath: string, dirName: string) => {
    if (!sessionId) return;

    const remoteDirPath = remotePath.endsWith("/")
      ? `${remotePath}${dirName}`
      : `${remotePath}/${dirName}`;

    try {
      // Check if remote directory exists
      const remoteDirExists = await sftpStat(sessionId, remoteDirPath)
        .then(() => true)
        .catch(() => false);

      let conflictAction: "overwrite" | "skip" | null = null;
      let applyToAll = false;

      if (remoteDirExists) {
        // Show conflict dialog for the directory
        const result = await new Promise<{ action: "overwrite" | "skip"; applyToAll: boolean }>((resolve) => {
          setConflictDialog({
            open: true,
            fileName: dirName,
            showApplyToAll: true,
            onResolve: (action, apply) => {
              resolve({ action, applyToAll: apply });
            },
          });
        });

        if (result.action === "skip") {
          console.log(`Skipped directory ${dirName}`);
          return;
        }

        conflictAction = result.action;
        applyToAll = result.applyToAll;
      }

      // Create remote directory
      await sftpMkdir(sessionId, remoteDirPath).catch(() => {
        // Directory might already exist, ignore error
      });

      // Read local directory contents
      const entries = await invoke<Array<{
        name: string;
        path: string;
      is_directory: boolean;
      }>>("read_directory", { path: localDirPath });

      // Upload all files in directory
      for (const entry of entries) {
        if (entry.is_directory) {
          // Recursively upload subdirectory
          await uploadDirectoryRecursive(
            sessionId,
            entry.path,
            entry.name,
            remoteDirPath,
            conflictAction,
            applyToAll
          );
        } else {
          // Upload file
          const localFilePath = entry.path;
          const remoteFilePath = remoteDirPath.endsWith("/")           ? `${remoteDirPath}${entry.name}`
            : `${remoteDirPath}/${entry.name}`;

          // Check for conflicts
          if (!applyToAll || !conflictAction) {
            const exists = await sftpStat(sessionId, remoteFilePath)
              .then(() => true)
              .catch(() => false);

            if (exists) {
              const result = await new Promise<{ action: "overwrite" | "skip"; applyToAll: boolean }>((resolve) => {
                setConflictDialog({
                  open: true,
                  fileName: `${dirName}/${entry.name}`,
                  showApplyToAll: true,
                  onResolve: (action, apply) => {
                    resolve({ action, applyToAll: apply });
                  },
                });
              });

              if (result.applyToAll) {
                conflictAction = result.action;
                applyToAll = true;
              }

              if (result.action === "skip") {
                continue;
              }
            }
          } else if (conflictAction === "skip") {
            continue;
          }

          await sftpUpload(sessionId, localFilePath, remoteFilePath);
        }
      }

      console.log(`Uploaded directory ${dirName} to ${remoteDirPath}`);
      setRemoteRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("Directory upload failed:", error);
      alert(`Failed to upload directory ${dirName}: ${error}`);
    }
  };

  // Helper function for recursive directory upload
  const uploadDirectoryRecursive = async (
    sessionId: string,
    localDirPath: string,
    dirName: string,
    parentRemotePath: string,
    conflictAction: "overwrite" | "skip" | null,
    applyToAll: boolean
  ) => {
    const remoteDirPath = parentRemotePath.endsWith("/")
      ? `${parentRemotePath}${dirName}`
      : `${parentRemotePath}/${dirName}`;

    // Create remote directory
    await sftpMkdir(sessionId, remoteDirPath).catch(() => {});

    // Read local directory contents
    const entries = await invoke<Array<{
      name: string;
      path: string;
      is_directory: boolean;
    }>>("read_directory", { path: localDirPath });

    for (const entry of entries) {
      if (entry.is_directory) {
        // Recursively upload subdirectory
        await uploadDirectoryRecursive(
          sessionId,
          entry.path,
          entry.name,
          remoteDirPath,
          conflictAction,
          applyToAll
        );
      } else {
        // Upload file
        const localFilePath = entry.path;
        const remoteFilePath = remoteDirPath.endsWith("/")
          ? `${remoteDirPath}${entry.name}`
          : `${remoteDirPath}/${entry.name}`;

        // Check for conflicts
        if (!applyToAll || !conflictAction) {
          const exists = await sftpStat(sessionId, remoteFilePath)
            .then(() => true)
            .catch(() => false);

          if (exists) {
            const result = await new Promise<{ action: "overwrite" | "skip"; applyToAll: boolean }>((resolve) => {
              setConflictDialog({
                open: true,
                fileName: `${dirName}/${entry.name}`,
                showApplyToAll: true,
                onResolve: (action, apply) => {
                  resolve({ action, applyToAll: apply });
                },
              });
            });

            if (result.applyToAll) {
              conflictAction = result.action;
              applyToAll = true;
            }

            if (result.action === "skip") {
              continue;
            }
          }
        } else if (conflictAction === "skip") {
          continue;
        }

        await sftpUpload(sessionId, localFilePath, remoteFilePath);
      }
    }
  };

  // Handle download (remote -> local)
  const handleDownload = async (remoteFilePath: string, fileName: string) => {
    if (!sessionId) return;

    const localFilePath = localPath.endsWith("/")
      ? `${localPath}${fileName}`
      : `${localPath}/${fileName}`;

    try {
      // Check if file exists locally
      const exists = await invoke<boolean>("fs_exists", { path: localFilePath });

      if (exists) {
        // Show conflict dialog
        return new Promise<void>((resolve) => {
          setConflictDialog({
            open: true,
            fileName,
            showApplyToAll: false,
            onResolve: async (action) => {
              if (action === "overwrite") {
                await sftpDownload(sessionId, remoteFilePath, localFilePath);
                console.log(`Downloaded ${fileName} to ${localFilePath}`);
                setLocalRefreshTrigger((prev) => prev + 1);
              }
              resolve();
            },
          });
        });
      } else {
        // Download directly
        await sftpDownload(sessionId, remoteFilePath, localFilePath);
        console.log(`Downloaded ${fileName} to ${localFilePath}`);
        setLocalRefreshTrigger((prev) => prev + 1);
      }
    } catch (error) {
      console.error("Download failed:", error);
      alert(`Failed to download ${fileName}: ${error}`);
    }
  };

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    setDraggedItem(null);

    const { active, over } = event;
    if (!over || !sessionId) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Remote file -> Local directory (Download)
    if (activeData?.type === "remote-file" && overData?.type === "local-drop-zone") {
      const files = activeData.files as RemoteFileEntry[];
      const localDir = overData.path as string;

      for (const file of files) {
        if (!file.isDir) {
          const localPath = `${localDir}/${file.name}`;
          try {
            await sftpDownload(sessionId, file.path, localPath);
            console.log(`Downloading ${file.name} to ${localPath}`);
          } catch (error) {
            console.error("Download failed:", error);
          }
        }
      }
    }

    // Local file -> Remote directory (Upload)
    if (activeData?.type === "local-file" && overData?.type === "remote-drop-zone") {
      const files = activeData.files as Array<{ path: string; name: string }>;
      const remotePath = overData.path as string;

      for (const file of files) {
        const remoteFilePath = remotePath.endsWith("/")
          ? `${remotePath}${file.name}`
          : `${remotePath}/${file.name}`;

        try {
          await sftpUpload(sessionId, file.path, remoteFilePath);
          console.log(`Uploading ${file.name} to ${remoteFilePath}`);
        } catch (error) {
          console.error("Upload failed:", error);
        }
      }
    }
  };

  if (!sessionId) {
    return (
      <div
        id="sftp-container"
        className="flex flex-col h-full bg-[var(--ui-background)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--ui-border)]">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--ui-foreground)]">
              SFTP: {hostLabel}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onClose && (
              <button
                onClick={onClose}
                className="px-2 py-1 text-xs rounded hover:bg-white/10 transition-colors text-[var(--ui-foreground)]"
              >
                Close
              </button>
            )}
          </div>
        </div>

        {/* Loading state */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-sm text-[var(--ui-muted-foreground)]">
            Opening SFTP session...
          </div>
        </div>

        {/* Transfer queue placeholder */}
        <TransferQueue transfers={[]} />
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div
        id="sftp-container"
        className="flex flex-col h-full bg-[var(--ui-background)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--ui-border)]">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--ui-foreground)]">
              SFTP: {hostLabel}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onClose && (
              <button
                onClick={onClose}
                className="px-2 py-1 text-xs rounded hover:bg-white/10 transition-colors text-[var(--ui-foreground)]"
              >
                Close
              </button>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Local panel */}
          <div style={{ width: `${splitRatio}%` }} className="flex flex-col overflow-hidden">
            <FilePanel
              type="local"
              title="Local"
              initialPath={projectPath}
              sessionId={null}
              onPathChange={setLocalPath}
              onUploadFile={handleUpload}
              onRefreshTrigger={localRefreshTrigger}
            />
          </div>

          {/* Resize handle */}
          <div
            className="w-1 cursor-col-resize hover:bg-blue-500 transition-colors bg-[var(--ui-border)] flex-shrink-0"
            onMouseDown={() => setIsResizing(true)}
          />

          {/* Remote panel */}
          <div style={{ width: `${100 - splitRatio}%` }} className="flex flex-col overflow-hidden">
            <FilePanel
              type="remote"
              title="Remote"
              initialPath="/"
              sessionId={sessionId}
              onOpenInTerminal={onOpenInTerminal}
              onPathChange={setRemotePath}
              onDownloadFile={handleDownload}
              onRefreshTrigger={remoteRefreshTrigger}
            />
          </div>
        </div>

        {/* Transfer queue */}
        <TransferQueue
          transfers={Array.from(transfers.values())}
          onRemoveTransfer={handleRemoveTransfer}
          onClearCompleted={handleClearCompleted}
          onClearAll={handleClearAll}
        />
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeId && draggedItem && (
          <div className="flex items-center gap-2 px-3 py-2 rounded shadow-lg bg-[var(--ui-background)] border border-[var(--ui-border)]">
            <File className="size-4 text-[var(--ui-muted-foreground)]" />
            <span className="text-sm text-[var(--ui-foreground)]">
              {draggedItem.count === 1
                ? draggedItem.name
                : `${draggedItem.count} files`}
            </span>
          </div>
        )}
      </DragOverlay>

      {/* File Conflict Dialog */}
      <FileConflictDialog
        open={conflictDialog.open}
        onOpenChange={(open) => setConflictDialog({ ...conflictDialog, open })}
        fileName={conflictDialog.fileName}
        showApplyToAll={conflictDialog.showApplyToAll}
        onConfirm={conflictDialog.onResolve}
      />
    </DndContext>
  );
}
