import { useState, useEffect, useRef } from "react";
import { X, GitBranch, MoreVertical, ChevronDown } from "lucide-react";
import { gitBranches, gitCheckout, type BranchInfo } from "@/lib/git";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  email: string;
  timestamp: number;
}

interface CommitFileChange {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  old_path?: string;
  additions: number;
  deletions: number;
}

interface CommitDetail extends CommitInfo {
  parent_hashes: string[];
  files_changed: CommitFileChange[];
  stats: {
    additions: number;
    deletions: number;
    files_changed: number;
  };
}

interface GitGraphViewPanelProps {
  repoPath: string;
  currentBranch: string;
  onClose: () => void;
  onOpenDiff: (filePath: string, commitHash: string) => void;
}

export function GitGraphViewPanel({
  repoPath,
  onClose,
  onOpenDiff,
}: GitGraphViewPanelProps) {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [commitDetail, setCommitDetail] = useState<CommitDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    branch: BranchInfo;
  } | null>(null);

  const contextMenuTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    loadBranches();
  }, [repoPath]);

  useEffect(() => {
    // Auto-load commits for the current branch when branches are loaded
    if (branches.length > 0 && !selectedBranch) {
      const currentBranch = branches.find(b => (b as any).is_head || (b as any).is_current);
      if (currentBranch) {
        loadCommits(currentBranch.name);
      }
    }
  }, [branches, selectedBranch]);

  const loadBranches = async () => {
    try {
      const result = await gitBranches(repoPath);
      if (result) {
        setBranches(result);
      }
    } catch (error) {
      toast.error(`Failed to load branches: ${error}`);
    }
  };

  const loadCommits = async (branchName: string) => {
    try {
      setLoading(true);
      const result = await invoke<CommitInfo[]>("git_log", {
        repoPath,
        limit: 50,
      });
      setCommits(result);
      setSelectedBranch(branchName);
      setSelectedCommit(null);
      setCommitDetail(null);
    } catch (error) {
      toast.error(`Failed to load commits: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const loadCommitDetail = async (commitHash: string) => {
    try {
      setLoading(true);
      const result = await invoke<CommitDetail>("git_commit_detail", {
        repoPath,
        commitHash,
      });
      setCommitDetail(result);
      setSelectedCommit(commitHash);
    } catch (error) {
      toast.error(`Failed to load commit detail: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBranchClick = (branch: BranchInfo) => {
    loadCommits(branch.name);
  };

  const handleBranchContextMenu = (
    e: React.MouseEvent,
    branch: BranchInfo
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (contextMenuTimeoutRef.current) {
      clearTimeout(contextMenuTimeoutRef.current);
    }

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      branch,
    });
  };

  const handleCheckoutBranch = async (branchName: string) => {
    try {
      await gitCheckout(repoPath, branchName);
      toast.success(`Switched to branch: ${branchName}`);
      loadBranches();
      setContextMenu(null);
    } catch (error) {
      toast.error(`Failed to checkout branch: ${error}`);
    }
  };

  useEffect(() => {
    if (contextMenu) {
      const handleClick = () => {
        contextMenuTimeoutRef.current = window.setTimeout(() => {
          setContextMenu(null);
        }, 0);
      };

      document.addEventListener("click", handleClick);

      contextMenuTimeoutRef.current = window.setTimeout(() => {
        document.removeEventListener("click", handleClick);
      }, 0);

      return () => {
        document.removeEventListener("click", handleClick);
      };
    }
  }, [contextMenu]);

  const getFileStatusIcon = (status: string) => {
    switch (status) {
      case "added":
        return <span className="text-green-500 font-bold text-xs">+</span>;
      case "modified":
        return <span className="text-blue-500 font-bold text-xs">M</span>;
      case "deleted":
        return <span className="text-red-500 font-bold text-xs">-</span>;
      case "renamed":
        return <span className="text-yellow-500 font-bold text-xs">R</span>;
      default:
        return null;
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const localBranches = branches.filter((b) => !b.is_remote);
  const remoteBranches = branches.filter((b) => b.is_remote);

  return (
    <div className="flex h-full" style={{ backgroundColor: "var(--ui-background)" }}>
      {/* Branch Tree Panel */}
      <div
        className="w-64 border-r flex flex-col"
        style={{ borderColor: "var(--ui-border)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-2 border-b"
          style={{ borderColor: "var(--ui-border)" }}
        >
          <div className="flex items-center gap-2">
            <GitBranch className="size-4" />
            <span className="font-medium text-sm">Branches</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            title="Close"
          >
            <ChevronDown className="size-3" />
          </button>
        </div>

        {/* Branch List */}
        <div className="flex-1 overflow-y-auto">
          {/* Local Branches */}
          {localBranches.length > 0 && (
            <div>
              <div
                className="px-4 py-2 text-xs font-medium"
                style={{ color: "var(--ui-muted-foreground)" }}
              >
                Local
              </div>
              {localBranches.map((branch) => {
                const isCurrentBranch = (branch as any).is_head || (branch as any).is_current;
                return (
                  <div
                    key={branch.name}
                    className="group flex items-center justify-between px-4 py-2 hover:bg-white/5 cursor-pointer transition-colors"
                    style={{
                      backgroundColor:
                        selectedBranch === branch.name
                          ? "rgba(255, 255, 255, 0.08)"
                          : undefined,
                      borderLeft: isCurrentBranch ? "3px solid var(--ui-accent)" : "3px solid transparent",
                    }}
                    onClick={() => handleBranchClick(branch)}
                    onContextMenu={(e) => handleBranchContextMenu(e, branch)}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {isCurrentBranch ? (
                        <span className="text-xs font-medium flex-shrink-0" style={{ color: "var(--ui-accent)" }}>●</span>
                      ) : (
                        <GitBranch className="size-3.5 flex-shrink-0 opacity-70" />
                      )}
                      <span className="text-sm truncate" style={{ fontWeight: isCurrentBranch ? 600 : 400 }}>
                        {branch.name}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBranchContextMenu(e, branch);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 transition-opacity"
                    >
                      <MoreVertical className="size-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Remote Branches */}
          {remoteBranches.length > 0 && (
            <div>
              <div
                className="px-4 py-2 text-xs font-medium mt-2"
                style={{ color: "var(--ui-muted-foreground)" }}
              >
                Remote
              </div>
              {remoteBranches.map((branch) => (
                <div
                  key={branch.name}
                  className="group flex items-center justify-between px-4 py-2 hover:bg-white/5 cursor-pointer transition-colors"
                  style={{
                    backgroundColor:
                      selectedBranch === branch.name
                        ? "rgba(255, 255, 255, 0.08)"
                        : undefined,
                    borderLeft: "3px solid transparent",
                  }}
                  onClick={() => handleBranchClick(branch)}
                  onContextMenu={(e) => handleBranchContextMenu(e, branch)}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <GitBranch className="size-3.5 flex-shrink-0 opacity-70" />
                    <span className="text-sm truncate opacity-70">
                      {branch.name}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBranchContextMenu(e, branch);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 transition-opacity"
                  >
                    <MoreVertical className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Commit List Panel */}
      <div
        className="w-96 border-r flex flex-col"
        style={{ borderColor: "var(--ui-border)" }}
      >
        {/* Header */}
        <div
          className="px-4 py-2 border-b text-sm font-medium"
          style={{ borderColor: "var(--ui-border)" }}
        >
          {selectedBranch ? `Commits (${commits.length})` : "Select a branch"}
        </div>

        {/* Commit List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <span style={{ color: "var(--ui-muted-foreground)" }}>
                Loading...
              </span>
            </div>
          ) : commits.length > 0 ? (
            commits.map((commit) => (
              <div
                key={commit.hash}
                className="px-4 py-3 border-b hover:bg-white/5 cursor-pointer transition-colors"
                style={{
                  borderColor: "var(--ui-border)",
                  backgroundColor:
                    selectedCommit === commit.hash
                      ? "rgba(255, 255, 255, 0.08)"
                      : undefined,
                }}
                onClick={() => loadCommitDetail(commit.hash)}
              >
                <div className="text-sm font-medium mb-1 truncate">
                  {commit.message}
                </div>
                <div
                  className="text-xs flex items-center gap-2"
                  style={{ color: "var(--ui-muted-foreground)" }}
                >
                  <span>{commit.author}</span>
                  <span>•</span>
                  <span>{formatDate(commit.timestamp)}</span>
                </div>
                <div
                  className="text-xs mt-1 font-mono"
                  style={{ color: "var(--ui-muted-foreground)" }}
                >
                  {commit.hash.substring(0, 7)}
                </div>
              </div>
            ))
          ) : (
            <div
              className="flex items-center justify-center h-full text-sm"
              style={{ color: "var(--ui-muted-foreground)" }}
            >
              No commits
            </div>
          )}
        </div>
      </div>

      {/* Commit Detail Panel */}
      <div className="flex-1 flex flex-col">
        {commitDetail ? (
          <>
            {/* Commit Info */}
            <div
              className="px-4 py-3 border-b"
              style={{ borderColor: "var(--ui-border)" }}
            >
              <div className="text-sm font-medium mb-2">
                {commitDetail.message}
              </div>
              <div
                className="text-xs space-y-1"
                style={{ color: "var(--ui-muted-foreground)" }}
              >
                <div>Author: {commitDetail.author}</div>
                <div>Date: {formatDate(commitDetail.timestamp)}</div>
                <div className="font-mono">{commitDetail.hash}</div>
                <div className="flex gap-4 mt-2">
                  <span className="text-green-500">
                    +{commitDetail.stats.additions}
                  </span>
                  <span className="text-red-500">
                    -{commitDetail.stats.deletions}
                  </span>
                  <span>{commitDetail.stats.files_changed} files</span>
                </div>
              </div>
            </div>

            {/* Changed Files */}
            <div className="flex-1 overflow-y-auto">
              {commitDetail.files_changed.map((file) => (
                <div
                  key={file.path}
                  className="px-4 py-2 border-b hover:bg-white/5 cursor-pointer transition-colors"
                  style={{ borderColor: "var(--ui-border)" }}
                  onClick={() => onOpenDiff(file.path, commitDetail.hash)}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-4">{getFileStatusIcon(file.status)}</div>
                    <span className="text-sm flex-1 truncate">
                      {file.status === "renamed" && file.old_path
                        ? `${file.old_path} → ${file.path}`
                        : file.path}
                    </span>
                    <div
                      className="text-xs flex gap-2"
                      style={{ color: "var(--ui-muted-foreground)" }}
                    >
                      <span className="text-green-500">+{file.additions}</span>
                      <span className="text-red-500">-{file.deletions}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div
            className="flex items-center justify-center h-full text-sm"
            style={{ color: "var(--ui-muted-foreground)" }}
          >
            Select a commit to view details
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 py-1 rounded shadow-lg border"
          style={{
            top: contextMenu.y,
            left: contextMenu.x,
            backgroundColor: "var(--ui-background)",
            borderColor: "var(--ui-border)",
          }}
        >
          <button
            onClick={() => handleCheckoutBranch(contextMenu.branch.name)}
            className="w-full px-4 py-2 text-left text-sm hover:bg-white/10 transition-colors"
            disabled={(contextMenu.branch as any).is_head || (contextMenu.branch as any).is_current}
          >
            Checkout
          </button>
        </div>
      )}
    </div>
  );
}
