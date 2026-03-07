import { useState, useEffect, useRef } from "react";
import { X, GitBranch, MoreVertical } from "lucide-react";
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

interface GitGraphViewProps {
  repoPath: string;
  currentBranch: string;
  onClose: () => void;
  onOpenDiff: (filePath: string, commitHash: string) => void;
}

export function GitGraphView({
  repoPath,
  onClose,
  onOpenDiff,
}: GitGraphViewProps) {
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

  const handleCommitClick = (commit: CommitInfo) => {
    loadCommitDetail(commit.hash);
  };

  const handleFileClick = (file: CommitFileChange) => {
    if (selectedCommit) {
      onOpenDiff(file.path, selectedCommit);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, branch: BranchInfo) => {
    e.preventDefault();
    e.stopPropagation();

    if (contextMenuTimeoutRef.current) {
      clearTimeout(contextMenuTimeoutRef.current);
    }

    setContextMenu({ x: e.clientX, y: e.clientY, branch });
  };

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const contextMenuElement = document.querySelector("[data-git-graph-context-menu]");

      if (contextMenuElement && !contextMenuElement.contains(target)) {
        if (contextMenuTimeoutRef.current) {
          clearTimeout(contextMenuTimeoutRef.current);
        }
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      setTimeout(() => {
        document.addEventListener("click", handleClick);
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
    <div
      className="fixed z-50 flex"
      style={{
        backgroundColor: "var(--ui-background)",
        top: "40px", // Below the title bar
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      {/* Branch Tree Panel */}
      <div
        className="w-64 border-r flex flex-col"
        style={{ borderColor: "var(--ui-border)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "var(--ui-border)" }}
        >
          <div className="flex items-center gap-2">
            <GitBranch className="size-5" />
            <h3 className="font-semibold">Git Graph</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Branch List */}
        <div className="flex-1 overflow-y-auto">
          {/* Local Branches */}
          {localBranches.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-medium opacity-70">
                Local Branches
              </div>
              {localBranches.map((branch) => (
                <div
                  key={branch.name}
                  className={`flex items-center justify-between px-4 py-2 cursor-pointer group transition-colors ${
                    selectedBranch === branch.name
                      ? "bg-blue-500/20"
                      : "hover:bg-white/5"
                  }`}
                  onClick={() => handleBranchClick(branch)}
                  onContextMenu={(e) => handleContextMenu(e, branch)}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <GitBranch className="size-3.5 flex-shrink-0" />
                    <span
                      className="text-sm truncate"
                      style={{
                        fontWeight: branch.is_current ? 600 : 400,
                        color: branch.is_current
                          ? "#22c55e"
                          : "var(--ui-foreground)",
                      }}
                    >
                      {branch.name}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleContextMenu(e, branch);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 transition-opacity"
                  >
                    <MoreVertical className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Remote Branches */}
          {remoteBranches.length > 0 && (
            <div className="mt-2">
              <div className="px-4 py-2 text-xs font-medium opacity-70">
                Remote Branches
              </div>
              {remoteBranches.map((branch) => (
                <div
                  key={branch.name}
                  className={`flex items-center justify-between px-4 py-2 cursor-pointer group transition-colors ${
                    selectedBranch === branch.name
                      ? "bg-blue-500/20"
                      : "hover:bg-white/5"
                  }`}
                  onClick={() => handleBranchClick(branch)}
                  onContextMenu={(e) => handleContextMenu(e, branch)}
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
                      handleContextMenu(e, branch);
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

      {/* Commit History Panel */}
      {selectedBranch && (
        <div
          className="w-96 border-r flex flex-col"
          style={{ borderColor: "var(--ui-border)" }}
        >
          {/* Header */}
          <div
            className="px-4 py-3 border-b"
            style={{ borderColor: "var(--ui-border)" }}
          >
            <div className="text-sm font-medium">Commit History</div>
            <div className="text-xs opacity-70 mt-1">{selectedBranch}</div>
          </div>

          {/* Commit List */}
          <div className="flex-1 overflow-y-auto">
            {loading && commits.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <span className="text-sm opacity-70">Loading commits...</span>
              </div>
            ) : commits.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <span className="text-sm opacity-70">No commits found</span>
              </div>
            ) : (
              commits.map((commit) => (
                <div
                  key={commit.hash}
                  className={`px-4 py-3 border-b cursor-pointer transition-colors ${
                    selectedCommit === commit.hash
                      ? "bg-blue-500/20"
                      : "hover:bg-white/5"
                  }`}
                  style={{ borderColor: "var(--ui-border)" }}
                  onClick={() => handleCommitClick(commit)}
                >
                  <div className="text-sm font-medium mb-1 line-clamp-2">
                    {commit.message}
                  </div>
                  <div className="flex items-center gap-2 text-xs opacity-70">
                    <span className="font-mono">{commit.hash.substring(0, 8)}</span>
                    <span>•</span>
                    <span>{commit.author}</span>
                    <span>•</span>
                    <span>{formatDate(commit.timestamp)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Commit Detail Panel */}
      {selectedCommit && commitDetail && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div
            className="px-4 py-3 border-b"
            style={{ borderColor: "var(--ui-border)" }}
          >
            <div className="text-sm font-medium mb-2">Commit Details</div>
            <div className="text-xs opacity-70">
              <div className="font-mono mb-1">{commitDetail.hash}</div>
              <div>
                {commitDetail.author} &lt;{commitDetail.email}&gt;
              </div>
              <div>{formatDate(commitDetail.timestamp)}</div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Commit Message */}
            <div
              className="px-4 py-3 border-b"
              style={{ borderColor: "var(--ui-border)" }}
            >
              <div className="text-xs font-medium opacity-70 mb-2">
                Commit Message
              </div>
              <div className="text-sm whitespace-pre-wrap">
                {commitDetail.message}
              </div>
            </div>

            {/* Stats */}
            <div
              className="px-4 py-3 border-b"
              style={{ borderColor: "var(--ui-border)" }}
            >
              <div className="flex items-center gap-4 text-xs">
                <span>
                  <span className="font-medium">{commitDetail.stats.files_changed}</span>{" "}
                  files changed
                </span>
                <span className="text-green-500">
                  <span className="font-medium">+{commitDetail.stats.additions}</span>{" "}
                  additions
                </span>
                <span className="text-red-500">
                  <span className="font-medium">-{commitDetail.stats.deletions}</span>{" "}
                  deletions
                </span>
              </div>
            </div>

            {/* Files Changed */}
            <div className="px-4 py-3">
              <div className="text-xs font-medium opacity-70 mb-2">
                Files Changed ({commitDetail.files_changed.length})
              </div>
              <div className="space-y-1">
                {commitDetail.files_changed.map((file) => (
                  <div
                    key={file.path}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer group"
                    onClick={() => handleFileClick(file)}
                  >
                    <div className="w-4 flex items-center justify-center flex-shrink-0">
                      {getFileStatusIcon(file.status)}
                    </div>
                    <span className="text-sm flex-1 truncate">{file.path}</span>
                    <div className="text-xs opacity-70 flex items-center gap-1">
                      {file.additions > 0 && (
                        <span className="text-green-500">+{file.additions}</span>
                      )}
                      {file.deletions > 0 && (
                        <span className="text-red-500">-{file.deletions}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!selectedBranch && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <GitBranch className="size-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm opacity-70">Select a branch to view commits</p>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          data-git-graph-context-menu
          className="fixed z-50 py-1 rounded-lg shadow-lg"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            backgroundColor: "var(--ui-background)",
            border: "1px solid var(--ui-border)",
            minWidth: "200px",
          }}
          onMouseEnter={() => {
            if (contextMenuTimeoutRef.current) {
              clearTimeout(contextMenuTimeoutRef.current);
            }
          }}
          onMouseLeave={() => {
            contextMenuTimeoutRef.current = window.setTimeout(() => {
              setContextMenu(null);
            }, 1000);
          }}
        >
          {contextMenu.branch.is_current ? (
            <>
              {/* Current branch menu */}
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
                onClick={() => {
                  toast.info("Create branch from current branch");
                  setContextMenu(null);
                }}
              >
                Create branch from '{contextMenu.branch.name}'
              </button>
            </>
          ) : (
            <>
              {/* Non-current branch menu */}
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
                onClick={async () => {
                  try {
                    // Remove "origin/" prefix for remote branches
                    const branchName = contextMenu.branch.is_remote
                      ? contextMenu.branch.name.replace(/^origin\//, "")
                      : contextMenu.branch.name;

                    await gitCheckout(repoPath, branchName);
                    toast.success(`Switched to branch: ${branchName}`);
                    loadBranches();
                    loadCommits(branchName);
                  } catch (error) {
                    toast.error(`Failed to checkout: ${error}`);
                  }
                  setContextMenu(null);
                }}
              >
                Checkout
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
                onClick={() => {
                  toast.info(`Create branch from ${contextMenu.branch.name}`);
                  setContextMenu(null);
                }}
              >
                Create branch from '{contextMenu.branch.name}'
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
