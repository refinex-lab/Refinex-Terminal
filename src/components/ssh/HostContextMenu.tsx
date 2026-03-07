import { useEffect, useRef } from "react";
import { useSshStore } from "@/stores/ssh-store";
import type { SSHHostConfig } from "@/lib/tauri-ssh";

interface HostContextMenuProps {
  x: number;
  y: number;
  host: SSHHostConfig;
  onClose: () => void;
  onEdit: (host: SSHHostConfig) => void;
}

export function HostContextMenu({
  x,
  y,
  host,
  onClose,
  onEdit,
}: HostContextMenuProps) {
  const { deleteHost, isHostConnected } = useSshStore();
  const menuRef = useRef<HTMLDivElement>(null);

  const connected = isHostConnected(host.id);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const handleConnect = () => {
    // TODO: Implement connect
    console.log("Connect to:", host);
    onClose();
  };

  const handleSFTP = () => {
    // TODO: Implement SFTP
    console.log("Open SFTP for:", host);
    onClose();
  };

  const handleEdit = () => {
    onEdit(host);
  };

  const handleDelete = () => {
    if (confirm(`Delete host "${host.label}"?`)) {
      deleteHost(host.id);
      onClose();
    }
  };

  const handleDisconnect = () => {
    // TODO: Implement disconnect
    console.log("Disconnect from:", host);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] rounded-md shadow-lg"
      style={{
        left: x,
        top: y,
        backgroundColor: "var(--ui-popover)",
        border: "1px solid var(--ui-border)",
      }}
    >
      <div className="py-1">
        {!connected ? (
          <button
            onClick={handleConnect}
            className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 transition-colors"
            style={{ color: "var(--ui-foreground)" }}
          >
            Connect
          </button>
        ) : (
          <button
            onClick={handleDisconnect}
            className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 transition-colors"
            style={{ color: "var(--ui-foreground)" }}
          >
            Disconnect
          </button>
        )}

        <button
          onClick={handleSFTP}
          className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 transition-colors"
          style={{ color: "var(--ui-foreground)" }}
        >
          Open SFTP
        </button>

        <div
          className="my-1"
          style={{ borderTop: "1px solid var(--ui-border)" }}
        />

        <button
          onClick={handleEdit}
          className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 transition-colors"
          style={{ color: "var(--ui-foreground)" }}
        >
          Edit
        </button>

        <button
          onClick={handleDelete}
          className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 transition-colors text-red-500"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
