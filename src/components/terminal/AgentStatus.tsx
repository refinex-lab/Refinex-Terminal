import { useEffect, useState } from "react";
import { useAIBlocks, useBlockTracker, type AIBlock, type CLIType } from "@/lib/ai-block-detector";
import { CLIIcon } from "@/components/ui/cli-icon";

export type AgentState = "idle" | "thinking" | "writing" | "error" | "waiting";

interface AgentStatusProps {
  sessionId: string;
  variant?: "tab" | "terminal";
}

/**
 * Status colors for different agent states
 */
const STATE_COLORS: Record<AgentState, string> = {
  idle: "#6B7280", // gray
  thinking: "#EAB308", // yellow
  writing: "#22C55E", // green
  error: "#EF4444", // red
  waiting: "#3B82F6", // blue
};

/**
 * Status labels for different agent states
 */
const STATE_LABELS: Record<AgentState, string> = {
  idle: "Idle",
  thinking: "Thinking",
  writing: "Writing",
  error: "Error",
  waiting: "Waiting for input",
};

/**
 * Detect agent state from AI blocks with CLI-specific logic
 */
function detectAgentState(
  blocks: AIBlock[],
  streamingBlock: AIBlock | null,
  activeCLI: CLIType | null
): AgentState {
  // No blocks = idle
  if (blocks.length === 0) {
    return "idle";
  }

  // Check streaming block first
  if (streamingBlock) {
    // CLI-specific state detection
    switch (activeCLI) {
      case "claude":
        return detectClaudeState(streamingBlock);
      case "codex":
        return detectCodexState(streamingBlock);
      case "gemini":
        return detectGeminiState(streamingBlock);
      case "copilot":
        return detectCopilotState(streamingBlock);
      default:
        return detectGenericState(streamingBlock);
    }
  }

  // No streaming block, check most recent completed block
  const latestBlock = blocks[blocks.length - 1];
  if (!latestBlock) {
    return "idle";
  }

  // Check if block ended with waiting state
  if (latestBlock.blockKind === "approval_request") {
    return "waiting";
  }

  return "idle";
}

/**
 * Detect Claude Code state
 */
function detectClaudeState(block: AIBlock): AgentState {
  // Thinking: block kind is "thinking" or "plan"
  if (block.blockKind === "thinking" || block.blockKind === "plan") {
    return "thinking";
  }

  // Waiting: approval request
  if (block.blockKind === "approval_request") {
    return "waiting";
  }

  // Writing: actively streaming message/tool_call/diff
  if (
    block.blockKind === "message" ||
    block.blockKind === "tool_call" ||
    block.blockKind === "diff"
  ) {
    return "writing";
  }

  // Default to writing for streaming blocks
  return "writing";
}

/**
 * Detect Codex CLI state
 */
function detectCodexState(block: AIBlock): AgentState {
  // Thinking: AgentReasoning event (thinking marker)
  if (block.blockKind === "thinking") {
    return "thinking";
  }

  // Waiting: ExecApprovalRequest or RequestUserInput
  if (block.blockKind === "approval_request") {
    return "waiting";
  }

  // Writing: AgentMessage or diff output
  if (block.blockKind === "message" || block.blockKind === "diff") {
    return "writing";
  }

  // Plan updates are considered thinking
  if (block.blockKind === "plan") {
    return "thinking";
  }

  return "writing";
}

/**
 * Detect Gemini CLI state
 */
function detectGeminiState(block: AIBlock): AgentState {
  // Tool execution is considered thinking
  if (block.blockKind === "tool_call") {
    return "thinking";
  }

  // Waiting for confirmation
  if (block.blockKind === "approval_request") {
    return "waiting";
  }

  // Writing: message output
  if (block.blockKind === "message") {
    return "writing";
  }

  return "writing";
}

/**
 * Detect GitHub Copilot CLI state
 */
function detectCopilotState(block: AIBlock): AgentState {
  // Copilot shows suggestions, which is writing
  if (block.blockKind === "message") {
    return "writing";
  }

  // Waiting for user action (Accept/Next/Explain)
  if (block.blockKind === "approval_request") {
    return "waiting";
  }

  return "writing";
}

/**
 * Detect generic state (fallback)
 */
function detectGenericState(block: AIBlock): AgentState {
  if (block.blockKind === "thinking" || block.blockKind === "plan") {
    return "thinking";
  }

  if (block.blockKind === "approval_request") {
    return "waiting";
  }

  return "writing";
}

/**
 * Agent status indicator component
 */
export function AgentStatus({ sessionId, variant = "terminal" }: AgentStatusProps) {
  const blocks = useAIBlocks(sessionId);
  const tracker = useBlockTracker(sessionId);
  const [state, setState] = useState<AgentState>("idle");
  const activeCLI = tracker.getActiveCLI();

  // Update state based on blocks and streaming status
  useEffect(() => {
    const streamingBlock = tracker.getStreamingBlock();
    const newState = detectAgentState(blocks, streamingBlock, activeCLI);
    setState(newState);
  }, [blocks, tracker, activeCLI]);

  // Auto-transition from writing to idle after inactivity
  useEffect(() => {
    if (state === "writing" || state === "thinking") {
      const timer = setTimeout(() => {
        const streamingBlock = tracker.getStreamingBlock();
        if (!streamingBlock) {
          setState("idle");
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [state, tracker]);

  const color = STATE_COLORS[state];
  const label = STATE_LABELS[state];

  // Animation classes based on state
  const getAnimationClass = () => {
    switch (state) {
      case "thinking":
        return "animate-pulse";
      case "writing":
        return "animate-pulse";
      case "waiting":
        return "animate-[blink_1s_ease-in-out_infinite]";
      default:
        return "";
    }
  };

  if (variant === "tab") {
    // Compact version for tab bar
    return (
      <div
        className="flex items-center gap-1.5"
        title={label}
      >
        {activeCLI && activeCLI !== "generic" && (
          <CLIIcon type={activeCLI} size={12} className="opacity-70" />
        )}
        <div
          className={`size-2 rounded-full ${getAnimationClass()}`}
          style={{ backgroundColor: color }}
        />
      </div>
    );
  }

  // Full version for terminal bottom-right
  return (
    <div
      className="flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium"
      style={{
        backgroundColor: "var(--terminal-background)",
        border: "1px solid var(--ui-border)",
        color: "var(--terminal-foreground)",
      }}
    >
      {activeCLI && activeCLI !== "generic" && (
        <CLIIcon type={activeCLI} size={14} className="opacity-80" />
      )}
      <div
        className={`size-2 rounded-full ${getAnimationClass()}`}
        style={{ backgroundColor: color }}
      />
      <span style={{ opacity: 0.8 }}>{label}</span>
    </div>
  );
}

/**
 * Enhanced agent state detector hook
 */
export function useAgentState(sessionId: string): AgentState {
  const blocks = useAIBlocks(sessionId);
  const tracker = useBlockTracker(sessionId);
  const [state, setState] = useState<AgentState>("idle");

  useEffect(() => {
    const streamingBlock = tracker.getStreamingBlock();
    const activeCLI = tracker.getActiveCLI();
    const newState = detectAgentState(blocks, streamingBlock, activeCLI);
    setState(newState);
  }, [blocks, tracker]);

  return state;
}
