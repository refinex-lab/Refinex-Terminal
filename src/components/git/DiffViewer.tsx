import { useState } from "react";
import { X, FileText, Trash2, Columns2, AlignLeft } from "lucide-react";
import { useFileEditorStore } from "@/stores/file-editor-store";
import { toast } from "sonner";
import Prism from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-css";
import "prismjs/components/prism-python";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-go";
import "prismjs/components/prism-java";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markdown";

interface DiffViewerProps {
  filePath: string;
  diffContent: string;
  changeType: "modified" | "added" | "deleted" | "renamed";
  staged: boolean;
  onClose: () => void;
  onDiscard?: () => Promise<void>;
}

interface DiffLine {
  type: "add" | "remove" | "context" | "header";
  oldLineNumber: number | null;
  newLineNumber: number | null;
  content: string;
  rawContent: string;
}

interface DiffHunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export function DiffViewer({
  filePath,
  diffContent,
  changeType,
  staged,
  onClose,
  onDiscard,
}: DiffViewerProps) {
  const [viewMode, setViewMode] = useState<"unified" | "split">("unified");
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const { openFile } = useFileEditorStore();

  // Parse diff content into structured hunks
  const parseDiff = (): DiffHunk[] => {
    const lines = diffContent.split("\n");
    const hunks: DiffHunk[] = [];
    let currentHunk: DiffHunk | null = null;
    let oldLineNum = 0;
    let newLineNum = 0;

    for (const line of lines) {
      // Hunk header: @@ -oldStart,oldLines +newStart,newLines @@
      if (line.startsWith("@@")) {
        const match = line.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
        if (match) {
          if (currentHunk) {
            hunks.push(currentHunk);
          }

          const oldStart = parseInt(match[1] ?? "0");
          const oldLines = match[2] ? parseInt(match[2]) : 1;
          const newStart = parseInt(match[3] ?? "0");
          const newLines = match[4] ? parseInt(match[4]) : 1;

          currentHunk = {
            header: line,
            oldStart,
            oldLines,
            newStart,
            newLines,
            lines: [],
          };

          oldLineNum = oldStart;
          newLineNum = newStart;
        }
        continue;
      }

      // Skip diff headers (---, +++, diff, index, etc.)
      if (
        line.startsWith("---") ||
        line.startsWith("+++") ||
        line.startsWith("diff ") ||
        line.startsWith("index ")
      ) {
        continue;
      }

      if (!currentHunk) continue;

      if (line.startsWith("+")) {
        currentHunk.lines.push({
          type: "add",
          oldLineNumber: null,
          newLineNumber: newLineNum++,
          content: line.substring(1),
          rawContent: line,
        });
      } else if (line.startsWith("-")) {
     currentHunk.lines.push({
          type: "remove",
          oldLineNumber: oldLineNum++,
          newLineNumber: null,
          content: line.substring(1),
          rawContent: line,
        });
      } else if (line.startsWith(" ") || line === "") {
        // Context line (starts with space) or empty line
        currentHunk.lines.push({
          type: "context",
          oldLineNumber: oldLineNum++,
          newLineNumber: newLineNum++,
          content: line.startsWith(" ") ? line.substring(1) : line,
          rawContent: line,
        });
      } else if (line.startsWith("\\")) {
        // "\ No newline at end of file" - skip
        continue;
      }
    }

    if (currentHunk) {
      hunks.push(currentHunk);
    }

    return hunks;
  };

  const hunks = parseDiff();

  // Detect language from file extension
  const getLanguage = (path: string): string => {
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    const langMap: Record<string, string> = {
      js: "javascript",
      jsx: "jsx",
      ts: "typescript",
      tsx: "tsx",
      py: "python",
      rs: "rust",
      go: "go",
      java: "java",
      json: "json",
      css: "css",
      md: "markdown",
    };
    return langMap[ext] || "text";
  };

  // Apply syntax highlighting to a line
  const highlightLine = (content: string, language: string): string => {
    if (language === "text" || !content.trim()) {
      return content;
    }

    try {
      const grammar = Prism.languages[language];
      if (!grammar) return content;

      return Prism.highlight(content, grammar, language);
    } catch {
      return content;
    }
  };

  const language = getLanguage(filePath);

  const handleOpenFile = () => {
    const fileName = filePath.split("/").pop() || filePath;
    openFile({
      path: filePath,
      name: fileName,
      content: "",
      language,
    });
  };

  const handleDiscard = async () => {
    if (!onDiscard) return;

    try {
      await onDiscard();
      setShowDiscardDialog(false);
      toast.success("Changes discarded");
      onClose();
    } catch (error) {
      toast.error(`Failed to discard changes: ${error}`);
    }
  };

  const getChangeTypeColor = () => {
    switch (changeType) {
      case "added":
        return "#22c55e";
      case "deleted":
        return "#ef4444";
      case "modified":
        return "#3b82f6";
      case "renamed":
        return "#f59e0b";
      default:
        return "var(--ui-foreground)";
    }
  };

  const getChangeTypeLabel = () => {
    switch (changeType) {
      case "added":
        return "Added";
      case "deleted":
        return "Deleted";
      case "modified":
        return "Modified";
      case "renamed":
        return "Renamed";
      default:
        return "Changed";
    }
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{
        backgroundColor: "var(--ui-background)",
        color: "var(--ui-foreground)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--ui-border)" }}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <FileText className="size-5 flex-shrink-0" />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{filePath}</span>
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  backgroundColor: `${getChangeTypeColor()}20`,
                  color: getChangeTypeColor(),
                }}
              >
                {getChangeTypeLabel()}
              </span>
            </div>
            <span className="text-xs opacity-70">
              {staged ? "Staged changes" : "Unstaged changes"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center gap-1 mr-2">
            <button
              onClick={() => setViewMode("unified")}
              className={`p-1.5 rounded transition-colors ${
                viewMode === "unified" ? "bg-white/10" : "hover:bg-white/5"
              }`}
              title="Unified view"
            >
              <AlignLeft className="size-4" />
            </button>
            <button
              onClick={() => setViewMode("split")}
              className={`p-1.5 rounded transition-colors ${
                viewMode === "split" ? "bg-white/10" : "hover:bg-white/5"
              }`}
              title="Split view"
            >
              <Columns2 className="size-4" />
            </button>
          </div>

          <button
            onClick={handleOpenFile}
            className="px-3 py-1.5 text-sm rounded hover:bg-white/10 transition-colors"
            title="Open file"
          >
            Open File
          </button>

          {!staged && onDiscard && (
            <button
              onClick={() => setShowDiscardDialog(true)}
              className="px-3 py-1.5 text-sm rounded hover:bg-red-500/20 transition-colors text-red-500"
              title="Discard changes"
            >
              <Trash2 className="size-4" />
            </button>
          )}

          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-auto">
        {hunks.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm opacity-70">
            No changes to display
          </div>
        ) : viewMode === "unified" ? (
          <UnifiedView hunks={hunks} language={language} highlightLine={highlightLine} />
        ) : (
          <SplitView hunks={hunks} language={language} highlightLine={highlightLine} />
        )}
      </div>

      {/* Discard confirmation dialog */}
      {showDiscardDialog && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
          onClick={() => setShowDiscardDialog(false)}
        >
          <div
            className="rounded-lg p-6 max-w-md"
            style={{
              backgroundColor: "var(--ui-background)",
              border: "1px solid var(--ui-border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2">Discard Changes?</h3>
            <p className="text-sm opacity-70 mb-4">
              This will permanently discard all unstaged changes in{" "}
              <span className="font-medium">{filePath}</span>. This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDiscardDialog(false)}
                className="px-4 py-2 text-sm rounded hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDiscard}
                className="px-4 py-2 text-sm rounded transition-colors"
                style={{ backgroundColor: "#ef4444", color: "white" }}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Unified view component
function UnifiedView({
  hunks,
  language,
  highlightLine,
}: {
  hunks: DiffHunk[];
  language: string;
  highlightLine: (content: string, language: string) => string;
}) {
  return (
    <div className="font-mono text-sm">
      {hunks.map((hunk, hunkIndex) => (
        <div key={hunkIndex} className="mb-4">
          {/* Hunk header */}
          <div
            className="px-4 py-2 text-xs"
            style={{
              backgroundColor: "rgba(59, 130, 246, 0.1)",
              color: "#3b82f6",
            }}
          >
            {hunk.header}
          </div>

          {/* Lines */}
          {hunk.lines.map((line, lineIndex) => {
            const bgColor =
              line.type === "add"
                ? "rgba(34, 197, 94, 0.25)"
                : line.type === "remove"
                  ? "rgba(239, 68, 68, 0.25)"
                  : "transparent";

            const gutterBg =
              line.type === "add"
                ? "rgba(34, 197, 94, 0.3)"
                : line.type === "remove"
                  ? "rgba(239, 68, 68, 0.3)"
                  : "rgba(255, 255, 255, 0.05)";

            const prefixColor =
              line.type === "add"
                ? "#22c55e"
                : line.type === "remove"
                  ? "#ef4444"
                  : "var(--ui-muted-foreground)";

            const prefix =
              line.type === "add"
                ? "+"
                : line.type === "remove"
                  ? "-"
                  : " ";

            return (
              <div
                key={lineIndex}
                className="flex"
                style={{ backgroundColor: bgColor }}
              >
                {/* Old line number */}
                <div
                  className="w-12 text-right px-2 py-1 text-xs select-none flex-shrink-0"
                  style={{
                    backgroundColor: gutterBg,
                    color: "var(--ui-muted-foreground)",
                  }}
                >
                  {line.oldLineNumber ?? ""}
                </div>

                {/* New line number */}
                <div
                  className="w-12 text-right px-2 py-1 text-xs select-none flex-shrink-0 border-r"
                  style={{
                    backgroundColor: gutterBg,
                    color: "vauted-foreground)",
                    borderColor: "var(--ui-border)",
                  }}
                >
                  {line.newLineNumber ?? ""}
                </div>

                {/* Prefix (+/-/ ) */}
                <div
                  className="w-6 text-center py-1 text-xs select-none flex-shrink-0"
                  style={{ color: prefixColor, fontWeight: "bold" }}
                >
                  {prefix}
                </div>

                {/* Line content */}
                <div className="flex-1 px-2 py-1 overflow-x-auto">
          <code
                    dangerouslySetInnerHTML={{
                      __html: highlightLine(line.content, language),
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Split view component
function SplitView({
  hunks,
  language,
  highlightLine,
}: {
  hunks: DiffHunk[];
  language: string;
  highlightLine: (content: string, language: string) => string;
}) {
  return (
    <div className="font-mono text-sm">
      {hunks.map((hunk, hunkIndex) => (
        <div key={hunkIndex} className="mb-4">
          {/* Hunk header */}
          <div
            className="px-4 py-2 text-xs"
            style={{
              backgroundColor: "rgba(59, 130, 246, 0.1)",
              color: "#3b82f6",
            }}
          >
            {hunk.header}
          </div>

          {/* Split view grid */}
          <div className="grid grid-cols-2 gap-px" style={{ backgroundColor: "var(--ui-border)" }}>
            {/* Left side (old) */}
            <div>
              {hunk.lines.map((line, lineIndex) => {
                if (line.type === "add") {
                  // Empty placeholder for added lines
                  return (
                    <div
                      key={lineIndex}
                      className="flex"
                      style={{ backgroundColor: "var(--ui-background)" }}
                    >
                      <div
                        className="w-12 text-right px-2 py-1 text-xs select-none"
                        style={{
                          backgroundColor: "rgba(255, 255, 255, 0.05)",
                          color: "var(--ui-muted-foreground)",
                        }}
                      />
                      <div
                        className="w-6 text-center py-1 text-xs select-none"
                        style={{ color: "var(--ui-muted-foreground)" }}
                      />
                      <div className="flex-1 px-2 py-1">&nbsp;</div>
                    </div>
                  );
                }

                const bgColor =
                  line.type === "remove"
                    ? "rgba(239, 68, 68, 0.25)"
                    : "var(--ui-background)";

                const prefix = line.type === "remove" ? "-" : " ";
                const prefixColor = line.type === "remove" ? "#ef4444" : "var(--ui-muted-foreground)";

                return (
                  <div
                    key={lineIndex}
                    className="flex"
                    style={{ backgroundColor: bgColor }}
                  >
                    <div
                      className="w-12 text-right px-2 py-1 text-xs select-none"
                      style={{
                        backgroundColor:
                          line.type === "remove"
                            ? "rgba(239, 68, 68, 0.3)"
                   : "rgba(255, 255, 255, 0.05)",
                        color: "var(--ui-muted-foreground)",
                      }}
                    >
                      {line.oldLineNumber ?? ""}
                    </div>
                    <div
                      className="w-6 text-center py-1 text-xs select-none"
                      style={{ color: prefixColor, fontWeight: "bold" }}
                    >
                      {prefix}
                    </div>
                    <div className="flex-1 px-2 py-1 overflow-x-auto">
                      <code
                        dangerouslySetInnerHTML={{
                          __html: highlightLine(line.content, language),
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right side (new) */}
            <div>
              {hunk.lines.map((line, lineIndex) => {
                if (line.type === "remove") {
                  // Empty placeholder for removed lines
                  return (
                    <div
                      key={lineIndex}
                      className="flex"
                      style={{ backgroundColor: "var(--ui-background)" }}
                    >
                      <div
                        className="w-12 text-right px-2 py-1 text-xs select-none"
                        style={{
                          backgroundColor: "rgba(255, 255, 255, 0.05)",
                          color: "var(--ui-muted-foreground)",
                        }}
                      />
                      <div
                        className="w-6 text-center py-1 text-xs select-none"
                        style={{ color: "var(--ui-muted-foreground)" }}
                      />
                      <div className="flex-1 px-2 py-1">&nbsp;</div>
                    </div>
                  );
                }

                const bgColor =
                  line.type === "add"
                    ? "rgba(34, 197, 94, 0.25)"
                    : "var(--ui-background)";

                const prefix = line.type === "add" ? "+" : " ";
                const prefixColor = line.type === "add" ? "#22c55e" : "var(--ui-muted-foreground)";

                return (
                  <div
                    key={lineIndex}
                    className="flex"
                    style={{ backgroundColor: bgColor }}
                  >
                    <div
                      className="w-12 text-right px-2 py-1 text-xs select-none"
                      style={{
                        backgroundColor:
                          line.type === "add"
                            ? "rgba(34, 197, 94, 0.3)"
                            : "rgba(255, 255, 255, 0.05)",
                        color: "var(--ui-muted-foreground)",
                      }}
                    >
                      {line.newLineNumber ?? ""}
                    </div>
                    <div
                      className="w-6 text-center py-1 text-xs select-none"
                      style={{ color: prefixColor, fontWeight: "bold" }}
                    >
                      {prefix}
                    </div>
                    <div className="flex-1 px-2 py-1 overflow-x-auto">
                      <code
                        dangerouslySetInnerHTML={{
                          __html: highlightLine(line.content, language),
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
