import { invoke } from "@tauri-apps/api/core";

export interface SSHHostConfig {
  id: string;
  label: string;
  group?: string;
  hostname: string;
  port: number;
  username: string;
  authMethod: "password" | "key" | "agent" | "keyboard-interactive";
  password?: string;
  privateKeyPath?: string;
  passphrase?: string;
  useSSHAgent: boolean;
  proxyJump?: string;
  startupCommand?: string;
  color?: string;
  sshConfigHost?: string;
  lastConnected?: string;
  terminalSettings?: {
    fontFamily?: string;
    fontSize?: number;
    theme?: string;
  };
}

export interface SSHConnectionInfo {
  id: string;
  hostConfig: SSHHostConfig;
  connectedAt: string;
  activeChannels: string[];
}

/**
 * Connect to SSH host
 */
export async function sshConnect(hostConfig: SSHHostConfig): Promise<string> {
  return await invoke<string>("ssh_connect", { hostConfig });
}

/**
 * Disconnect from SSH host
 */
export async function sshDisconnect(connId: string): Promise<void> {
  await invoke("ssh_disconnect", { connId });
}

/**
 * List all active SSH connections
 */
export async function sshListConnections(): Promise<SSHConnectionInfo[]> {
  return await invoke<SSHConnectionInfo[]>("ssh_list_connections");
}

/**
 * Open a shell channel on an SSH connection
 */
export async function sshOpenShell(
  connId: string,
  cols: number,
  rows: number
): Promise<string> {
  return await invoke<string>("ssh_open_shell", { connId, cols, rows });
}

/**
 * Write data to an SSH channel
 */
export async function sshWrite(
  connId: string,
  channelId: string,
  data: number[]
): Promise<void> {
  await invoke("ssh_write", { connId, channelId, data });
}

/**
 * Resize an SSH channel's PTY
 */
export async function sshResize(
  connId: string,
  channelId: string,
  cols: number,
  rows: number
): Promise<void> {
  await invoke("ssh_resize", { connId, channelId, cols, rows });
}

/**
 * Close an SSH channel
 */
export async function sshCloseChannel(
  connId: string,
  channelId: string
): Promise<void> {
  await invoke("ssh_close_channel", { connId, channelId });
}
