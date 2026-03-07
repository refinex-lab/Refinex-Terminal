import { useState, useEffect, useRef } from "react";
import { X, Search, Plus, Check, Trash2, GitBranch, MoreVertical, Download, Upload, GitMerge } from "lucide-react";
import { gitBranches, gitCheckout, type BranchInfo } from "@/lib/git";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

interface BranchManagerProps {
  repoPath: string;
  currentBranch: string;
  onClose: () => void;
  onBranchChanged: () => void;
}

export function BranchManager({
  repoPath,
  onClose,
  onBranchChanged,
}: BranchManagerProps) {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewBranchInput, setShowNewBranchInput] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [showRenameInput, setShowRenameInput] = useState<{
    branch: BranchInfo;
    newName: string;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    branch: BranchInfo;
  } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    type: "checkout" | "delete" | "stash" | "merge" | "rebase";
    branch: BranchInfo;
    hasUncommitted?: boolean;
    targetBranch?: string;
  } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const contextMenuTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    loadBranches();
  }, [repoPath]);

  useEffect(() => {
    // Focus search input on mount
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  const loadBranches = async () => {
    try {
      setLoading(true);
      const result = await gitBranches(repoPath);
      setBranches(result);
    } catch (error) {
      toast.error(`Failed to load branches: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const checkUncommittedChanges = async (): Promise<boolean> => {
    try {
      const status = await invoke<{ staged: unknown[]; unstaged: unknown[]; untracked: unknown[] }>(
        "git_status",
        { repoPath }
      );
      return (
        status.staged.length > 0 ||
        status.unstaged.length > 0 ||
        status.untracked.length > 0
      );
    } catch {
      return false;
    }
  };

  const handleCheckout = async (branch: BranchInfo) => {
    if (branch.is_current) return;

    // Check for uncommitted changes
    const hasUncommitted = await checkUncommittedChanges();
    if (hasUncommitted) {
      setConfirmDialog({ type: "checkout", branch, hasUncommitted: true });
      return;
    }

    await performCheckout(branch);
  };

  const performCheckout = async (branch: BranchInfo, stash = false) => {
    try {
      if (stash) {
        await invoke("git_stash", { repoPath });
        toast.success("Changes stashed");
      }

      // Remove "origin/" prefix for remote branches
      const branchName = branch.is_remote
        ? branch.name.replace(/^origin\//, "")
        : branch.name;

      await gitCheckout(repoPath, branchName);
      toast.success(`Switched to branch: ${branchName}`);
      onBranchChanged();
      onClose();
    } catch (error) {
      toast.error(`Failed to checkout branch: ${error}`);
    }
  };

  const handleCreateBranchFrom = async (sourceBranch: string) => {
    setShowNewBranchInput(true);
    setContextMenu(null);
    // Store source branch for later use
    setNewBranchName(`${sourceBranch}-`);
  };

  const handlePull = async () => {
    try {
      await invoke("git_pull", { repoPath });
      toast.success("Pulled successfully");
      onBranchChanged();
    } catch (error) {
      toast.error(`Failed to pull: ${error}`);
    }
    setContextMenu(null);
  };

  const handlePush = async () => {
    try {
      await invoke("git_push", { repoPath });
      toast.success("Pushed successfully");
      onBranchChanged();
    } catch (error) {
      toast.error(`Failed to push: ${error}`);
    }
    setContextMenu(null);
  };

  const handleRename = async (branch: BranchInfo) => {
    setShowRenameInput({ branch, newName: branch.name });
    setContextMenu(null);
  };

  const performRename = async () => {
    if (!showRenameInput || !showRenameInput.newName.trim()) return;
    if (showRenameInput.newName === showRenameInput.branch.name) {
      setShowRenameInput(null);
      return;
    }

    try {
      await invoke("git_rename_branch", {
        repoPath,
        oldName: showRenameInput.branch.name,
        newName: showRenameInput.newName.trim(),
      });
      toast.success(`Renamed branch to: ${showRenameInput.newName}`);
      await loadBranches();
      setShowRenameInput(null);
    } catch (error) {
      toast.error(`Failed to rename branch: ${error}`);
    }
  };

  const handleMerge = async (sourceBranch: string, targetBranch: string) => {
    setConfirmDialog({
      type: "merge",
      branch: { name: sourceBranch, is_current: false, is_remote: false, upstream: null },
      targetBranch,
    });
    setContextMenu(null);
  };

  const handleRebase = async (sourceBranch: string, targetBranch: string) => {
    setConfirmDialog({
      type: "rebase",
      branch: { name: sourceBranch, is_current: false, is_remote: false, upstream: null },
      targetBranch,
    });
    setContextMenu(null);
  };

  const performMerge = async (sourceBranch: string, targetBranch: string) => {
    try {
      await invoke("git_merge", {
        repoPath,
        sourceBranch,
        targetBranch,
      });
      toast.success(`Merged ${sourceBranch} into ${targetBranch}`);
      onBranchChanged();
      setConfirmDialog(null);
    } catch (error) {
      toast.error(`Failed to merge: ${error}`);
    }
  };

  const performRebase = async (sourceBranch: string, targetBranch: string) => {
    try {
      await invoke("git_rebase", {
        repoPath,
        sourceBranch,
        targetBranch,
      });
      toast.success(`Rebased ${sourceBranch} onto ${targetBranch}`);
      onBranchChanged();
      setConfirmDialog(null);
    } catch (error) {
      toast.error(`Failed to rebase: ${error}`);
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;

    try {
      // Create and checkout new branch using git command
      await invoke("git_checkout", {
        repoPath,
        branch: newBranchName.trim(),
        create: true,
      });

      toast.success(`Created and switched to branch: ${newBranchName}`);
      setNewBranchName("");
      setShowNewBranchInput(false);
      onBranchChanged();
      onClose();
    } catch (error) {
      toast.error(`Failed to create branch: ${error}`);
    }
  };

  const handleDeleteBranch = async (branch: BranchInfo) => {
    if (branch.is_current) {
      toast.error("Cannot delete the current branch");
      return;
    }

    setConfirmDialog({ type: "delete", branch });
  };

  const performDelete = async (branch: BranchInfo) => {
    try {
      // Use system git command for branch deletion
      await invoke("git_delete_branch", {
        repoPath,
        branchName: branch.name,
        force: false,
      });

      toast.success(`Deleted branch: ${branch.name}`);
      await loadBranches();
      setConfirmDialog(null);
    } catch (error) {
      toast.error(`Failed to delete branch: ${error}`);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, branch: BranchInfo) => {
    e.preventDefault();
    e.stopPropagation();

    // Clear any existing timeout
    if (contextMenuTimeoutRef.current) {
      clearTimeout(contextMenuTimeoutRef.current);
    }

    setContextMenu({ x: e.clientX, y: e.clientY, branch });
  };

  // Close context menu on click outside or after timeout
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Check if click is outside the context menu
      const target = e.target as HTMLElement;
      const contextMenuElement = document.querySelector('[data-context-menu]');

      if (contextMenuElement && !contextMenuElement.contains(target)) {
        if (contextMenuTimeoutRef.current) {
          clearTimeout(contextMenuTimeoutRef.current);
        }
        setContextMenu(null);
      }
    };

    const handleMouseMove = () => {
      if (contextMenu && contextMenuTimeoutRef.current) {
        clearTimeout(contextMenuTimeoutRef.current);
      }

      if (contextMenu) {
        contextMenuTimeoutRef.current = window.setTimeout(() => {
          setContextMenu(null);
        }, 3000); // Close after 3 seconds of no mouse movement
      }
    };

    if (contextMenu) {
      // Use setTimeout to avoid immediate closure from the same click that opened the menu
      setTimeout(() => {
        document.addEventListener("click", handleClick);
      }, 0);
      document.addEventListener("mousemove", handleMouseMove);

      // Initial timeout
      contextMenuTimeoutRef.current = window.setTimeout(() => {
        setContextMenu(null);
      }, 3000);

      return () => {
        document.removeEventListener("click", handleClick);
        document.removeEventListener("mousemove", handleMouseMove);
        if (contextMenuTimeoutRef.current) {
          clearTimeout(contextMenuTimeoutRef.current);
        }
      };
    }
  }, [contextMenu]);

  const localBranches = branches.filter((b) => !b.is_remote);
  const remoteBranches = branches.filter((b) => b.is_remote);

  const filteredLocalBranches = localBranches.filter((b) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRemoteBranches = remoteBranches.filter((b) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        onClick={onClose}
      >
        <div
          className="rounded-lg w-full max-w-md max-h-[600px] flex flex-col"
          style={{
            backgroundColor: "var(--ui-background)",
            border: "1px solid var(--ui-border)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: "var(--ui-border)" }}
          >
            <div className="flex items-center gap-2">
              <GitBranch className="size-5" />
              <h3 className="font-semibold">Branch Manager</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-white/10 transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Search */}
          <div className="px-4 py-3 border-b" style={{ borderColor: "var(--ui-border)" }}>
            <div className="flex items-center gap-2 px-3 py-2 rounded" style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}>
              <Search className="size-4 opacity-50" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search branches..."
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: "var(--ui-foreground)" }}
              />
            </div>
          </div>

          {/* Branch list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <span className="text-sm opacity-70">Loading branches...</span>
              </div>
            ) : (
              <>
                {/* Local branches */}
                {filteredLocalBranches.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-xs font-medium opacity-70">
                      Local Branches
                    </div>
                    {filteredLocalBranches.map((branch) => (
                      <div
                        key={branch.name}
                        className="flex items-center justify-between px-4 py-2 hover:bg-white/5 cursor-pointer group"
                        onClick={() => handleCheckout(branch)}
                        onContextMenu={(e) => handleContextMenu(e, branch)}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {branch.is_current ? (
                            <Check className="size-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <div className="size-4 flex-shrink-0" />
                          )}
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
                          {branch.upstream && (
                            <span className="text-xs opacity-50 truncate">
                              → {branch.upstream}
                            </span>
                          )}
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

                {/* Remote branches */}
                {filteredRemoteBranches.length > 0 && (
                  <div className="mt-2">
                    <div className="px-4 py-2 text-xs font-medium opacity-70">
                      Remote Branches
                    </div>
                    {filteredRemoteBranches.map((branch) => (
                      <div
                        key={branch.name}
                        className="flex items-center justify-between px-4 py-2 hover:bg-white/5 cursor-pointer group"
                        onClick={() => handleCheckout(branch)}
                        onContextMenu={(e) => handleContextMenu(e, branch)}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="size-4 flex-shrink-0" />
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

                {filteredLocalBranches.length === 0 &&
                  filteredRemoteBranches.length === 0 && (
                    <div className="flex items-center justify-center py-8">
                      <span className="text-sm opacity-70">No branches found</span>
                    </div>
                  )}
              </>
            )}
          </div>

          {/* New branch input */}
          {showNewBranchInput && (
            <div className="px-4 py-3 border-t" style={{ borderColor: "var(--ui-border)" }}>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateBranch();
                    if (e.key === "Escape") {
                      setShowNewBranchInput(false);
                      setNewBranchName("");
                    }
                  }}
                  placeholder="Branch name..."
                  className="flex-1 px-3 py-2 text-sm rounded border outline-none focus:ring-1 focus:ring-blue-500"
                  style={{
                    backgroundColor: "var(--ui-background)",
                    color: "var(--ui-foreground)",
                    borderColor: "var(--ui-border)",
                  }}
                  autoFocus
                />
                <button
                  onClick={handleCreateBranch}
                  disabled={!newBranchName.trim()}
                  className="px-3 py-2 text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#3b82f6", color: "white" }}
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowNewBranchInput(false);
                    setNewBranchName("");
                  }}
                  className="px-3 py-2 text-sm rounded hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Rename branch input */}
          {showRenameInput && (
            <div className="px-4 py-3 border-t" style={{ borderColor: "var(--ui-border)" }}>
              <div className="text-xs opacity-70 mb-2">
                Rename: {showRenameInput.branch.name}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={showRenameInput.newName}
                  onChange={(e) => setShowRenameInput({ ...showRenameInput, newName: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") performRename();
                    if (e.key === "Escape") setShowRenameInput(null);
                  }}
                  placeholder="New branch name..."
                  className="flex-1 px-3 py-2 text-sm rounded border outline-none focus:ring-1 focus:ring-blue-500"
                  style={{
                    backgroundColor: "var(--ui-background)",
                    color: "var(--ui-foreground)",
                    borderColor: "var(--ui-border)",
                  }}
                  autoFocus
                />
                <button
                  onClick={performRename}
                  disabled={!showRenameInput.newName.trim()}
                  className="px-3 py-2 text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#3b82f6", color: "white" }}
                >
                  Rename
                </button>
                <button
                  onClick={() => setShowRenameInput(null)}
                  className="px-3 py-2 text-sm rounded hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-3 border-t" style={{ borderColor: "var(--ui-border)" }}>
            <button
              onClick={() => setShowNewBranchInput(true)}
              disabled={showNewBranchInput || showRenameInput !== null}
              className="flex items-center justify-center gap-2 w-full px-3 py-2 text-sm rounded hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="size-4" />
              New Branch
            </button>
          </div>
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          data-context-menu
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
                onClick={() => handleCreateBranchFrom(contextMenu.branch.name)}
              >
                <Plus className="size-4" />
                Create branch from '{contextMenu.branch.name}'
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
                onClick={handlePull}
              >
                <Download className="size-4" />
                Pull
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
                onClick={handlePush}
              >
                <Upload className="size-4" />
                Push
              </button>
              <div className="h-px my-1" style={{ backgroundColor: "var(--ui-border)" }} />
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
                onClick={() => handleRename(contextMenu.branch)}
              >
                <span className="size-4 flex items-center justify-center text-xs">✏️</span>
                Rename
              </button>
            </>
          ) : (
            <>
              {/* Non-current branch menu */}
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
                onClick={() => {
                  handleCheckout(contextMenu.branch);
                  setContextMenu(null);
                }}
              >
                <Check className="size-4" />
                Checkout
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
                onClick={() => handleCreateBranchFrom(contextMenu.branch.name)}
              >
                <Plus className="size-4" />
                Create branch from '{contextMenu.branch.name}'
              </button>
              <div className="h-px my-1" style={{ backgroundColor: "var(--ui-border)" }} />
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
                onClick={() => {
                  const currentBranch = branches.find(b => b.is_current);
                  if (currentBranch) {
                    handleRebase(currentBranch.name, contextMenu.branch.name);
                  }
                }}
              >
                <span className="size-4 flex items-center justify-center text-xs">⤴</span>
                Checkout and rebase onto '{contextMenu.branch.name}'
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
                onClick={() => {
                  const currentBranch = branches.find(b => b.is_current);
                  if (currentBranch) {
                    handleRebase(contextMenu.branch.name, currentBranch.name);
                  }
                }}
              >
                <span className="size-4 flex items-center justify-center text-xs">⤵</span>
                Rebase '{contextMenu.branch.name}' onto current
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
                onClick={() => {
                  const currentBranch = branches.find(b => b.is_current);
                  if (currentBranch) {
                    handleMerge(contextMenu.branch.name, currentBranch.name);
                  }
                }}
              >
                <GitMerge className="size-4" />
                Merge '{contextMenu.branch.name}' into current
              </button>
              <div className="h-px my-1" style={{ backgroundColor: "var(--ui-border)" }} />
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors text-red-500"
                onClick={() => {
                  handleDeleteBranch(contextMenu.branch);
                  setContextMenu(null);
                }}
              >
                <Trash2 className="size-4" />
                Delete Branch
              </button>
            </>
          )}
        </div>
      )}

      {/* Confirmation dialogs */}
      {confirmDialog && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
          onClick={() => setConfirmDialog(null)}
        >
          <div
            className="rounded-lg p-6 max-w-md"
            style={{
              backgroundColor: "var(--ui-background)",
              border: "1px solid var(--ui-border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {confirmDialog.type === "checkout" && confirmDialog.hasUncommitted ? (
              <>
                <h3 className="text-lg font-semibold mb-2">Uncommitted Changes</h3>
                <p className="text-sm opacity-70 mb-4">
                  You have uncommitted changes. Do you want to stash them before switching
                  branches?
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setConfirmDialog(null)}
                    className="px-4 py-2 text-sm rounded hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      performCheckout(confirmDialog.branch, false);
                      setConfirmDialog(null);
                    }}
                    className="px-4 py-2 text-sm rounded hover:bg-white/10 transition-colors"
                  >
                    Discard
                  </button>
                  <button
                    onClick={() => {
                      performCheckout(confirmDialog.branch, true);
                      setConfirmDialog(null);
                    }}
                    className="px-4 py-2 text-sm rounded transition-colors"
                    style={{ backgroundColor: "#3b82f6", color: "white" }}
                  >
                    Stash & Switch
                  </button>
                </div>
              </>
            ) : confirmDialog.type === "delete" ? (
              <>
                <h3 className="text-lg font-semibold mb-2">Delete Branch?</h3>
                <p className="text-sm opacity-70 mb-4">
                  Are you sure you want to delete branch{" "}
                  <span className="font-medium">{confirmDialog.branch.name}</span>? This
                  action cannot be undone.
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setConfirmDialog(null)}
                    className="px-4 py-2 text-sm rounded hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => performDelete(confirmDialog.branch)}
                    className="px-4 py-2 text-sm rounded transition-colors"
                    style={{ backgroundColor: "#ef4444", color: "white" }}
                  >
                    Delete
                  </button>
                </div>
              </>
            ) : confirmDialog.type === "merge" ? (
              <>
                <h3 className="text-lg font-semibold mb-2">Merge Branch?</h3>
                <p className="text-sm opacity-70 mb-4">
                  Merge <span className="font-medium">{confirmDialog.branch.name}</span> into{" "}
                  <span className="font-medium">{confirmDialog.targetBranch}</span>?
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setConfirmDialog(null)}
                    className="px-4 py-2 text-sm rounded hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => performMerge(confirmDialog.branch.name, confirmDialog.targetBranch!)}
                    className="px-4 py-2 text-sm rounded transition-colors"
                    style={{ backgroundColor: "#3b82f6", color: "white" }}
                  >
                    Merge
                  </button>
                </div>
              </>
            ) : confirmDialog.type === "rebase" ? (
              <>
                <h3 className="text-lg font-semibold mb-2">Rebase Branch?</h3>
                <p className="text-sm opacity-70 mb-4">
                  Rebase <span className="font-medium">{confirmDialog.branch.name}</span> onto{" "}
                  <span className="font-medium">{confirmDialog.targetBranch}</span>?
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setConfirmDialog(null)}
                    className="px-4 py-2 text-sm rounded hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => performRebase(confirmDialog.branch.name, confirmDialog.targetBranch!)}
                    className="px-4 py-2 text-sm rounded transition-colors"
                    style={{ backgroundColor: "#3b82f6", color: "white" }}
                  >
                    Rebase
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
