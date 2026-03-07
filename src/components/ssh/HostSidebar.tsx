import { useState, useMemo } from "react";
import { Search, Plus, ChevronRight, ChevronDown, Circle } from "lucide-react";
import { useSshStore } from "@/stores/ssh-store";
import { HostFormDialog } from "./HostFormDialog";
import { HostContextMenu } from "./HostContextMenu";
import type { SSHHostConfig } from "@/lib/tauri-ssh";

export function HostSidebar() {
  const {
    searchQuery,
    setSearchQuery,
    expandedGroups,
    toggleGroup,
    getHostsByGroup,
    isHostConnected,
  } = useSshStore();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingHost, setEditingHost] = useState<SSHHostConfig | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    host: SSHHostConfig;
  } | null>(null);

  const groupedHosts = useMemo(() => getHostsByGroup(), [getHostsByGroup]);

  const handleDoubleClick = (host: SSHHostConfig) => {
    // TODO: Connect to host
    console.log("Connect to host:", host);
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
              className="w-full flex items-center gap-1 px-3 py-1.5 hover:bg-white/5 transition-colors"
            >
              {expandedGroups.has(group) ? (
                <ChevronDown className="size-4" style={{ color: "var(--ui-muted-foreground)" }} />
              ) : (
                <ChevronRight className="size-4" style={{ color: "var(--ui-muted-foreground)" }} />
              )}
              <span
                className="text-xs font-medium uppercase tracking-wide"
                style={{ color: "var(--ui-muted-foreground)" }}
              >
                {group === "default" ? "Ungrouped" : group}
              </span>
              <span
                className="text-xs ml-auto"
                style={{ color: "var(--ui-muted-foreground)" }}
              >
                {hosts.length}
              </span>
            </button>

            {/* Hosts in Group */}
            {expandedGroups.has(group) && (
              <div>
                {hosts.map((host) => {
                  const connected = isHostConnected(host.id);
                  return (
                    <div
                      key={host.id}
                      className="px-3 py-2 hover:bg-white/5 cursor-pointer transition-colors"
                      onDoubleClick={() => handleDoubleClick(host)}
                      onContextMenu={(e) => handleContextMenu(e, host)}
                    >
                      <div className="flex items-center gap-2">
                        {/* Status Indicator */}
                        <Circle
                          className="size-2 fill-current"
                          style={{
                            color: connected
                              ? "var(--ui-success)"
                              : "var(--ui-muted-foreground)",
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
    </div>
  );
}
