import { invoke } from "@tauri-apps/api/core";

export interface GitFileStatus {
  path: string;
  status: "modified" | "added" | "deleted" | "renamed" | "untracked";
  staged: boolean;
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: GitFileStatus[];
  unstaged: GitFileStatus[];
  untracked: GitFileStatus[];
}

export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  email: string;
  timestamp: number;
}

export interface BranchInfo {
  name: string;
  is_current: boolean;
  is_remote: boolean;
  upstream: string | null;
}

export async function gitStatus(repoPath: string): Promise<GitStatus> {
  return await invoke<GitStatus>("git_status", { repoPath });
}

export async function gitDiff(
  repoPath: string,
  filePath: string,
  staged: boolean
): Promise<string> {
  return await invoke<string>("git_diff", { repoPath, filePath, staged });
}

export async function gitLog(
  repoPath: string,
  limit: number
): Promise<CommitInfo[]> {
  return await invoke<CommitInfo[]>("git_log", { repoPath, limit });
}

export async function gitStage(
  repoPath: string,
  paths: string[]
): Promise<void> {
  await invoke("git_stage", { repoPath, paths });
}

export async function gitUnstage(
  repoPath: string,
  paths: string[]
): Promise<void> {
  await invoke("git_unstage", { repoPath, paths });
}

export async function gitCommit(
  repoPath: string,
  message: string
): Promise<string> {
  return await invoke<string>("git_commit", { repoPath, message });
}

export async function gitPush(repoPath: string): Promise<string> {
  return await invoke<string>("git_push", { repoPath });
}

export async function gitPull(repoPath: string): Promise<string> {
  return await invoke<string>("git_pull", { repoPath });
}

export async function gitFetch(repoPath: string): Promise<string> {
  return await invoke<string>("git_fetch", { repoPath });
}

export async function gitBranches(repoPath: string): Promise<BranchInfo[]> {
  return await invoke<BranchInfo[]>("git_branches", { repoPath });
}

export async function gitCheckout(
  repoPath: string,
  branch: string
): Promise<void> {
  await invoke("git_checkout", { repoPath, branch });
}

export async function gitStash(repoPath: string): Promise<string> {
  return await invoke<string>("git_stash", { repoPath });
}

export async function gitStashPop(repoPath: string): Promise<void> {
  await invoke("git_stash_pop", { repoPath });
}
