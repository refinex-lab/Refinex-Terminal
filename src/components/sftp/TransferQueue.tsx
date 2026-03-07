import { useState } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { type TransferProgress, sftpCancelTransfer } from "@/lib/tauri-ssh";
import { formatBytes } from "@/lib/utils";

interface TransferQueueProps {
  transfers: TransferProgress[];
}

export function TransferQueue({ transfers }: TransferQueueProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const activeTransfers = transfers.filter(
    (t) => t.bytesTransferred < t.totalBytes
  );
  const completedTransfers = transfers.filter(
    (t) => t.bytesTransferred >= t.totalBytes
  );

  const handleCancel = async (transferId: string) => {
    try {
      await sftpCancelTransfer(transferId);
    } catch (error) {
      console.error("Failed to cancel transfer:", error);
    }
  };

  if (transfers.length === 0) {
    return null;
  }

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
        className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-white/5"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: "var(--ui-foreground)" }}>
            Transfer Queue
          </span>
          <span className="text-xs" style={{ color: "var(--ui-muted-foreground)" }}>
            {activeTransfers.length} active, {completedTransfers.length} completed
          </span>
        </div>

        <button className="p-1 rounded hover:bg-white/10 transition-colors">
          {isExpanded ? (
            <ChevronDown className="size-4" style={{ color: "var(--ui-foreground)" }} />
          ) : (
            <ChevronUp className="size-4" style={{ color: "var(--ui-foreground)" }} />
          )}
        </button>
      </div>

      {/* Transfer list */}
      {isExpanded && (
        <div className="max-h-48 overflow-y-auto">
          {transfers.map((transfer) => {
            const progress = transfer.totalBytes > 0
              ? (transfer.bytesTransferred / transfer.totalBytes) * 100
              : 0;
            const isComplete = transfer.bytesTransferred >= transfer.totalBytes;
            const eta = transfer.speed > 0
              ? (transfer.totalBytes - transfer.bytesTransferred) / transfer.speed
              : 0;

            return (
              <div
                key={transfer.transferId}
                className="px-4 py-2 hover:bg-white/5"
                style={{
                  opacity: isComplete ? 0.6 : 1,
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
                          backgroundColor: isComplete
                            ? "#10b981"
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
                      {!isComplete && transfer.speed > 0 && (
                        <>
                          <span>•</span>
                          <span>{formatBytes(transfer.speed)}/s</span>
                          <span>•</span>
                          <span>ETA {formatTime(eta)}</span>
                        </>
                      )}
                      {isComplete && <span className="text-green-500">Complete</span>}
                    </div>
                  </div>

                  {/* Cancel button */}
                  {!isComplete && (
                    <button
                      onClick={() => handleCancel(transfer.transferId)}
                      className="p-1 rounded hover:bg-white/10 transition-colors"
                      style={{ color: "var(--ui-muted-foreground)" }}
                      title="Cancel transfer"
                    >
                      <X className="size-4" />
                    </button>
                  )}
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
