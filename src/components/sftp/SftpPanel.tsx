import { useState, useEffect } from "react";
import { RemoteFileList } from "./RemoteFileList";
import { TransferQueue } from "./TransferQueue";
import { FileTree } from "../sidebar/FileTree";
import { sftpOpen, sftpClose, type RemoteFileEntry, type TransferProgress } from "@/lib/tauri-ssh";
import { listen } from "@tauri-apps/api/event";

interface SftpPanelProps {
  connectionId: string;
  hostLabel: string;
  onClose?: () => void;
}

export function SftpPanel({ connectionId, hostLabel, onClose }: SftpPanelProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState("/");
  const [splitRatio, setSplitRatio] = useState(50); // percentage
  const [isResizing, setIsResizing] = useState(false);
  const [viewMode, setViewMode] = useState<"dual" | "remote">("dual");
  const [transfers, setTransfers] = useState<Map<string, TransferProgress>>(new Map());

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
                  <FileTree />
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
              />
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-hidden">
            <RemoteFileList
              sessionId={sessionId}
              currentPath={currentPath}
              onPathChange={setCurrentPath}
            />
          </div>
        )}
      </div>

      {/* Transfer queue */}
      <TransferQueue transfers={Array.from(transfers.values())} />
    </div>
  );
}
