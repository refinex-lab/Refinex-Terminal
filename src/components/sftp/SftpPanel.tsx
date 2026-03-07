import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { RemoteFileList } from "./RemoteFileList";
import { TransferQueue } from "./TransferQueue";
import { LocalFileList } from "./LocalFileList";
import {
  sftpOpen,
  sftpClose,
  sftpUpload,
  sftpDownload,
  type RemoteFileEntry,
  type TransferProgress,
} from "@/lib/tauri-ssh";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { File } from "lucide-react";

interface SftpPanelProps {
  connectionId: string;
  hostLabel: string;
  projectPath: string;
  onClose?: () => void;
}

export function SftpPanel({ connectionId, hostLabel, projectPath, onClose }: SftpPanelProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState("/");
  const [splitRatio, setSplitRatio] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const [viewMode, setViewMode] = useState<"dual" | "remote">("dual");
  const [transfers, setTransfers] = useState<Map<string, TransferProgress>>(new Map());
  const [selectedRemoteFiles, setSelectedRemoteFiles] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedFiles, setDraggedFiles] = useState<RemoteFileEntry[]>([]);

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
        }
      } catch (error) {
        console.error("Failed to open SFTP session:", error);
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
      // If dragging a selected file, drag all selected files
      const file = data.file as RemoteFileEntry;
      if (selectedRemoteFiles.has(file.path)) {
        // TODO: Get all selected files
        setDraggedFiles([file]);
      } else {
        setDraggedFiles([file]);
      }
    }
  };

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    setDraggedFiles([]);

    const { active, over } = event;
    if (!over || !sessionId) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Remote file -> Local directory (Download)
    if (activeData?.type === "remote-file" && overData?.type === "local-directory") {
      const remoteFile = activeData.file as RemoteFileEntry;
      const localDir = overData.path as string;

      if (!remoteFile.isDir) {
        const localPath = `${localDir}/${remoteFile.name}`;
        try {
          await sftpDownload(sessionId, remoteFile.path, localPath);
          console.log(`Downloading ${remoteFile.name} to ${localPath}`);
        } catch (error) {
          console.error("Download failed:", error);
        }
      }
    }

    // Local file -> Remote directory (Upload)
    if (activeData?.type === "local-file" && overData?.type === "remote-directory") {
      const localPath = activeData.path as string;
      const fileName = activeData.name as string;
      const remotePath = overData.path as string;

      const remoteFilePath = remotePath.endsWith("/")
        ? `${remotePath}${fileName}`
        : `${remotePath}/${fileName}`;

      try {
        await sftpUpload(sessionId, localPath, remoteFilePath);
        console.log(`Uploading ${fileName} to ${remoteFilePath}`);
      } catch (error) {
        console.error("Upload failed:", error);
      }
    }
  };

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm" style={{ color: "var(--ui-muted-foreground)" }}>
          Opening SFTP session...
        </div>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div
        id="sftp-container"
        className="flex flex-col h-full"
        style={{ backgroundColor: "var(--ui-background)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-2"
          style={{ borderBottom: "1px solid var(--ui-border)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium" style={{ color: "var(--ui-foreground)" }}>
              SFTP: {hostLabel}
            </span>
            <span className="text-xs" style={{ color: "var(--ui-muted-foreground)" }}>
              {currentPath}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <button
              onClick={() => setViewMode(viewMode === "dual" ? "remote" : "dual")}
              className="px-2 py-1 text-xs rounded hover:bg-white/10 transition-colors"
              style={{ color: "var(--ui-foreground)" }}
            >
              {viewMode === "dual" ? "Remote Only" : "Dual Panel"}
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="px-2 py-1 text-xs rounded hover:bg-white/10 transition-colors"
                style={{ color: "var(--ui-foreground)" }}
              >
                Close
              </button>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {viewMode === "dual" ? (
            <>
              {/* Local panel */}
              <div style={{ width: `${splitRatio}%` }} className="overflow-hidden">
                <div className="h-full flex flex-col">
                  <div
                    className="px-4 py-2 text-xs font-semibold"
                    style={{
                      color: "var(--ui-muted-foreground)",
                      borderBottom: "1px solid var(--ui-border)",
                    }}
                  >
                    Local
                  </div>
                  <div className="flex-1 overflow-auto">
                    <LocalFileList projectPath={projectPath} />
                  </div>
                </div>
              </div>

              {/* Resize handle */}
              <div
                className="w-1 cursor-col-resize hover:bg-blue-500 transition-colors"
                style={{ backgroundColor: "var(--ui-border)" }}
                onMouseDown={() => setIsResizing(true)}
              />

              {/* Remote panel */}
              <div style={{ width: `${100 - splitRatio}%` }} className="overflow-hidden">
                <RemoteFileList
                  sessionId={sessionId}
                  currentPath={currentPath}
                  onPathChange={setCurrentPath}
                  selectedFiles={selectedRemoteFiles}
                  onSelectionChange={setSelectedRemoteFiles}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-hidden">
              <RemoteFileList
                sessionId={sessionId}
                currentPath={currentPath}
                onPathChange={setCurrentPath}
                selectedFiles={selectedRemoteFiles}
                onSelectionChange={setSelectedRemoteFiles}
              />
            </div>
          )}
        </div>

        {/* Transfer queue */}
        <TransferQueue transfers={Array.from(transfers.values())} />
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeId && draggedFiles.length > 0 && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded shadow-lg"
            style={{
              backgroundColor: "var(--ui-background)",
              border: "1px solid var(--ui-border)",
            }}
          >
            <File className="size-4" style={{ color: "var(--ui-muted-foreground)" }} />
            <span className="text-sm" style={{ color: "var(--ui-foreground)" }}>
              {draggedFiles.length === 1
                ? draggedFiles[0].name
                : `${draggedFiles.length} files`}
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
