import { create } from "zustand";

/**
 * Appearance configuration
 */
export interface AppearanceConfig {
  theme: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  ligatures: boolean;
  opacity: number;
  vibrancy: boolean;
  cursorStyle: "block" | "underline" | "bar";
}

/**
 * Terminal configuration
 */
export interface TerminalConfig {
  shell: string;
  scrollbackLines: number;
  copyOnSelect: boolean;
  bellMode: "none" | "sound" | "visual";
  env: Record<string, string>;
}

/**
 * AI configuration
 */
export interface AIConfig {
  detectCLI: boolean;
  blockMode: boolean;
  streamingThrottle: number;
  maxBlockLines: number;
}

/**
 * Git configuration
 */
export interface GitConfig {
  enabled: boolean;
  autoFetchInterval: number;
  showDiff: boolean;
}

/**
 * Keybindings configuration
 */
export interface KeybindingsConfig {
  newTab: string;
  closeTab: string;
  nextTab: string;
  prevTab: string;
  toggleSidebar: string;
  commandPalette: string;
  settings: string;
  search: string;
  splitHorizontal: string;
  splitVertical: string;
}

/**
 * Application configuration type
 */
export interface AppConfig {
  appearance: AppearanceConfig;
  terminal: TerminalConfig;
  ai: AIConfig;
  git: GitConfig;
  keybindings: KeybindingsConfig;
}

/**
 * Config store state
 */
interface ConfigStore {
  config: AppConfig;
  updateConfig: (updates: Partial<AppConfig>) => void;
  resetConfig: () => void;
}

/**
 * Default configuration
 */
const defaultConfig: AppConfig = {
  appearance: {
    theme: "refinex-dark",
    fontFamily: "JetBrains Mono",
    fontSize: 14,
    lineHeight: 1.5,
    ligatures: true,
    opacity: 1.0,
    vibrancy: false,
    cursorStyle: "block",
  },
  terminal: {
    shell: "",
    scrollbackLines: 10000,
    copyOnSelect: true,
    bellMode: "none",
    env: {},
  },
  ai: {
    detectCLI: true,
    blockMode: true,
    streamingThrottle: 16,
    maxBlockLines: 50000,
  },
  git: {
    enabled: true,
    autoFetchInterval: 300,
    showDiff: true,
  },
  keybindings: {
    newTab: "Cmd+T",
    closeTab: "Cmd+W",
    nextTab: "Cmd+Shift+]",
    prevTab: "Cmd+Shift+[",
    toggleSidebar: "Cmd+B",
    commandPalette: "Cmd+Shift+P",
    settings: "Cmd+,",
    search: "Cmd+F",
    splitHorizontal: "Cmd+D",
    splitVertical: "Cmd+Shift+D",
  },
};

/**
 * Config store - manages user configuration loaded from TOML
 */
export const useConfigStore = create<ConfigStore>((set) => ({
  config: defaultConfig,

  updateConfig: (updates) =>
    set((state) => ({
      config: {
        ...state.config,
        ...updates,
        appearance: {
          ...state.config.appearance,
          ...(updates.appearance ?? {}),
        },
        terminal: {
          ...state.config.terminal,
          ...(updates.terminal ?? {}),
        },
        ai: {
          ...state.config.ai,
          ...(updates.ai ?? {}),
        },
        git: {
          ...state.config.git,
          ...(updates.git ?? {}),
        },
        keybindings: {
          ...state.config.keybindings,
          ...(updates.keybindings ?? {}),
        },
      },
    })),

  resetConfig: () =>
    set({
      config: defaultConfig,
    }),
}));
