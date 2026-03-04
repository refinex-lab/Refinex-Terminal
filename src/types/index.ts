/**
 * Central type export file for Refinex Terminal
 *
 * This file serves as the single source of truth for all TypeScript types
 * used throughout the application. Import types from here rather than
 * defining them inline in components.
 */

// Re-export store types
export type {
  TerminalSession,
} from "@/stores/terminal-store";

export type {
  Project,
} from "@/stores/sidebar-store";

export type {
  GitStatus,
  FileChange,
} from "@/stores/git-store";

export type {
  AppConfig,
  AppearanceConfig,
  TerminalConfig,
  AIConfig,
  GitConfig,
  KeybindingsConfig,
} from "@/stores/config-store";
