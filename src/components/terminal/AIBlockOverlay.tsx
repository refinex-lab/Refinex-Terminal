import { useEffect, useState, useRef } from "react";
import { ChevronDown, ChevronUp, Copy, ArrowDown } from "lucide-react";
import { useAIBlocks, useBlockTracker, type AIBlock, type CLIType } from "@/lib/ai-block-detector";
import { Terminal } from "@xterm/xterm";
import { CLIIcon } from "@/components/ui/cli-icon";

interface AIBlockOverlayProps {
  sessionId: string;
  terminal: Terminal | null;
}

/**
 * Color mapping for different CLI types (brand colors)
 */
const CLI_COLORS: Record<CLIType, string> = {
  "claude": "#D97706", // Anthropic orange
  "codex": "#10A37F", // OpenAI green
  "gemini": "#4285F4", // Google blue
  "copilot": "#8B5CF6", // GitHub Copilot purple
  "generic": "#6B7280", // gray
};

/**
 * CLI display names
 */
const CLI_NAMES: Record<CLIType, string> = {
  "claude": "Claude Code",
  "codex": "Codex CLI",
  "gemini": "Gemini CLI",
  "copilot": "GitHub Copilot",
  "generic": "AI Output",
};

export function AIBlockOverlay({ sessionId, terminal }: AIBlockOverlayProps) {
  const blocks = useAIBlocks(sessionId);
  const tracker = useBlockTracker(sessionId);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Monitor terminal scroll position
  useEffect(() => {
    if (!terminal) return;

    const handleScroll = () => {
      const viewport = terminal.element?.querySelector(".xterm-viewport");
      if (!viewport) return;

      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
      setShowScrollToBottom(!isAtBottom);
    };

    const viewport = terminal.element?.querySelector(".xterm-viewport");
    if (viewport) {
      viewport.addEventListener("scroll", handleScroll);
      return () => viewport.removeEventListener("scroll", handleScroll);
    }
  }, [terminal]);

  const handleToggleCollapse = (blockId: string) => {
    tracker.toggleCollapse(blockId);
  };

  const handleCopyBlock = async (block: AIBlock) => {
    if (!terminal) return;

    try {
      // Extract block content from terminal buffer
      const buffer = terminal.buffer.active;
      const lines: string[] = [];

      for (let i = block.startLine; i <= block.endLine; i++) {
        const line = buffer.getLine(i);
        if (line) {
          lines.push(line.translateToString(true));
        }
      }

      const content = lines.join("\n");
      await navigator.clipboard.writeText(content);
    } catch (error) {
      console.error("Failed to copy block:", error);
    }
  };

  const handleScrollToBottom = () => {
    const viewport = terminal?.element?.querySelector(".xterm-viewport");
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  };

  const getBlockPosition = (block: AIBlock) => {
    if (!terminal) return null;

    const charHeight = terminal.rows > 0 ? terminal.element!.clientHeight / terminal.rows : 17;
    const top = block.startLine * charHeight;
    const height = (block.endLine - block.startLine + 1) * charHeight;

    return { top, height };
  };

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
    >
      {/* AI Block Indicators */}
      {blocks.map((block) => {
        const position = getBlockPosition(block);
        if (!position) return null;

        const color = CLI_COLORS[block.cliType];
        const name = CLI_NAMES[block.cliType];
        const lineCount = block.endLine - block.startLine + 1;

        return (
          <div
            key={block.id}
            className="absolute left-0 right-0 transition-all duration-200"
            style={{
              top: `${position.top}px`,
              height: block.isCollapsed ? "auto" : `${position.height}px`,
            }}
          >
            {/* Left border indicator (3px wide) */}
            <div
              className="absolute left-0 top-0 bottom-0"
              style={{
                width: "3px",
                backgroundColor: color
              }}
            />

            {/* Block header with controls */}
            <div
              className="absolute right-2 top-1 flex items-center gap-1 pointer-events-auto"
              style={{
                backgroundColor: "var(--terminal-background)",
                borderRadius: "4px",
                padding: "2px 6px",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)",
              }}
            >
              {/* CLI Icon */}
              {block.cliType !== "generic" && (
                <CLIIcon type={block.cliType} size={14} className="opacity-70" />
              )}

              {/* Block info */}
              {block.isCollapsed && (
                <span
                  className="text-xs font-medium mr-2"
                  style={{ color: "var(--terminal-foreground)" }}
                >
                  {lineCount > 50000
                    ? `${name} — Block is very large (${lineCount.toLocaleString()} lines) — click to expand`
                    : `${name} — ${lineCount.toLocaleString()} lines (collapsed)`}
                </span>
              )}

              {/* Copy button */}
              <button
                onClick={() => handleCopyBlock(block)}
                className="p-1 rounded hover:bg-white/10 transition-colors"
                style={{ color: "var(--terminal-foreground)" }}
                title="Copy block"
              >
                <Copy className="size-3.5" />
              </button>

              {/* Collapse/Expand button */}
              <button
                onClick={() => handleToggleCollapse(block.id)}
                className="p-1 rounded hover:bg-white/10 transition-colors"
                style={{ color: "var(--terminal-foreground)" }}
                title={block.isCollapsed ? "Expand" : "Collapse"}
              >
                {block.isCollapsed ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronUp className="size-3.5" />
                )}
              </button>

              {/* Streaming indicator */}
              {block.isStreaming && (
                <div
                  className="w-2 h-2 rounded-full animate-pulse ml-1"
                  style={{ backgroundColor: color }}
                  title="Streaming..."
                />
              )}
            </div>

            {/* Collapsed overlay */}
            {block.isCollapsed && (
              <div
                className="absolute left-4 right-0 top-0 pointer-events-none"
                style={{
                  height: `${position.height}px`,
                  backgroundColor: "var(--terminal-background)",
                  opacity: 0.95,
                }}
              />
            )}
          </div>
        );
      })}

      {/* Scroll to bottom button */}
      {showScrollToBottom && (
        <button
          onClick={handleScrollToBottom}
          className="absolute bottom-4 right-4 pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-full shadow-lg transition-all duration-200 hover:scale-105"
          style={{
            backgroundColor: "var(--ui-button-background)",
            color: "var(--ui-foreground)",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
          }}
          title="Scroll to bottom"
        >
          <ArrowDown className="size-4" />
          <span className="text-xs font-medium">Scroll to bottom</span>
        </button>
      )}
    </div>
  );
}
