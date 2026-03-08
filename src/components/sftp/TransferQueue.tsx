import { useState } from "react";
import { X, ChevronDown, ChevronUp, Pause, Play, Trash2, XCircle } from "lucide-react";
import { type TransferProgress, sftpCancelTransfer, sftpPauseTransfer, sftpResumeTransfer } from "@/lib/tauri-ssh";
import { formatBytes } from "@/lib/utils";

interface TransferQueueProps {
  transfers: TransferProgress[];
  onRemoveTransfer?: (transferId: string) => void;
  onClearCompleted?: () => void;
  onClearAll?: () => void;
}

type TransferStatus = "active" | "paused" | "completed" | "cancelled";

interface TransferState {
  status: TransferStatus;
}

export function TransferQueue({
  transfers,
  onRemoveTransfer,
  onClearCompleted,
  onClearAll
}: TransferQueueProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [transferStates, setTransferStates] = useState<Map<string, TransferState>>(new Map());

  const getTransferStatus = (transfer: TransferProgress): TransferStatus => {
    const state = transferStates.get(transfer.transferId);
    if (state?.status === "cancelled") return "cancelled";
    if (state?.status === "paused") return "paused";
    if (transfer.bytesTransferred >= transfer.totalBytes) return "completed";
    return "active";
  };

  const activeTransfers = transfers.filter(
    (t) => {
      const status = getTransferStatus(t);
      return status === "active" || status === "paused";
    }
  );

  const completedTransfers = transfers.filter(
    (t) => getTransferStatus(t) === "completed"
  );

  const handlePause = async (transferId: string) => {
    try {
      await sftpPauseTransfer(transferId);
      setTransferStates(prev => {
        const next = new Map(prev);
        next.set(transferId, { status: "paused" });
        return next;
      });
    } catch (error) {
      console.error("Failed to pause transfer:", error);
    }
  };

  const handleResume = async (transferId: string) => {
    try {
      await sftpResumeTransfer(transferId);
      setTransferStates(prev => {
        const next = new Map(prev);
        next.set(transferId, { status: "active" });
        return next;
      });
    } catch (error) {
      console.error("Failed to resume transfer:", error);
    }
  };

  const handleCancel = async (transferId: string) => {
    try {
      await sftpCancelTransfer(transferId);
      setTransferStates(prev => {
        const next = new Map(prev);
        next.set(transferId, { status: "cancelled" });
        return next;
      });
    } catch (error) {
      console.error("Failed to cancel transfer:", error);
    }
  };

  const handleRemove = (transferId: string) => {
    if (onRemoveTransfer) {
      onRemoveTransfer(transferId);
    }
    setTransferStates(prev => {
      const next = new Map(prev);
      next.delete(transferId);
      return next;
    });
  };

  const handlePauseAll = () => {
    activeTransfers.forEach(transfer => {
      if (getTransferStatus(transfer) === "active") {
        handlePause(transfer.transferId);
      }
    });
  };

  const handleResumeAll = () => {
    activeTransfers.forEach(transfer => {
      if (getTransferStatus(transfer) === "paused") {
        handleResume(transfer.transferId);
      }
    });
  };

  const handleCancelAll = async () => {
    for (const transfer of activeTransfers) {
      await handleCancel(transfer.transferId);
    }
  };

  if (transfers.length === 0) {
    return null;
  }

  const hasPausedTransfers = activeTransfers.some(t => getTransferStatus(t) === "paused");
  const hasActiveTransfers = activeTransfers.some(t => getTransferStatus(t) === "active");

  return (
    <div
      className="border-t"
      style={{
        borderColor: "var(--ui-border)",
        backgroundColor: "var(--ui-background)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ borderBottom: isExpanded ? "1px solid var(--ui-border)" : "none" }}
      >
        <div
          className="flex items-center gap-2 flex-1 cursor-pointer hover:bg-white/5 -mx-2 px-2 py-1 rounded"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="text-sm font-medium" style={{ color: "var(--ui-foreground)" }}>
            Transfer Queue
          </span>
          <span className="text-xs" style={{ color: "var(--ui-muted-foreground)" }}>
            {activeTransfers.length} active, {completedTransfers.length} completed
          </span>
          {isExpanded ? (
            <ChevronDown className="size-4 ml-auto" style={{ color: "var(--ui-foreground)" }} />
          ) : (
            <ChevronUp className="size-4 ml-auto" style={{ color: "var(--ui-foreground)" }} />
          )}
        </div>

        {/* Batch action buttons */}
        <div className="flex items-center gap-1 ml-2">
          {hasActiveTransfers && (
            <button
              onClick={handlePauseAll}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              style={{ color: "var(--ui-muted-foreground)" }}
              title="Pause all"
            >
              <Pause className="size-4" />
            </button>
          )}
          {hasPausedTransfers && (
            <button
              onClick={handleResumeAll}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              style={{ color: "var(--ui-muted-foreground)" }}
              title="Resume all"
            >
              <Play className="size-4" />
            </button>
          )}
          {activeTransfers.length > 0 && (
            <button
              onClick={handleCancelAll}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              style={{ color: "var(--ui-muted-foreground)" }}
              title="Cancel all"
            >
              <XCircle className="size-4" />
            </button>
          )}
          {completedTransfers.length > 0 && (
            <button
              onClick={onClearCompleted}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              style={{ color: "var(--ui-muted-foreground)" }}
              title="Clear completed"
            >
              <Trash2 className="size-4" />
            </button>
          )}
          {transfers.length > 0 && (
            <button
              onClick={onClearAll}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              style={{ color: "var(--ui-muted-foreground)" }}
              title="Clear all"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Transfer list */}
      {isExpanded && (
        <div className="max-h-48 overflow-y-auto">
          {transfers.map((transfer) => {
            const status = getTransferStatus(transfer);
            const progress = transfer.totalBytes > 0
              ? (transfer.bytesTransferred / transfer.totalBytes) * 100
              : 0;
            const isComplete = status === "completed";
            const isPaused = status === "paused";
            const isCancelled = status === "cancelled";
            const eta = transfer.speed > 0 && !isPaused
              ? (transfer.totalBytes - transfer.bytesTransferred) / transfer.speed
              : 0;

            return (
              <div
                key={transfer.transferId}
                className="px-4 py-2 hover:bg-white/5"
                style={{
                  opacity: isComplete || isCancelled ? 0.6 : 1,
                  borderTop: "1px solid var(--ui-border)",
                }}
              >
                <div className="flex items-center gap-3">
                  {/* Direction icon */}
                  <div className="text-lg">
                    {transfer.direction === "upload" ? "↑" : "↓"}
                  </div>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="text-sm truncate"
                        style={{ color: "var(--ui-foreground)" }}
                      >
                        {transfer.fileName}
                      </span>
                      <span
                        className="text-xs ml-2"
                        style={{ color: "var(--ui-muted-foreground)" }}
                      >
                        {progress.toFixed(0)}%
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div
                      className="h-1 rounded-full overflow-hidden mb-1"
                      style={{ backgroundColor: "var(--ui-border)" }}
                    >
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${progress}%`,
                          backgroundColor: isCancelled
                            ? "#ef4444"
                            : isComplete
                            ? "#10b981"
                            : isPaused
                            ? "#f59e0b"
                            : "var(--ui-accent)",
                        }}
                      />
                    </div>

                    {/* Transfer stats */}
                    <div
                      className="flex items-center gap-3 text-xs"
                      style={{ color: "var(--ui-muted-foreground)" }}
                    >
                      <span>
                        {formatBytes(transfer.bytesTransferred)} / {formatBytes(transfer.totalBytes)}
                      </span>
                      {!isComplete && !isCancelled && !isPaused && transfer.speed > 0 && (
                        <>
                          <span>•</span>
                          <span>{formatBytes(transfer.speed)}/s</span>
                          <span>•</span>
                          <span>ETA {formatTime(eta)}</span>
                        </>
                      )}
                      {isComplete && <span className="text-green-500">Complete</span>}
                      {isPaused && <span className="text-yellow-500">Paused</span>}
                      {isCancelled && <span className="text-red-500">Cancelled</span>}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1">
                    {!isComplete && !isCancelled && (
                      <>
                        {isPaused ? (
                          <button
                            onClick={() => handleResume(transfer.transferId)}
                            className="p-1 rounded hover:bg-white/10 transition-colors"
                            style={{ color: "var(--ui-muted-foreground)" }}
                            title="Resume"
                          >
                            <Play className="size-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePause(transfer.transferId)}
                            className="p-1 rounded hover:bg-white/10 transition-colors"
                            style={{ color: "var(--ui-muted-foreground)" }}
                            title="Pause"
                          >
                            <Pause className="size-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleCancel(transfer.transferId)}
                          className="p-1 rounded hover:bg-white/10 transition-colors"
                          style={{ color: "var(--ui-muted-foreground)" }}
                          title="Cancel"
                        >
                          <XCircle className="size-4" />
                        </button>
                      </>
                    )}
                    {(isComplete || isCancelled) && (
                      <button
                        onClick={() => handleRemove(transfer.transferId)}
                        className="p-1 rounded hover:bg-white/10 transition-colors"
                        style={{ color: "var(--ui-muted-foreground)" }}
                        title="Remove"
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }
}
