import { create } from "zustand";

/**
 * AI CLI types that can be detected
 */
export type CLIType = "claude-code" | "codex" | "copilot" | "gemini" | "generic";

/**
 * Represents a detected AI output block in the terminal
 */
export interface AIBlock {
  id: string;
  cliType: CLIType;
  startLine: number;
  endLine: number;
  isCollapsed: boolean;
  isStreaming: boolean;
}

/**
 * Detection patterns for different AI CLIs
 */
const PATTERNS = {
  // Claude Code patterns
  claudeCode: {
    boxStart: /^╭─/,
    boxEnd: /^╰─/,
    header: /Claude|claude/,
    thinking: /Thinking\.\.\.|🤔|analyzing/i,
  },
  // Codex CLI patterns
  codex: {
    prompt: /^codex>|^\[codex\]/i,
    toolUse: /^Tool:|^Function:/i,
    codeFence: /^```[\w]*$/,
  },
  // GitHub Copilot CLI patterns
  copilot: {
    prompt: /^copilot>|^\[copilot\]/i,
    suggestion: /^Suggestion:|^💡/i,
  },
  // Gemini CLI patterns
  gemini: {
    prompt: /^gemini>|^\[gemini\]/i,
    thinking: /^Thinking|^Processing/i,
  },
  // Generic AI output patterns
  generic: {
    codeFence: /^```[\w]*$/,
    longOutput: /^[^\$#>%]\S+/, // Lines that don't start with shell prompts
    ansiHeavy: /\x1b\[[0-9;]*m.*\x1b\[[0-9;]*m/, // Multiple ANSI sequences
  },
};

/**
 * Tracks AI output blocks for a terminal session
 */
export class BlockTracker {
  private blocks: Map<string, AIBlock> = new Map();
  private currentBlock: AIBlock | null = null;
  private lineBuffer: string[] = [];
  private consecutiveNonPromptLines = 0;
  private inCodeFence = false;
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Process a new line of terminal output
   */
  processLine(line: string, lineNumber: number): void {
    // Strip ANSI codes for pattern matching
    const cleanLine = this.stripAnsi(line);

    // Check for Claude Code box boundaries
    if (PATTERNS.claudeCode.boxStart.test(cleanLine)) {
      this.startBlock("claude-code", lineNumber);
      return;
    }

    if (PATTERNS.claudeCode.boxEnd.test(cleanLine) && this.currentBlock?.cliType === "claude-code") {
      this.endBlock(lineNumber);
      return;
    }

    // Check for Codex patterns
    if (PATTERNS.codex.prompt.test(cleanLine)) {
      this.startBlock("codex", lineNumber);
      return;
    }

    // Check for Copilot patterns
    if (PATTERNS.copilot.prompt.test(cleanLine)) {
      this.startBlock("copilot", lineNumber);
      return;
    }

    // Check for Gemini patterns
    if (PATTERNS.gemini.prompt.test(cleanLine)) {
      this.startBlock("gemini", lineNumber);
      return;
    }

    // Track code fences
    if (PATTERNS.generic.codeFence.test(cleanLine)) {
      this.inCodeFence = !this.inCodeFence;
      if (this.inCodeFence && !this.currentBlock) {
        this.startBlock("generic", lineNumber);
      }
    }

    // Detect long unbroken text blocks (generic AI output)
    if (this.isNonPromptLine(cleanLine)) {
      this.consecutiveNonPromptLines++;
      if (this.consecutiveNonPromptLines > 20 && !this.currentBlock) {
        // Start a generic AI block
        this.startBlock("generic", lineNumber - 20);
      }
    } else {
      // Reset counter on shell prompt
      if (this.isShellPrompt(cleanLine)) {
        this.consecutiveNonPromptLines = 0;
        if (this.currentBlock?.cliType === "generic") {
          this.endBlock(lineNumber - 1);
        }
      }
    }

    // Update current block end line if streaming
    if (this.currentBlock && this.currentBlock.isStreaming) {
      this.currentBlock.endLine = lineNumber;
      this.blocks.set(this.currentBlock.id, { ...this.currentBlock });
    }

    this.lineBuffer.push(line);
  }

  /**
   * Start tracking a new AI block
   */
  private startBlock(cliType: CLIType, startLine: number): void {
    // End previous block if exists
    if (this.currentBlock) {
      this.endBlock(startLine - 1);
    }

    const block: AIBlock = {
      id: `${this.sessionId}-block-${Date.now()}`,
      cliType,
      startLine,
      endLine: startLine,
      isCollapsed: false,
      isStreaming: true,
    };

    this.currentBlock = block;
    this.blocks.set(block.id, block);
    this.consecutiveNonPromptLines = 0;
  }

  /**
   * End the current AI block
   */
  private endBlock(endLine: number): void {
    if (!this.currentBlock) return;

    this.currentBlock.endLine = endLine;
    this.currentBlock.isStreaming = false;
    this.blocks.set(this.currentBlock.id, { ...this.currentBlock });
    this.currentBlock = null;
    this.inCodeFence = false;
  }

  /**
   * Check if a line is a non-prompt line (potential AI output)
   */
  private isNonPromptLine(line: string): boolean {
    // Empty lines don't count
    if (!line.trim()) return false;

    // Lines starting with common shell prompts don't count
    if (this.isShellPrompt(line)) return false;

    return true;
  }

  /**
   * Check if a line looks like a shell prompt
   */
  private isShellPrompt(line: string): boolean {
    const promptPatterns = [
      /^[\w@-]+[:#$%>]\s*$/, // user@host:~$
      /^[\w@-]+.*[:#$%>]\s*$/, // user@host ~/path $
      /^PS\s+\d+>/, // PowerShell
      /^C:\\.*>/, // Windows cmd
      /^➜/, // Oh My Zsh arrow
      /^λ/, // Lambda prompt
    ];

    return promptPatterns.some((pattern) => pattern.test(line));
  }

  /**
   * Strip ANSI escape codes from a string
   */
  private stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
  }

  /**
   * Get all blocks for this session
   */
  getBlocks(): AIBlock[] {
    return Array.from(this.blocks.values());
  }

  /**
   * Get a specific block by ID
   */
  getBlock(id: string): AIBlock | undefined {
    return this.blocks.get(id);
  }

  /**
   * Toggle block collapsed state
   */
  toggleCollapse(id: string): void {
    const block = this.blocks.get(id);
    if (block) {
      block.isCollapsed = !block.isCollapsed;
      this.blocks.set(id, { ...block });
    }
  }

  /**
   * Clear all blocks
   */
  clear(): void {
    this.blocks.clear();
    this.currentBlock = null;
    this.lineBuffer = [];
    this.consecutiveNonPromptLines = 0;
    this.inCodeFence = false;
  }
}

/**
 * Zustand store for managing AI blocks across all terminal sessions
 */
interface AIBlockStore {
  trackers: Map<string, BlockTracker>;
  getTracker: (sessionId: string) => BlockTracker;
  removeTracker: (sessionId: string) => void;
  toggleCollapse: (sessionId: string, blockId: string) => void;
}

export const useAIBlockStore = create<AIBlockStore>((set, get) => ({
  trackers: new Map(),

  getTracker: (sessionId: string) => {
    const { trackers } = get();
    let tracker = trackers.get(sessionId);
    if (!tracker) {
      tracker = new BlockTracker(sessionId);
      trackers.set(sessionId, tracker);
      set({ trackers: new Map(trackers) });
    }
    return tracker;
  },

  removeTracker: (sessionId: string) => {
    const { trackers } = get();
    trackers.delete(sessionId);
    set({ trackers: new Map(trackers) });
  },

  toggleCollapse: (sessionId: string, blockId: string) => {
    const tracker = get().getTracker(sessionId);
    tracker.toggleCollapse(blockId);
    set({ trackers: new Map(get().trackers) });
  },
}));

/**
 * React hook to get AI blocks for a terminal session
 */
export function useAIBlocks(sessionId: string): AIBlock[] {
  const trackers = useAIBlockStore((state) => state.trackers);
  const tracker = trackers.get(sessionId);
  return tracker ? tracker.getBlocks() : [];
}

/**
 * React hook to get the block tracker for a session
 */
export function useBlockTracker(sessionId: string): BlockTracker {
  return useAIBlockStore((state) => state.getTracker(sessionId));
}
