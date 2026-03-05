import { invoke } from "@tauri-apps/api/core";
import type { ITheme } from "@xterm/xterm";

export interface Theme {
  name: string;
  // Terminal colors
  terminal: {
    background: string;
    foreground: string;
    cursor: string;
    cursorAccent: string;
    selection: string;
    selectionInactive: string;
    // ANSI colors (0-15)
    black: string;
    red: string;
    green: string;
    yellow: string;
    blue: string;
    magenta: string;
    cyan: string;
    white: string;
    brightBlack: string;
    brightRed: string;
    brightGreen: string;
    brightYellow: string;
    brightBlue: string;
    brightMagenta: string;
    brightCyan: string;
    brightWhite: string;
  };
  // UI colors
  ui: {
    background: string;
    foreground: string;
    border: string;
    borderActive: string;
    tabBackground: string;
    tabBackgroundActive: string;
    tabForeground: string;
    tabForegroundActive: string;
    sidebarBackground: string;
    sidebarForeground: string;
    buttonBackground: string;
    buttonForeground: string;
    inputBackground: string;
    inputForeground: string;
    inputBorder: string;
  };
}

/**
 * Converts a Theme object to xterm.js ITheme format
 */
export function themeToXtermTheme(theme: Theme): ITheme {
  return {
    background: theme.terminal.background,
    foreground: theme.terminal.foreground,
    cursor: theme.terminal.cursor,
    cursorAccent: theme.terminal.cursorAccent,
    selectionBackground: theme.terminal.selection,
    selectionInactiveBackground: theme.terminal.selectionInactive,
    black: theme.terminal.black,
    red: theme.terminal.red,
    green: theme.terminal.green,
    yellow: theme.terminal.yellow,
    blue: theme.terminal.blue,
    magenta: theme.terminal.magenta,
    cyan: theme.terminal.cyan,
    white: theme.terminal.white,
    brightBlack: theme.terminal.brightBlack,
    brightRed: theme.terminal.brightRed,
    brightGreen: theme.terminal.brightGreen,
    brightYellow: theme.terminal.brightYellow,
    brightBlue: theme.terminal.brightBlue,
    brightMagenta: theme.terminal.brightMagenta,
    brightCyan: theme.terminal.brightCyan,
    brightWhite: theme.terminal.brightWhite,
  };
}

/**
 * Applies a theme by setting CSS custom properties on :root
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;

  // Terminal colors
  root.style.setProperty("--terminal-background", theme.terminal.background);
  root.style.setProperty("--terminal-foreground", theme.terminal.foreground);
  root.style.setProperty("--terminal-cursor", theme.terminal.cursor);
  root.style.setProperty("--terminal-selection", theme.terminal.selection);

  // ANSI colors
  root.style.setProperty("--terminal-black", theme.terminal.black);
  root.style.setProperty("--terminal-red", theme.terminal.red);
  root.style.setProperty("--terminal-green", theme.terminal.green);
  root.style.setProperty("--terminal-yellow", theme.terminal.yellow);
  root.style.setProperty("--terminal-blue", theme.terminal.blue);
  root.style.setProperty("--terminal-magenta", theme.terminal.magenta);
  root.style.setProperty("--terminal-cyan", theme.terminal.cyan);
  root.style.setProperty("--terminal-white", theme.terminal.white);
  root.style.setProperty("--terminal-bright-black", theme.terminal.brightBlack);
  root.style.setProperty("--terminal-bright-red", theme.terminal.brightRed);
  root.style.setProperty("--terminal-bright-green", theme.terminal.brightGreen);
  root.style.setProperty("--terminal-bright-yellow", theme.terminal.brightYellow);
  root.style.setProperty("--terminal-bright-blue", theme.terminal.brightBlue);
  root.style.setProperty("--terminal-bright-magenta", theme.terminal.brightMagenta);
  root.style.setProperty("--terminal-bright-cyan", theme.terminal.brightCyan);
  root.style.setProperty("--terminal-bright-white", theme.terminal.brightWhite);

  // UI colors
  root.style.setProperty("--ui-background", theme.ui.background);
  root.style.setProperty("--ui-foreground", theme.ui.foreground);
  root.style.setProperty("--ui-border", theme.ui.border);
  root.style.setProperty("--ui-border-active", theme.ui.borderActive);
  root.style.setProperty("--ui-tab-background", theme.ui.tabBackground);
  root.style.setProperty("--ui-tab-background-active", theme.ui.tabBackgroundActive);
  root.style.setProperty("--ui-tab-foreground", theme.ui.tabForeground);
  root.style.setProperty("--ui-tab-foreground-active", theme.ui.tabForegroundActive);
  root.style.setProperty("--ui-sidebar-background", theme.ui.sidebarBackground);
  root.style.setProperty("--ui-sidebar-foreground", theme.ui.sidebarForeground);
  root.style.setProperty("--ui-button-background", theme.ui.buttonBackground);
  root.style.setProperty("--ui-button-foreground", theme.ui.buttonForeground);
  root.style.setProperty("--ui-input-background", theme.ui.inputBackground);
  root.style.setProperty("--ui-input-foreground", theme.ui.inputForeground);
  root.style.setProperty("--ui-input-border", theme.ui.inputBorder);
}

/**
 * Loads a built-in theme from the themes/ directory
 */
export async function loadBuiltinTheme(name: string): Promise<Theme> {
  const themeModule = await import(`../../themes/${name}.toml?raw`);
  const tomlContent = themeModule.default;
  return parseThemeToml(tomlContent);
}

/**
 * Loads a custom theme from a file path via Tauri command
 */
export async function loadCustomTheme(path: string): Promise<Theme> {
  const tomlContent = await invoke<string>("read_theme_file", { path });
  return parseThemeToml(tomlContent);
}

/**
 * Parses TOML content into a Theme object
 */
function parseThemeToml(tomlContent: string): Theme {
  // Simple TOML parser for our theme format
  const lines = tomlContent.split("\n");
  const theme: Partial<Theme> = {
    name: "",
    terminal: {} as Theme["terminal"],
    ui: {} as Theme["ui"],
  };

  let currentSection: "terminal" | "ui" | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (trimmed === "[terminal]") {
      currentSection = "terminal";
      continue;
    }
    if (trimmed === "[ui]") {
      currentSection = "ui";
      continue;
    }

    const match = trimmed.match(/^(\w+)\s*=\s*"([^"]+)"$/);
    if (match && match[1] && match[2]) {
      const key = match[1];
      const value = match[2];
      if (key === "name" && !currentSection) {
        theme.name = value;
      } else if (currentSection) {
        (theme[currentSection] as Record<string, string>)[key] = value;
      }
    }
  }

  return theme as Theme;
}

/**
 * List of built-in theme names
 */
export const BUILTIN_THEMES = [
  "refinex-dark",
  "refinex-light",
  "tokyo-night",
  "catppuccin-mocha",
  "github-dark",
] as const;

export type BuiltinThemeName = (typeof BUILTIN_THEMES)[number];
