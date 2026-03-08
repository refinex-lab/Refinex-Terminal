import { useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { ptyWrite, ptyResize } from "@/lib/tauri-pty";

export type TerminalMode = "local" | "ssh";

export interface TerminalTransportConfig {
  mode: TerminalMode;
  // Local PTY config
  localPtyId?: number;
  // SSH config
  sshConnectionId?: string;
  sshChannelId?: string;
}

export interface TerminalTransport {
  write: (data: string) => Promise<void>;
  resize: (cols: number, rows: number) => Promise<void>;
  close: () => Promise<void>;
  onData: (callback: (data: Uint8Array) => void) => Promise<UnlistenFn>;
  onClose: (callback: () => void) => Promise<UnlistenFn>;
}

/**
 * Hook to manage terminal transport layer (local PTY or SSH)
 * Abstracts the differences between local and remote terminals
 */
export function useTerminalTransport(config: TerminalTransportConfig): TerminalTransport | null {
  const unlistenersRef = useRef<UnlistenFn[]>([]);

  useEffect(() => {
    // Cleanup listeners on unmount or config change
    return () => {
      unlistenersRef.current.forEach((unlisten) => unlisten());
      unlistenersRef.current = [];
    };
  }, [config.mode, config.localPtyId, config.sshConnectionId, config.sshChannelId]);

  if (config.mode === "local") {
    if (config.localPtyId === undefined || config.localPtyId === null) {
      return null;
    }

    return {
      write: async (data: string) => {
        const encoder = new TextEncoder();
        await ptyWrite(config.localPtyId!, encoder.encode(data));
      },

      resize: async (cols: number, rows: number) => {
        await ptyResize(config.localPtyId!, cols, rows);
      },

      close: async () => {
        await invoke("pty_kill", { id: config.localPtyId });
      },

      onData: async (callback: (data: Uint8Array) => void) => {
        const unlisten = await listen<number[]>(`pty-output-${config.localPtyId}`, (event) => {
          callback(new Uint8Array(event.payload));
        });
        unlistenersRef.current.push(unlisten);
        return unlisten;
      },

      onClose: async (callback: () => void) => {
        const unlisten = await listen(`pty-exit-${config.localPtyId}`, () => {
          callback();
        });
        unlistenersRef.current.push(unlisten);
        return unlisten;
      },
    };
  } else if (config.mode === "ssh") {
    if (!config.sshConnectionId || !config.sshChannelId) {
      return null;
    }

    return {
      write: async (data: string) => {
        const encoder = new TextEncoder();
        const bytes = Array.from(encoder.encode(data));
        await invoke("ssh_write", {
          connId: config.sshConnectionId,
          channelId: config.sshChannelId,
          data: bytes,
        });
      },

      resize: async (cols: number, rows: number) => {
        await invoke("ssh_resize", {
          connId: config.sshConnectionId,
          channelId: config.sshChannelId,
          cols,
          rows,
        });
      },

      close: async () => {
        await invoke("ssh_close_channel", {
          connId: config.sshConnectionId,
          channelId: config.sshChannelId,
        });
      },

      onData: async (callback: (data: Uint8Array) => void) => {
        const eventName = `ssh-output-${config.sshConnectionId}-${config.sshChannelId}`;
        const unlisten = await listen<number[]>(eventName, (event) => {
          callback(new Uint8Array(event.payload));
        });
        unlistenersRef.current.push(unlisten);
        return unlisten;
      },

      onClose: async (callback: () => void) => {
        const eofEvent = `ssh-channel-eof-${config.sshConnectionId}-${config.sshChannelId}`;
        const closeEvent = `ssh-channel-closed-${config.sshConnectionId}-${config.sshChannelId}`;

        const unlistenEof = await listen(eofEvent, () => {
          callback();
        });

        const unlistenClose = await listen(closeEvent, () => {
          callback();
        });

        unlistenersRef.current.push(unlistenEof, unlistenClose);

        return () => {
          unlistenEof();
          unlistenClose();
        };
      },
    };
  }

  return null;
}
