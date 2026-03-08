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
 * Execute a command on the remote server and return output
 * This opens a temporary exec channel, runs the command, and returns the output
 */
export async function sshExecCommand(connId: string, command: string): Promise<string> {
  return await invoke<string>("ssh_exec_command", { connId, command });
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

/**
 * List SSH keys in a directory
 */
export interface SSHKeyInfo {
  path: string;
  filename: string;
  keyType: string;
  hasPassphrase: boolean;
  publicKeyPath?: string;
}

export async function listSSHKeys(dir?: string): Promise<SSHKeyInfo[]> {
  return await invoke<SSHKeyInfo[]>("list_ssh_keys_cmd", { dir });
}

/**
 * Test SSH connection without keeping it open
 */
export async function testSSHConnection(
  hostConfig: SSHHostConfig
): Promise<string> {
  return await invoke<string>("test_ssh_connection", { hostConfig });
}

// ============ SFTP Operations ============

export interface RemoteFileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modified?: number; // Unix timestamp
  permissions: string; // rwxr-xr-x format
  owner?: string;
  group?: string;
}

export interface TransferProgress {
  transferId: string;
  direction: "upload" | "download";
  fileName: string;
  bytesTransferred: number;
  totalBytes: number;
  speed: number; // bytes per second
}

/**
 * Open SFTP session on existing SSH connection
 */
export async function sftpOpen(connId: string): Promise<string> {
  return await invoke<string>("sftp_open", { connId });
}

/**
 * List directory contents
 */
export async function sftpReaddir(
  sessionId: string,
  path: string
): Promise<RemoteFileEntry[]> {
  return await invoke<RemoteFileEntry[]>("sftp_readdir", { sessionId, path });
}

/**
 * Get file/directory information
 */
export async function sftpStat(
  sessionId: string,
  path: string
): Promise<RemoteFileEntry> {
  return await invoke<RemoteFileEntry>("sftp_stat", { sessionId, path });
}

/**
 * Read file content (for preview)
 */
export async function sftpReadFile(
  sessionId: string,
  path: string,
  maxBytes: number
): Promise<string> {
  return await invoke<string>("sftp_read_file", {
    sessionId,
    path,
    maxBytes,
  });
}

/**
 * Create directory
 */
export async function sftpMkdir(
  sessionId: string,
  path: string
): Promise<void> {
  await invoke("sftp_mkdir", { sessionId, path });
}

/**
 * Rename file or directory
 */
export async function sftpRename(
  sessionId: string,
  oldPath: string,
  newPath: string
): Promise<void> {
  await invoke("sftp_rename", { sessionId, oldPath, newPath });
}

/**
 * Remove file or empty directory
 */
export async function sftpRemove(
  sessionId: string,
  path: string
): Promise<void> {
  await invoke("sftp_remove", { sessionId, path });
}

/**
 * Remove directory recursively
 */
export async function sftpRemoveRecursive(
  sessionId: string,
  path: string
): Promise<void> {
  await invoke("sftp_remove_recursive", { sessionId, path });
}

/**
 * Close SFTP session
 */
export async function sftpClose(sessionId: string): Promise<void> {
  await invoke("sftp_close", { sessionId });
}

/**
 * Upload file from local to remote
 */
export async function sftpUpload(
  sessionId: string,
  localPath: string,
  remotePath: string
): Promise<string> {
  return await invoke<string>("sftp_upload", {
    sessionId,
    localPath,
    remotePath,
  });
}

/**
 * Download file from remote to local
 */
export async function sftpDownload(
  sessionId: string,
  remotePath: string,
  localPath: string
): Promise<string> {
  return await invoke<string>("sftp_download", {
    sessionId,
    remotePath,
    localPath,
  });
}

/**
 * Upload directory recursively
 */
export async function sftpUploadDirectory(
  sessionId: string,
  localDir: string,
  remoteDir: string
): Promise<string[]> {
  return await invoke<string[]>("sftp_upload_directory", {
    sessionId,
    localDir,
    remoteDir,
  });
}

/**
 * Cancel transfer
 */
export async function sftpCancelTransfer(transferId: string): Promise<void> {
  await invoke("sftp_cancel_transfer", { transferId });
}

/**
 * Pause transfer
 */
export async function sftpPauseTransfer(transferId: string): Promise<void> {
  await invoke("sftp_pause_transfer", { transferId });
}

/**
 * Resume transfer
 */
export async function sftpResumeTransfer(transferId: string): Promise<void> {
  await invoke("sftp_resume_transfer", { transferId });
}

