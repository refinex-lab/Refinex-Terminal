import { useState, useMemo } from "react";
import { Search, Plus, ChevronRight, ChevronDown, Circle, MoreVertical } from "lucide-react";
import { useSshStore } from "@/stores/ssh-store";
import { useTerminalStore } from "@/stores/terminal-store";
import { HostFormDialog } from "./HostFormDialog";
import { HostContextMenu } from "./HostContextMenu";
import { GroupContextMenu } from "./GroupContextMenu";
import { RenameGroupDialog } from "./RenameGroupDialog";
import { DeleteGroupDialog } from "./DeleteGroupDialog";
import type { SSHHostConfig } from "@/lib/tauri-ssh";
import { sshConnect, sshOpenShell } from "@/lib/tauri-ssh";
import { toast } from "sonner";

export function HostSidebar() {
  const {
    hosts,
    searchQuery,
    setSearchQuery,
    expandedGroups,
    toggleGroup,
    getHostsByGroup,
    isHostConnected,
    addConnection,
    updateHost,
  } = useSshStore();

  const { addSession, setActiveSession } = useTerminalStore();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingHost, setEditingHost] = useState<SSHHostConfig | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    host: SSHHostConfig;
  } | null>(null);
  const [groupContextMenu, setGroupContextMenu] = useState<{
    x: number;
    y: number;
    group: string;
    hostCount: number;
  } | null>(null);
  const [renameGroupDialog, setRenameGroupDialog] = useState<{
    open: boolean;
    group: string;
  }>({ open: false, group: "" });
  const [deleteGroupDialog, setDeleteGroupDialog] = useState<{
    open: boolean;
    group: string;
    hostCount: number;
  }>({ open: false, group: "", hostCount: 0 });

  const groupedHosts = useMemo(() => getHostsByGroup(), [getHostsByGroup, hosts, searchQuery]);

  const handleDoubleClick = async (host: SSHHostConfig) => {
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

  const handleContextMenu = (
    e: React.MouseEvent,
    host: SSHHostConfig
  ) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      host,
    });
  };

  const handleNewHost = () => {
    setEditingHost(null);
    setIsFormOpen(true);
  };

  const handleEditHost = (host: SSHHostConfig) => {
    setEditingHost(host);
    setIsFormOpen(true);
    setContextMenu(null);
  };

  const handleGroupContextMenu = (
    e: React.MouseEvent,
    group: string,
    hostCount: number
  ) => {
    e.preventDefault();
    e.stopPropagation();

    // Close any existing context menu first
    setContextMenu(null);
    setGroupContextMenu(null);

    // Open new context menu
    setGroupContextMenu({
      x: e.clientX,
      y: e.clientY,
      group,
      hostCount,
    });
  };

  const handleRenameGroup = (oldName: string) => {
    setRenameGroupDialog({ open: true, group: oldName });
  };

  const handleDeleteGroup = (groupName: string) => {
    const hostsInGroup = hosts.filter((h) => h.group === groupName);
    setDeleteGroupDialog({
      open: true,
      group: groupName,
      hostCount: hostsInGroup.length,
    });
  };

  const handleConfirmRename = (newName: string) => {
    const oldName = renameGroupDialog.group;

    // Update all hosts in the old group to the new group name
    const hostsInGroup = hosts.filter((h) => h.group === oldName);
    hostsInGroup.forEach((host) => {
      updateHost(host.id, { ...host, group: newName });
    });

    toast.success(`Renamed group "${oldName}" to "${newName}"`);
  };

  const handleConfirmDelete = () => {
    const groupName = deleteGroupDialog.group;
    const hostsInGroup = hosts.filter((h) => h.group === groupName);

    if (hostsInGroup.length === 0) {
      toast.success("Group deleted");
    } else {
      // Delete all hosts in the group
      hostsInGroup.forEach((host) => {
        deleteHost(host.id);
      });
      toast.success(`Deleted group "${groupName}" and ${hostsInGroup.length} host${hostsInGroup.length > 1 ? 's' : ''}`);
    }
  };

  // Get unique groups for rename validation
  const existingGroups = Array.from(
    new Set(hosts.map((h) => h.group).filter(Boolean))
  ) as string[];

  return (
    <div
      className="flex flex-col h-full"
      style={{
        backgroundColor: "var(--ui-background)",
        borderRight: "1px solid var(--ui-border)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: "1px solid var(--ui-border)" }}
      >
        <span
          className="text-sm font-medium"
          style={{ color: "var(--ui-foreground)" }}
        >
          SSH Hosts
        </span>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div
          className="flex items-center gap-2 px-2 py-1 rounded"
          style={{
            backgroundColor: "var(--ui-input-background)",
            border: "1px solid var(--ui-border)",
          }}
        >
          <Search className="size-4" style={{ color: "var(--ui-muted-foreground)" }} />
          <input
            type="text"
            placeholder="Search hosts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "var(--ui-foreground)" }}
          />
        </div>
      </div>

      {/* Host List */}
      <div className="flex-1 overflow-y-auto">
        {Array.from(groupedHosts.entries()).map(([group, hosts]) => (
          <div key={group}>
            {/* Group Header */}
            <button
              onClick={() => toggleGroup(group)}
              onContextMenu={(e) => handleGroupContextMenu(e, group, hosts.length)}
              className="group/header w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.03)",
              }}
            >
              {expandedGroups.has(group) ? (
                <ChevronDown className="size-3.5" style={{ color: "var(--ui-muted-foreground)" }} />
              ) : (
                <ChevronRight className="size-3.5" style={{ color: "var(--ui-muted-foreground)" }} />
              )}
              <span
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--ui-foreground)", opacity: 0.9 }}
              >
                {group === "default" ? "Ungrouped" : group}
              </span>
              <span
                className="text-xs ml-auto font-medium"
                style={{ color: "var(--ui-muted-foreground)" }}
              >
                {hosts.length}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleGroupContextMenu(e, group, hosts.length);
                }}
                className="opacity-0 group-hover/header:opacity-100 transition-opacity p-0.5 hover:bg-white/10 rounded"
                style={{ color: "var(--ui-muted-foreground)" }}
              >
                <MoreVertical className="size-3.5" />
              </button>
            </button>

            {/* Hosts in Group */}
            {expandedGroups.has(group) && (
              <div className="pl-2">
                {hosts.map((host) => {
                  const connected = isHostConnected(host.id);
                  return (
                    <div
                      key={host.id}
                      className="group/host px-3 py-2 hover:bg-white/5 cursor-pointer transition-colors rounded-sm mx-1"
                      onDoubleClick={() => handleDoubleClick(host)}
                      onContextMenu={(e) => handleContextMenu(e, host)}
                    >
                      <div className="flex items-center gap-2">
                        {/* Status Indicator */}
                        <Circle
                          className="size-2 fill-current"
                          style={{
                            color: connected
                              ? "#10b981"
                              : "rgba(255, 255, 255, 0.3)",
                          }}
                        />

                        {/* Host Info */}
                        <div className="flex-1 min-w-0">
                          <div
                            className="text-sm font-medium truncate"
                            style={{
                              color: host.color || "var(--ui-foreground)",
                            }}
                          >
                            {host.label}
                          </div>
                          <div
                            className="text-xs truncate"
                            style={{ color: "var(--ui-muted-foreground)" }}
                          >
                            {host.username}@{host.hostname}:{host.port}
                          </div>
                        </div>

                        {/* More Options Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleContextMenu(e, host);
                          }}
                          className="opacity-0 group-hover/host:opacity-100 transition-opacity p-0.5 hover:bg-white/10 rounded"
                          style={{ color: "var(--ui-muted-foreground)" }}
                        >
                          <MoreVertical className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {groupedHosts.size === 0 && (
          <div className="px-3 py-8 text-center">
            <p
              className="text-sm"
              style={{ color: "var(--ui-muted-foreground)" }}
            >
              No hosts found
            </p>
            <p
              className="text-xs mt-1"
              style={{ color: "var(--ui-muted-foreground)" }}
            >
              {searchQuery
                ? "Try a different search"
                : "Click + to add a new host"}
            </p>
          </div>
        )}
      </div>

      {/* New Host Button */}
      <div
        className="p-3"
        style={{ borderTop: "1px solid var(--ui-border)" }}
      >
        <button
          onClick={handleNewHost}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded hover:bg-white/10 transition-colors"
          style={{
            backgroundColor: "var(--ui-accent)",
            color: "var(--ui-accent-foreground)",
          }}
        >
          <Plus className="size-4" />
          <span className="text-sm font-medium">New Host</span>
        </button>
      </div>

      {/* Host Form Dialog */}
      <HostFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        editingHost={editingHost}
      />

      {/* Context Menu */}
      {contextMenu && (
        <HostContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          host={contextMenu.host}
          onClose={() => setContextMenu(null)}
          onEdit={handleEditHost}
        />
      )}

      {/* Group Context Menu */}
      {groupContextMenu && (
        <GroupContextMenu
          x={groupContextMenu.x}
          y={groupContextMenu.y}
          group={groupContextMenu.group}
          hostCount={groupContextMenu.hostCount}
          onClose={() => setGroupContextMenu(null)}
          onRename={handleRenameGroup}
          onDelete={handleDeleteGroup}
        />
      )}

      {/* Rename Group Dialog */}
      <RenameGroupDialog
        open={renameGroupDialog.open}
        onOpenChange={(open) => setRenameGroupDialog({ ...renameGroupDialog, open })}
        currentName={renameGroupDialog.group}
        onConfirm={handleConfirmRename}
        existingGroups={existingGroups}
      />

      {/* Delete Group Dialog */}
      <DeleteGroupDialog
        open={deleteGroupDialog.open}
        onOpenChange={(open) => setDeleteGroupDialog({ ...deleteGroupDialog, open })}
        groupName={deleteGroupDialog.group}
        hostCount={deleteGroupDialog.hostCount}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
