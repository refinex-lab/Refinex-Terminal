import { useEffect, useState, useCallback } from "react";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useFileEditorStore } from "@/stores/file-editor-store";
import {
  gitStatus,
  gitStage,
  gitUnstage,
  gitCommit,
  gitPush,
  gitPull,
  gitFetch,
  gitStash,
  gitDiff,
  type GitStatus,
  type GitFileStatus,
} from "@/lib/git";
import { listen } from "@tauri-apps/api/event";
import {
  GitBranch,
  Plus,
  Check,
  Upload,
  Download,
  RefreshCw,
  Archive,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { BranchManager } from "./BranchManager";

export function GitPanel() {
  const { activeProject } = useSidebarStore();
  const { openFile } = useFileEditorStore();
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [showCommitInput, setShowCommitInput] = useState(false);
  const [showBranchManager, setShowBranchManager] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    staged: true,
    unstaged: true,
    untracked: true,
  });

  const loadStatus = useCallback(async () => {
    if (!activeProject) return;

    try {
      setLoading(true);
      const result = await gitStatus(activeProject.path);
      setStatus(result);
    } catch (error) {
      console.error("Failed to load git status:", error);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [activeProject]);

  // Initial load and polling
  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, [loadStatus]);

  // Listen for file system changes
  useEffect(() => {
    const unlisten = listen("fs-changed", () => {
      loadStatus();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [loadStatus]);

  const handleStageFile = async (file: GitFileStatus) => {
    if (!activeProject) return;

    try {
      await gitStage(activeProject.path, [file.path]);
      await loadStatus();
      toast.success(`Staged ${file.path}`);
    } catch (error) {
      toast.error(`Failed to stage: ${error}`);
    }
  };

  const handleUnstageFile = async (file: GitFileStatus) => {
    if (!activeProject) return;

    try {
      await gitUnstage(activeProject.path, [file.path]);
      await loadStatus();
      toast.success(`Unstaged ${file.path}`);
    } catch (error) {
      toast.error(`Failed to unstage: ${error}`);
    }
  };

  const handleStageAll = async () => {
    if (!activeProject || !status) return;

    const allFiles = [...status.unstaged, ...status.untracked].map((f) => f.path);
    if (allFiles.length === 0) return;

    try {
      await gitStage(activeProject.path, allFiles);
      await loadStatus();
      toast.success(`Staged ${allFiles.length} files`);
    } catch (error) {
      toast.error(`Failed to stage all: ${error}`);
    }
  };

  const handleCommit = async () => {
    if (!activeProject || !commitMessage.trim()) return;

    try {
      const hash = await gitCommit(activeProject.path, commitMessage.trim());
      setCommitMessage("");
      setShowCommitInput(false);
      await loadStatus();
      toast.success(`Committed: ${hash.substring(0, 7)}`);
    } catch (error) {
      toast.error(`Failed to commit: ${error}`);
    }
  };

  const handlePush = async () => {
    if (!activeProject) return;

    try {
      const result = await gitPush(activeProject.path);
      await loadStatus();
      toast.success("Pushed successfully");
      console.log(result);
    } catch (error) {
      toast.error(`Failed to push: ${error}`);
    }
  };

  const handlePull = async () => {
    if (!activeProject) return;

    try {
      const result = await gitPull(activeProject.path);
      await loadStatus();
      toast.success("Pulled successfully");
      console.log(result);
    } catch (error) {
      toast.error(`Failed to pull: ${error}`);
    }
  };

  const handleFetch = async () => {
    if (!activeProject) return;

    try {
      const result = await gitFetch(activeProject.path);
      await loadStatus();
      toast.success("Fetched successfully");
      console.log(result);
    } catch (error) {
      toast.error(`Failed to fetch: ${error}`);
    }
  };

  const handleStash = async () => {
    if (!activeProject) return;

    try {
      const stashId = await gitStash(activeProject.path);
      await loadStatus();
      toast.success(`Stashed: ${stashId.substring(0, 7)}`);
    } catch (error) {
      toast.error(`Failed to stash: ${error}`);
    }
  };

  const handleFileClick = async (file: GitFileStatus) => {
    if (!activeProject) return;

    try {
      const diff = await gitDiff(activeProject.path, file.path, file.staged);

      // Open diff viewer in file editor
      openFile({
        path: `git-diff://${activeProject.path}/${file.path}`,
        name: `${file.path} (${file.staged ? "staged" : "unstaged"})`,
        content: JSON.stringify({
          type: "diff",
          filePath: file.path,
          diffContent: diff,
          changeType: file.status,
          staged: file.staged,
          repoPath: activeProject.path,
        }),
        language: "diff",
      });
    } catch (error) {
      toast.error(`Failed to load diff: ${error}`);
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "added":
        return <Plus className="size-3 text-green-500" />;
      case "modified":
        return <span className="text-blue-500 text-xs font-bold">M</span>;
      case "deleted":
        return <span className="text-red-500 text-xs font-bold">-</span>;
      case "renamed":
        return <span className="text-yellow-500 text-xs font-bold">R</span>;
      case "untracked":
        return <span className="text-gray-500 text-xs font-bold">?</span>;
      default:
        return null;
    }
  };

  if (!activeProject) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full p-4 text-center"
        style={{ color: "var(--ui-muted-foreground)" }}
      >
        <GitBranch className="size-12 mb-2 opacity-50" />
        <p className="text-sm">No project selected</p>
      </div>
    );
  }

  if (loading && !status) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ color: "var(--ui-muted-foreground)" }}
      >
        <RefreshCw className="size-6 animate-spin" />
      </div>
    );
  }

  if (!status) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full p-4 text-center"
        style={{ color: "var(--ui-muted-foreground)" }}
      >
        <GitBranch className="size-12 mb-2 opacity-50" />
        <p className="text-sm">Not a git repository</p>
      </div>
    );
  }

  const hasStagedChanges = status.staged.length > 0;
  const hasUnstagedChanges = status.unstaged.length > 0;
  const hasUntrackedFiles = status.untracked.length > 0;

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{
        backgroundColor: "var(--ui-background)",
        color: "var(--ui-foreground)",
      }}
    >
      {/* Branch indicator */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b cursor-pointer hover:bg-white/5 transition-colors"
        style={{ borderColor: "var(--ui-border)" }}
        onClick={() => setShowBranchManager(true)}
        title="Click to manage branches"
      >
        <GitBranch className="size-4" />
        <span className="font-medium">{status.branch}</span>
        {(status.ahead > 0 || status.behind > 0) && (
          <span
            className="text-xs px-2 py-0.5 rounded"
            style={{ backgroundColor: "rgba(59, 130, 246, 0.2)", color: "#3b82f6" }}
          >
            {status.ahead > 0 && `↑${status.ahead}`}
            {status.behind > 0 && ` ↓${status.behind}`}
          </span>
        )}
      </div>

      {/* File sections */}
      <div className="flex-1 overflow-y-auto">
        {/* Staged changes */}
        {hasStagedChanges && (
          <div className="border-b" style={{ borderColor: "var(--ui-border)" }}>
            <button
              onClick={() => toggleSection("staged")}
              className="flex items-center gap-2 w-full px-4 py-2 hover:bg-white/5 transition-colors"
            >
              {expandedSections.staged ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
              <span className="text-sm font-medium">
                Staged Changes ({status.staged.length})
              </span>
            </button>
            {expandedSections.staged && (
              <div className="pb-2">
                {status.staged.map((file) => (
                  <div
                    key={file.path}
                    className="flex items-center gap-2 px-4 py-1 hover:bg-white/5 cursor-pointer group"
                    onClick={() => handleFileClick(file)}
                  >
                    <div className="w-4 flex items-center justify-center">
                      {getStatusIcon(file.status)}
                    </div>
                    <span className="text-sm flex-1 truncate">{file.path}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnstageFile(file);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-opacity"
                      title="Unstage"
                    >
                      <span className="text-xs">−</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Unstaged changes */}
        {hasUnstagedChanges && (
          <div className="border-b" style={{ borderColor: "var(--ui-border)" }}>
            <button
              onClick={() => toggleSection("unstaged")}
              className="flex items-center gap-2 w-full px-4 py-2 hover:bg-white/5 transition-colors"
            >
              {expandedSections.unstaged ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
              <span className="text-sm font-medium">
                Unstaged Changes ({status.unstaged.length})
              </span>
            </button>
            {expandedSections.unstaged && (
              <div className="pb-2">
                {status.unstaged.map((file) => (
                  <div
                    key={file.path}
                    className="flex items-center gap-2 px-4 py-1 hover:bg-white/5 cursor-pointer group"
                    onClick={() => handleFileClick(file)}
                  >
                    <div className="w-4 flex items-center justify-center">
                      {getStatusIcon(file.status)}
                    </div>
                    <span className="text-sm flex-1 truncate">{file.path}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStageFile(file);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-opacity"
                      title="Stage"
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Untracked files */}
        {hasUntrackedFiles && (
          <div className="border-b" style={{ borderColor: "var(--ui-border)" }}>
            <button
              onClick={() => toggleSection("untracked")}
              className="flex items-center gap-2 w-full px-4 py-2 hover:bg-white/5 transition-colors"
            >
              {expandedSections.untracked ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
              <span className="text-sm font-medium">
                Untracked Files ({status.untracked.length})
              </span>
            </button>
            {expandedSections.untracked && (
              <div className="pb-2">
                {status.untracked.map((file) => (
                  <div
                    key={file.path}
                    className="flex items-center gap-2 px-4 py-1 hover:bg-white/5 cursor-pointer group"
                  >
                    <div className="w-4 flex items-center justify-center">
                      {getStatusIcon(file.status)}
                    </div>
                    <span className="text-sm flex-1 truncate">{file.path}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStageFile(file);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-opacity"
                      title="Stage"
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!hasStagedChanges && !hasUnstagedChanges && !hasUntrackedFiles && (
          <div
            className="flex flex-col items-center justify-center p-8 text-center"
            style={{ color: "var(--ui-muted-foreground)" }}
          >
            <Check className="size-12 mb-2 opacity-50" />
            <p className="text-sm">No changes</p>
          </div>
        )}
      </div>

      {/* Commit input */}
      {showCommitInput && (
        <div
          className="border-t p-3"
          style={{ borderColor: "var(--ui-border)" }}
        >
          <textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                handleCommit();
              }
            }}
            placeholder="Commit message..."
            className="w-full px-3 py-2 text-sm rounded border resize-none"
            style={{
              backgroundColor: "var(--ui-background)",
              color: "var(--ui-foreground)",
              borderColor: "var(--ui-border)",
            }}
            rows={3}
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleCommit}
              disabled={!commitMessage.trim()}
              className="flex-1 px-3 py-1.5 text-sm rounded hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#3b82f6", color: "white" }}
            >
              Commit
            </button>
            <button
              onClick={() => {
                setShowCommitInput(false);
                setCommitMessage("");
              }}
              className="px-3 py-1.5 text-sm rounded hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div
        className="border-t p-3 space-y-2"
        style={{ borderColor: "var(--ui-border)" }}
      >
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleStageAll}
            disabled={!hasUnstagedChanges && !hasUntrackedFiles}
            className="flex items-center justify-center gap-2 px-3 py-2 text-sm rounded hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Stage All"
          >
            <Plus className="size-4" />
            <span>Stage All</span>
          </button>
          <button
            onClick={() => setShowCommitInput(!showCommitInput)}
            disabled={!hasStagedChanges}
            className="flex items-center justify-center gap-2 px-3 py-2 text-sm rounded hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Commit"
          >
            <Check className="size-4" />
            <span>Commit</span>
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={handlePush}
            className="flex items-center justify-center p-2 text-sm rounded hover:bg-white/10 transition-colors"
            title="Push"
          >
            <Upload className="size-4" />
          </button>
          <button
            onClick={handlePull}
            className="flex items-center justify-center p-2 text-sm rounded hover:bg-white/10 transition-colors"
            title="Pull"
          >
            <Download className="size-4" />
          </button>
          <button
            onClick={handleFetch}
            className="flex items-center justify-center p-2 text-sm rounded hover:bg-white/10 transition-colors"
            title="Fetch"
          >
            <RefreshCw className="size-4" />
          </button>
          <button
            onClick={handleStash}
            disabled={!hasUnstagedChanges}
            className="flex items-center justify-center p-2 text-sm rounded hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Stash"
          >
            <Archive className="size-4" />
          </button>
        </div>
      </div>

      {/* Branch Manager */}
      {showBranchManager && activeProject && status && (
        <BranchManager
          repoPath={activeProject.path}
          currentBranch={status.branch}
          onClose={() => setShowBranchManager(false)}
          onBranchChanged={loadStatus}
        />
      )}
    </div>
  );
}
