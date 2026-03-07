import { useEffect, useRef } from "react";
import { useSshStore } from "@/stores/ssh-store";
import type { SSHHostConfig } from "@/lib/tauri-ssh";
import { sshConnect, sshOpenShell, sshDisconnect } from "@/lib/tauri-ssh";
import { useTerminalStore } from "@/stores/terminal-store";
import { toast } from "sonner";
import { Plug, PlugZap, FolderOpen, Edit, Trash2 } from "lucide-react";

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
  const { deleteHost, isHostConnected, addConnection } = useSshStore();
  const { addSession, setActiveSession } = useTerminalStore();
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

  const handleConnect = async () => {
    onClose();

    try {
      toast.loading(`Connecting to ${host.label}...`, { id: `ssh-connect-${host.id}` });

      // Convert to snake_case for Rust backend
      const hostConfig: any = {
        id: host.id,
        label: host.label,
        hostname: host.hostname,
        port: host.port,
        username: host.username,
        auth_method: host.authMethod,
        use_ssh_agent: host.useSSHAgent,
      };

      if (host.group) hostConfig.group = host.group;
      if (host.password) hostConfig.password = host.password;
      if (host.privateKeyPath) hostConfig.private_key_path = host.privateKeyPath;
      if (host.passphrase) hostConfig.passphrase = host.passphrase;
      if (host.proxyJump) hostConfig.proxy_jump = host.proxyJump;
      if (host.startupCommand) hostConfig.startup_command = host.startupCommand;
      if (host.color) hostConfig.color = host.color;
      if (host.sshConfigHost) hostConfig.ssh_config_host = host.sshConfigHost;
      if (host.lastConnected) hostConfig.last_connected = host.lastConnected;
      if (host.terminalSettings) hostConfig.terminal_settings = host.terminalSettings;

      // Connect to SSH host
      const connId = await sshConnect(hostConfig);

      // Open shell channel
      const channelId = await sshOpenShell(connId, 80, 24);

      // Add connection to store
      addConnection({
        id: connId,
        hostConfig: host,
        connectedAt: new Date().toISOString(),
        activeChannels: [channelId],
      });

      // Create terminal session
      const sessionId = `ssh-${Date.now()}`;
      addSession({
        id: sessionId,
        title: `${host.username}@${host.hostname}`,
        cwd: "~",
        ptyId: null,
        mode: "ssh",
        sshConnectionId: connId,
        sshChannelId: channelId,
        sshHostLabel: host.label,
        sshColor: host.color,
      });

      setActiveSession(sessionId);

      toast.success(`Connected to ${host.label}`, { id: `ssh-connect-${host.id}` });
    } catch (error) {
      console.error("Failed to connect:", error);
      toast.error(`Failed to connect: ${error}`, { id: `ssh-connect-${host.id}` });
    }
  };

  const handleSFTP = () => {
    // TODO: Implement SFTP
    console.log("Open SFTP for:", host);
    toast.info("SFTP feature coming soon");
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

  const handleDisconnect = async () => {
    onClose();

    try {
      // Find connection for this host
      const { connections, removeConnection } = useSshStore.getState();
      const connection = connections.find((c) => c.hostConfig.id === host.id);

      if (connection) {
        // Find and remove terminal sessions associated with this connection
        const { sessions, removeSession } = useTerminalStore.getState();
        const sshSessions = sessions.filter(
          (s) => s.mode === "ssh" && s.sshConnectionId === connection.id
        );

        // Disconnect SSH connection
        await sshDisconnect(connection.id);
        removeConnection(connection.id);

        // Remove all associated terminal sessions
        sshSessions.forEach((session) => {
          removeSession(session.id);
        });

        toast.success(`Disconnected from ${host.label}`);
      }
    } catch (error) {
      console.error("Failed to disconnect:", error);
      toast.error(`Failed to disconnect: ${error}`);
    }
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] rounded-md shadow-lg backdrop-blur-sm"
      style={{
        left: x,
        top: y,
        backgroundColor: "rgba(30, 30, 30, 0.95)",
        border: "1px solid var(--ui-border)",
      }}
    >
      <div className="py-1">
        {!connected ? (
          <button
            onClick={handleConnect}
            className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 transition-colors flex items-center gap-2"
            style={{ color: "var(--ui-foreground)" }}
          >
            <Plug className="size-4" />
            Connect
          </button>
        ) : (
          <button
            onClick={handleDisconnect}
            className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 transition-colors flex items-center gap-2"
            style={{ color: "var(--ui-foreground)" }}
          >
            <PlugZap className="size-4" />
            Disconnect
          </button>
        )}

        <button
          onClick={handleSFTP}
          className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 transition-colors flex items-center gap-2"
          style={{ color: "var(--ui-foreground)" }}
        >
          <FolderOpen className="size-4" />
          Open SFTP
        </button>

        <div
          className="my-1"
          style={{ borderTop: "1px solid var(--ui-border)" }}
        />

        <button
          onClick={handleEdit}
          className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 transition-colors flex items-center gap-2"
          style={{ color: "var(--ui-foreground)" }}
        >
          <Edit className="size-4" />
          Edit
        </button>

        <button
          onClick={handleDelete}
          className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 transition-colors text-red-500 flex items-center gap-2"
        >
          <Trash2 className="size-4" />
          Delete
        </button>
      </div>
    </div>
  );
}
