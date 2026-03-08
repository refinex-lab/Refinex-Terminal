import { useEffect, useState, useCallback } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { sshConnect, sshOpenShell } from "@/lib/tauri-ssh";
import { useSshStore } from "@/stores/ssh-store";
import { useTerminalStore } from "@/stores/terminal-store";

interface UseSSHReconnectOptions {
  sessionId: string;
  connectionId?: string;
  channelId?: string;
  hostId?: string;
}

interface SSHReconnectState {
  disconnected: boolean;
  reason: string;
  isReconnecting: boolean;
  showOverlay: boolean;
}

export function useSSHReconnect({
  sessionId,
  connectionId,
  channelId,
  hostId,
}: UseSSHReconnectOptions) {
  const [state, setState] = useState<SSHReconnectState>({
    disconnected: false,
    reason: "",
    isReconnecting: false,
    showOverlay: false,
  });

  const { getHost, removeConnection } = useSshStore();
  // const { updateSession } = useTerminalStore(); // Not available in current store

  // Listen for disconnection events
  useEffect(() => {
    if (!connectionId) return;

    let unlisten: UnlistenFn | null = null;

    const setupListener = async () => {
      unlisten = await listen<string>(
        `ssh-disconnected-${connectionId}`,
        (event) => {
          console.log("SSH disconnected:", event.payload);
          setState({
            disconnected: true,
            reason: event.payload || "Connection lost",
            isReconnecting: false,
            showOverlay: true,
          });

          // Remove connection from store
          removeConnection(connectionId);
        }
      );
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [connectionId, removeConnection]);

  // Auto-reconnect after 5 seconds
  useEffect(() => {
    if (!state.disconnected || state.isReconnecting) return;

    const timer = setTimeout(() => {
      handleReconnect();
    }, 5000);

    return () => clearTimeout(timer);
  }, [state.disconnected, state.isReconnecting]);

  const handleReconnect = useCallback(async () => {
    if (!hostId || state.isReconnecting) return;

    setState((prev) => ({ ...prev, isReconnecting: true }));

    try {
      const host = getHost(hostId);
      if (!host) {
        throw new Error("Host configuration not found");
      }

      // Reconnect to SSH host
      const newConnId = await sshConnect(host);

      // Open new shell channel
      const newChannelId = await sshOpenShell(newConnId, 80, 24);

      // Update session with new connection and channel IDs
      // TODO: Implement updateSession in terminal store
      // updateSession(sessionId, {
      //   sshConnectionId: newConnId,
      //   sshChannelId: newChannelId,
      // });

      // Reset state
      setState({
        disconnected: false,
        reason: "",
        isReconnecting: false,
        showOverlay: false,
      });
    } catch (error) {
      console.error("Failed to reconnect:", error);
      setState((prev) => ({
        ...prev,
        isReconnecting: false,
        reason: `Reconnection failed: ${error}`,
      }));
    }
  }, [hostId, sessionId, state.isReconnecting, getHost]);

  const handleClose = useCallback(() => {
    setState({
      disconnected: false,
      reason: "",
      isReconnecting: false,
      showOverlay: false,
    });
  }, []);

  return {
    ...state,
    handleReconnect,
    handleClose,
  };
}
