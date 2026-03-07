import { useEffect, useState } from "react";
import { WifiOff, RefreshCw, X } from "lucide-react";

interface SSHReconnectOverlayProps {
  visible: boolean;
  reason: string;
  hostLabel: string;
  onReconnect: () => void;
  onClose: () => void;
  isReconnecting: boolean;
}

export function SSHReconnectOverlay({
  visible,
  reason,
  hostLabel,
  onReconnect,
  onClose,
  isReconnecting,
}: SSHReconnectOverlayProps) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !isReconnecting) {
        onReconnect();
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, isReconnecting, onReconnect, onClose]);

  useEffect(() => {
    if (!visible) {
      setCountdown(5);
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        className="max-w-md w-full mx-4 p-6 rounded-lg shadow-2xl"
        style={{
          backgroundColor: "var(--ui-background)",
          border: "1px solid var(--ui-border)",
        }}
      >
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div
            className="p-4 rounded-full"
            style={{ backgroundColor: "rgba(239, 68, 68, 0.1)" }}
          >
            <WifiOff className="size-8 text-red-500" />
          </div>
        </div>

        {/* Title */}
        <h2
          className="text-xl font-semibold text-center mb-2"
          style={{ color: "var(--ui-foreground)" }}
        >
          Connection Lost
        </h2>

        {/* Host Info */}
        <p
          className="text-center text-sm mb-4"
          style={{ color: "var(--ui-muted-foreground)" }}
        >
          SSH connection to <strong>{hostLabel}</strong> was interrupted
        </p>

        {/* Reason */}
        {reason && (
          <div
            className="p-3 rounded mb-4 text-sm"
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "var(--ui-foreground)",
            }}
          >
            <strong>Reason:</strong> {reason}
          </div>
        )}

        {/* Instructions */}
        <div
          className="p-4 rounded mb-6"
          style={{
            backgroundColor: "var(--ui-muted)",
            border: "1px solid var(--ui-border)",
          }}
        >
          <p
            className="text-sm text-center"
            style={{ color: "var(--ui-foreground)" }}
          >
            {isReconnecting ? (
              <>
                <RefreshCw className="inline size-4 mr-2 animate-spin" />
                Reconnecting...
              </>
            ) : countdown > 0 ? (
              <>
                Press <kbd className="px-2 py-1 rounded bg-white/10">Enter</kbd>{" "}
                to reconnect or <kbd className="px-2 py-1 rounded bg-white/10">Esc</kbd>{" "}
                to close
                <br />
                <span className="text-xs mt-2 block" style={{ color: "var(--ui-muted-foreground)" }}>
                  Auto-reconnect in {countdown}s
                </span>
              </>
            ) : (
              <>
                Press <kbd className="px-2 py-1 rounded bg-white/10">Enter</kbd>{" "}
                to reconnect or <kbd className="px-2 py-1 rounded bg-white/10">Esc</kbd>{" "}
                to close
              </>
            )}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isReconnecting}
            className="flex-1 px-4 py-2 rounded hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "var(--ui-muted)",
              color: "var(--ui-foreground)",
            }}
          >
            <X className="inline size-4 mr-2" />
            Close
          </button>
          <button
            onClick={onReconnect}
            disabled={isReconnecting}
            className="flex-1 px-4 py-2 rounded hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "var(--ui-accent)",
              color: "var(--ui-accent-foreground)",
            }}
          >
            {isReconnecting ? (
              <>
                <RefreshCw className="inline size-4 mr-2 animate-spin" />
                Reconnecting...
              </>
            ) : (
              <>
                <RefreshCw className="inline size-4 mr-2" />
                Reconnect
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
