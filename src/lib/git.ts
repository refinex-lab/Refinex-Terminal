import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

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

/**
 * Helper to handle Git errors with toast notifications
 */
async function handleGitError<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    console.error(`Git ${operation} failed:`, error);
    const errorMessage = typeof error === "string" ? error : (error as Error).message || "Unknown error";

    toast.error(`Git ${operation} failed`, {
      description: errorMessage,
      duration: 5000,
    });

    return null;
  }
}

export async function gitStatus(repoPath: string): Promise<GitStatus | null> {
  return handleGitError("status", () => invoke<GitStatus>("git_status", { repoPath }));
}

export async function gitDiff(
  repoPath: string,
  filePath: string,
  staged: boolean
): Promise<string | null> {
  return handleGitError("diff", () => invoke<string>("git_diff", { repoPath, filePath, staged }));
}

export async function gitLog(
  repoPath: string,
  limit: number
): Promise<CommitInfo[] | null> {
  return handleGitError("log", () => invoke<CommitInfo[]>("git_log", { repoPath, limit }));
}

export async function gitStage(
  repoPath: string,
  paths: string[]
): Promise<boolean> {
  const result = await handleGitError("stage", () => invoke("git_stage", { repoPath, paths }));
  if (result !== null) {
    toast.success("Files staged", {
      description: `${paths.length} file(s) staged for commit`,
      duration: 3000,
    });
    return true;
  }
  return false;
}

export async function gitUnstage(
  repoPath: string,
  paths: string[]
): Promise<boolean> {
  const result = await handleGitError("unstage", () => invoke("git_unstage", { repoPath, paths }));
  if (result !== null) {
    toast.success("Files unstaged", {
      description: `${paths.length} file(s) removed from staging`,
      duration: 3000,
    });
    return true;
  }
  return false;
}

export async function gitCommit(
  repoPath: string,
  message: string
): Promise<string | null> {
  const result = await handleGitError("commit", () => invoke<string>("git_commit", { repoPath, message }));
  if (result) {
    toast.success("Commit created", {
      description: message.split("\n")[0], // Show first line of commit message
      duration: 4000,
    });
  }
  return result;
}

export async function gitPush(repoPath: string): Promise<string | null> {
  const result = await handleGitError("push", () => invoke<string>("git_push", { repoPath }));
  if (result) {
    toast.success("Pushed to remote", {
      description: "Changes pushed successfully",
      duration: 4000,
    });
  }
  return result;
}

export async function gitPull(repoPath: string): Promise<string | null> {
  const result = await handleGitError("pull", () => invoke<string>("git_pull", { repoPath }));
  if (result) {
    toast.success("Pulled from remote", {
      description: "Changes pulled successfully",
      duration: 4000,
    });
  }
  return result;
}

export async function gitFetch(repoPath: string): Promise<string | null> {
  return handleGitError("fetch", () => invoke<string>("git_fetch", { repoPath }));
}

export async function gitBranches(repoPath: string): Promise<BranchInfo[] | null> {
  return handleGitError("branches", () => invoke<BranchInfo[]>("git_branches", { repoPath }));
}

export async function gitCheckout(
  repoPath: string,
  branch: string
): Promise<boolean> {
  const result = await handleGitError("checkout", () => invoke("git_checkout", { repoPath, branch }));
  if (result !== null) {
    toast.success("Branch switched", {
      description: `Switched to branch: ${branch}`,
      duration: 3000,
    });
    return true;
  }
  return false;
}

export async function gitStash(repoPath: string): Promise<string | null> {
  const result = await handleGitError("stash", () => invoke<string>("git_stash", { repoPath }));
  if (result) {
    toast.success("Changes stashed", {
      description: "Working directory is now clean",
      duration: 3000,
    });
  }
  return result;
}

export async function gitStashPop(repoPath: string): Promise<boolean> {
  const result = await handleGitError("stash pop", () => invoke("git_stash_pop", { repoPath }));
  if (result !== null) {
    toast.success("Stash applied", {
      description: "Stashed changes restored",
      duration: 3000,
    });
    return true;
  }
  return false;
}
