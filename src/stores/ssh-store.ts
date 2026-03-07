import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SSHHostConfig, SSHConnectionInfo } from "@/lib/tauri-ssh";

interface SshStore {
  // Host configurations (persisted)
  hosts: SSHHostConfig[];

  // Active connections (runtime only)
  connections: SSHConnectionInfo[];

  // UI state
  selectedHostId: string | null;
  searchQuery: string;
  expandedGroups: Set<string>;

  // Host management
  addHost: (host: SSHHostConfig) => void;
  updateHost: (id: string, host: Partial<SSHHostConfig>) => void;
  deleteHost: (id: string) => void;
  getHost: (id: string) => SSHHostConfig | undefined;
  getHostsByGroup: () => Map<string, SSHHostConfig[]>;

  // Connection management
  setConnections: (connections: SSHConnectionInfo[]) => void;
  addConnection: (connection: SSHConnectionInfo) => void;
  removeConnection: (connId: string) => void;
  getConnection: (connId: string) => SSHConnectionInfo | undefined;
  isHostConnected: (hostId: string) => boolean;

  // UI actions
  setSelectedHost: (hostId: string | null) => void;
  setSearchQuery: (query: string) => void;
  toggleGroup: (group: string) => void;
  expandAllGroups: () => void;
  collapseAllGroups: () => void;
}

export const useSshStore = create<SshStore>()(
  persist(
    (set, get) => ({
      // Initial state
      hosts: [],
      connections: [],
      selectedHostId: null,
      searchQuery: "",
      expandedGroups: new Set(["default"]),

      // Host management
      addHost: (host) =>
        set((state) => ({
          hosts: [...state.hosts, host],
        })),

      updateHost: (id, updates) =>
        set((state) => ({
          hosts: state.hosts.map((h) =>
            h.id === id ? { ...h, ...updates } : h
          ),
        })),

      deleteHost: (id) =>
        set((state) => ({
          hosts: state.hosts.filter((h) => h.id !== id),
          selectedHostId:
            state.selectedHostId === id ? null : state.selectedHostId,
        })),

      getHost: (id) => get().hosts.find((h) => h.id === id),

      getHostsByGroup: () => {
        const { hosts, searchQuery } = get();
        const filtered = searchQuery
          ? hosts.filter(
  (h) =>
                h.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                h.hostname.toLowerCase().includes(searchQuery.toLowerCase())
            )
          : hosts;

        const grouped = new Map<string, SSHHostConfig[]>();
        filtered.forEach((host) => {
          const group = host.group || "default";
          if (!grouped.has(group)) {
            grouped.set(group, []);
          }
          grouped.get(group)!.push(host);
        });

        // Sort hosts within each group by label
        grouped.forEach((hosts) => {
          hosts.sort((a, b) => a.label.localeCompare(b.label));
        });

        return grouped;
      },

      // Connection management
      setConnections: (connections) => set({ connections }),

      addConnection: (connection) =>
        set((state) => ({
          connections: [...state.connections, connection],
        })),

      removeConnection: (connId) =>
        set((state) => ({
          connections: state.connections.filter((c) => c.id !== connId),
        })),

      getConnection: (connId) => get().connections.find((c) => c.id === connId),

      isHostConnected: (hostId) =>
        get().connections.some((c) => c.hostConfig.id === hostId),

      // UI actions
      setSelectedHost: (hostId) => set({ selectedHostId: hostId }),

      setSearchQuery: (query) => set({ searchQuery: query }),

      toggleGroup: (group) =>
        set((state) => {
          const newExpanded = new Set(state.expandedGroups);
          if (newExpanded.has(group)) {
            newExpanded.delete(group);
          } else {
            newExpanded.add(group);
          }
          return { expandedGroups: newExpanded };
        }),

      expandAllGroups: () =>
        set((state) => ({
          expandedGroups: new Set(
            Array.from(state.getHostsByGroup().keys())
          ),
        })),

      collapseAllGroups: () => set({ expandedGroups: new Set() }),
    }),
    {
      name: "ssh-store",
      partialize: (state) => ({
        hosts: state.hosts,
        expandedGroups: Array.from(state.expandedGroups),
      }),
      merge: (persistedState: any, currentState) => ({
        ...currentState,
        ...persistedState,
        expandedGroups: new Set(persistedState.expandedGroups || ["default"]),
        connections: [], // Don't persist connections
      }),
    }
  )
);
