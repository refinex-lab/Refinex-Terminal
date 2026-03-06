import { create } from "zustand";
import { useMemo } from "react";

/**
 * AI CLI types that can be detected
 */
export type CLIType = "claude" | "codex" | "gemini" | "copilot" | "generic";

/**
 * Block kind classification
 */
export type BlockKind =
  | "message"
  | "thinking"
  | "tool_call"
  | "approval_request"
  | "plan"
  | "diff"
  | "generic";

/**
 * Represents a detected AI output block in the terminal
 */
export interface AIBlock {
  id: string;
  cliType: CLIType;
  startLine: number;
  endLine: number; // -1 means still streaming
  isCollapsed: boolean;
  isStreaming: boolean;
  blockKind: BlockKind;
}

/**
 * Detection patterns for different AI CLIs
 */
const PATTERNS = {
  // Claude Code patterns (uses Ink with rounded box-drawing characters)
  claude: {
    // Block boundaries
    boxStart: /^╭─/,
    boxEnd: /^╰─/,
    boxBody: /^│\s/,

    // CLI identity
    processName: "claude",
    brandLogo: /Claude\s+Code/,
    versionOutput: /Claude Code CLI version/,

    // Thinking detection (spinner + cursor control, no visible text)
    cursorControl: /\x1b\[(\?25l|A|K)/,
  },

  // Codex CLI patterns (Rust TUI with structured text markers)
  codex: {
    // Block boundaries
    sessionStart: /codex session\s+[0-9a-f-]+/,
    modelDeclaration: /^model:\s+\S+/,
    thinkingMarker: /^thinking$/,
    planUpdate: /^Plan update$/,
    execStart: /^[a-z_]+\(/,  // Function call like apply_patch(
    execEnd: /exited \d+( in .+)?:/,
    diffMarker: /^file update:/,

    // CLI identity
    processName: "codex",
    versionOutput: /Codex CLI/,

    // Status indicators
    planStepDone: /^✓/,
    planStepActive: /^→/,
    planStepPending: /^•/,
  },

  // Gemini CLI patterns (Ink with tool call boxes)
  gemini: {
    // Block boundaries (tool call boxes)
    toolBoxStart: /^╭─+╮$/,
    toolBoxEnd: /^╰─+╯$/,
    toolBoxBody: /^│\s/,
    toolHeader: /^│\s+(✓|x|⊶)\s+\S+/,
    separator: /^│─+│$/,

    // CLI identity
    processName: "gemini",
    brandLogo: /▝▜▄\s+Gemini CLI/,
    versionOutput: /Gemini CLI v[\d.]+/,

    // Status detection (Braille spinner)
    spinner: /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/,
    toolStatusSuccess: /^│\s+✓/,
    toolStatusError: /^│\s+x/,
    toolStatusRunning: /^│\s+⊶/,
  },

  // GitHub Copilot CLI patterns (gh extension with simple text format)
  copilot: {
    // Block boundaries
    suggestMarker: /^▸\s+(Suggestion)?/,
    explainMarker: /^▸\s+Explanation/,
    separator: /^-{20,}$/,
    actionBar: /^\[(Accept|Next|Explain|Quit|Done)\]/,

    // CLI identity
    processName: "gh",
    processArgs: "copilot",
    brandOutput: /GitHub Copilot/,
  },

  // Generic AI output patterns (fallback)
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
  private activeCLI: CLIType | null = null;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Set the active CLI type (most reliable detection via process name)
   */
  setActiveCLI(cliType: CLIType): void {
    this.activeCLI = cliType;
  }

  /**
   * Get the currently active CLI type
   */
  getActiveCLI(): CLIType | null {
    return this.activeCLI;
  }

  /**
   * Process a new line of terminal output
   * @param line - Raw line content (with ANSI)
   * @param lineNumber - Terminal buffer line number
   */
  processLine(line: string, lineNumber: number): void {
    const cleanLine = this.stripAnsi(line);

    // Priority 1: Process name detection (already set via setActiveCLI)
    // Priority 2: Brand logo detection
    this.detectCLIIdentity(cleanLine);

    // Priority 3: Block boundary detection based on active CLI
    if (this.activeCLI === "claude") {
      this.processClaudeLine(cleanLine, lineNumber);
    } else if (this.activeCLI === "codex") {
      this.processCodexLine(cleanLine, lineNumber);
    } else if (this.activeCLI === "gemini") {
      this.processGeminiLine(cleanLine, lineNumber);
    } else if (this.activeCLI === "copilot") {
      this.processCopilotLine(cleanLine, lineNumber);
    } else {
      // Fallback: generic detection
      this.processGenericLine(cleanLine, lineNumber);
    }

    // Update current block end line if streaming
    if (this.currentBlock && this.currentBlock.isStreaming) {
      this.currentBlock.endLine = lineNumber;
      this.blocks.set(this.currentBlock.id, { ...this.currentBlock });
    }

    this.lineBuffer.push(line);
  }

  /**
   * Detect CLI identity from brand logos and version outputs
   */
  private detectCLIIdentity(line: string): void {
    if (this.activeCLI) return; // Already detected

    if (PATTERNS.claude.brandLogo.test(line) || PATTERNS.claude.versionOutput.test(line)) {
      this.activeCLI = "claude";
    } else if (PATTERNS.codex.sessionStart.test(line) || PATTERNS.codex.versionOutput.test(line)) {
      this.activeCLI = "codex";
    } else if (PATTERNS.gemini.brandLogo.test(line) || PATTERNS.gemini.versionOutput.test(line)) {
      this.activeCLI = "gemini";
    } else if (PATTERNS.copilot.brandOutput.test(line)) {
      this.activeCLI = "copilot";
    }
  }

  /**
   * Process Claude Code output
   */
  private processClaudeLine(line: string, lineNumber: number): void {
    // Block start: ╭─
    if (PATTERNS.claude.boxStart.test(line)) {
      this.startBlock("claude", lineNumber, "message");
      return;
    }

    // Block end: ╰─
    if (PATTERNS.claude.boxEnd.test(line) && this.currentBlock?.cliType === "claude") {
      this.endBlock(lineNumber);
      return;
    }
  }

  /**
   * Process Codex CLI output
   */
  private processCodexLine(line: string, lineNumber: number): void {
    // Session start
    if (PATTERNS.codex.sessionStart.test(line)) {
      this.startBlock("codex", lineNumber, "message");
      return;
    }

    // Thinking block
    if (PATTERNS.codex.thinkingMarker.test(line)) {
      this.startBlock("codex", lineNumber, "thinking");
      return;
    }

    // Plan update
    if (PATTERNS.codex.planUpdate.test(line)) {
      this.startBlock("codex", lineNumber, "plan");
      return;
    }

    // Diff output
    if (PATTERNS.codex.diffMarker.test(line)) {
      this.startBlock("codex", lineNumber, "diff");
      return;
    }

    // Command execution end
    if (PATTERNS.codex.execEnd.test(line) && this.currentBlock?.cliType === "codex") {
      this.endBlock(lineNumber);
      return;
    }

    // Auto-end thinking/plan blocks on next major marker
    if (this.currentBlock?.cliType === "codex" &&
        (this.currentBlock.blockKind === "thinking" || this.currentBlock.blockKind === "plan")) {
      if (PATTERNS.codex.execStart.test(line) || PATTERNS.codex.diffMarker.test(line)) {
        this.endBlock(lineNumber - 1);
      }
    }
  }

  /**
   * Process Gemini CLI output
   */
  private processGeminiLine(line: string, lineNumber: number): void {
    // Tool box start: ╭─╮
    if (PATTERNS.gemini.toolBoxStart.test(line)) {
      this.startBlock("gemini", lineNumber, "tool_call");
      return;
    }

    // Tool box end: ╰─╯
    if (PATTERNS.gemini.toolBoxEnd.test(line) && this.currentBlock?.cliType === "gemini") {
      this.endBlock(lineNumber);
      return;
    }
  }

  /**
   * Process GitHub Copilot CLI output
   */
  private processCopilotLine(line: string, lineNumber: number): void {
    // Suggestion/Explanation start: ▸
    if (PATTERNS.copilot.suggestMarker.test(line) || PATTERNS.copilot.explainMarker.test(line)) {
      this.startBlock("copilot", lineNumber, "message");
      return;
    }

    // Action bar marks end of block
    if (PATTERNS.copilot.actionBar.test(line) && this.currentBlock?.cliType === "copilot") {
      this.endBlock(lineNumber);
      return;
    }

    // Next ▸ marker also ends previous block
    if (PATTERNS.copilot.suggestMarker.test(line) && this.currentBlock?.cliType === "copilot") {
      this.endBlock(lineNumber - 1);
    }
  }

  /**
   * Process generic AI output (fallback)
   */
  private processGenericLine(line: string, lineNumber: number): void {
    // Track code fences
    if (PATTERNS.generic.codeFence.test(line)) {
      this.inCodeFence = !this.inCodeFence;
      if (this.inCodeFence && !this.currentBlock) {
        this.startBlock("generic", lineNumber, "generic");
      } else if (!this.inCodeFence && this.currentBlock?.cliType === "generic") {
        this.endBlock(lineNumber);
      }
    }

    // Detect long unbroken text blocks
    if (this.isNonPromptLine(line)) {
      this.consecutiveNonPromptLines++;
      if (this.consecutiveNonPromptLines > 20 && !this.currentBlock) {
        this.startBlock("generic", lineNumber - 20, "generic");
      }
    } else {
      // Reset counter on shell prompt
      if (this.isShellPrompt(line)) {
        this.consecutiveNonPromptLines = 0;
        if (this.currentBlock?.cliType === "generic") {
          this.endBlock(lineNumber - 1);
        }
      }
    }
  }

  /**
   * Start tracking a new AI block
   */
  private startBlock(cliType: CLIType, startLine: number, blockKind: BlockKind): void {
    // End previous block if exists
    if (this.currentBlock) {
      this.endBlock(startLine - 1);
    }

    const block: AIBlock = {
      id: `${this.sessionId}-block-${Date.now()}`,
      cliType,
      startLine,
      endLine: -1,
      isCollapsed: false,
      isStreaming: true,
      blockKind,
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
   * Get the currently streaming block (if any)
   */
  getStreamingBlock(): AIBlock | null {
    return this.currentBlock;
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
      // Use queueMicrotask to defer state update until after render
      queueMicrotask(() => {
        const currentTrackers = get().trackers;
        if (!currentTrackers.has(sessionId)) {
          currentTrackers.set(sessionId, tracker!);
          set({ trackers: new Map(currentTrackers) });
        }
      });
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
  const getTracker = useAIBlockStore((state) => state.getTracker);
  // Use useMemo to cache the tracker and avoid infinite loops
  return useMemo(() => getTracker(sessionId), [sessionId, getTracker]);
}
