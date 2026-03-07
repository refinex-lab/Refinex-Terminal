import { invoke } from "@tauri-apps/api/core";
import type { Terminal } from "@xterm/xterm";

export interface FontConfig {
  family: string;
  size: number;
  lineHeight: number;
  ligatures: boolean;
}

const DEFAULT_FONTS = [
  "JetBrains Mono",
  "Fira Code",
  "Cascadia Code",
  "monospace",
];

let cachedFonts: string[] | null = null;

/**
 * Queries available system fonts via Tauri command
 */
export async function listSystemFonts(): Promise<string[]> {
  if (cachedFonts) {
    return cachedFonts;
  }

  try {
    cachedFonts = await invoke<string[]>("list_fonts");
    return cachedFonts;
  } catch (error) {
    console.error("Failed to list system fonts:", error);
    return DEFAULT_FONTS;
  }
}

/**
 * Validates that a font exists in the system
 */
export async function validateFont(family: string): Promise<string> {
  const fonts = await listSystemFonts();

  // Check if requested font exists
  if (fonts.includes(family)) {
    return family;
  }

  // Fallback to default fonts
  for (const fallback of DEFAULT_FONTS) {
    if (fonts.includes(fallback)) {
      return fallback;
    }
  }

  // Ultimate fallback
  const lastFont = DEFAULT_FONTS[DEFAULT_FONTS.length - 1];
  if (!lastFont) {
    return "monospace";
  }
  return lastFont;
}

/**
 * Applies font configuration to terminal and UI
 */
export function applyFont(
  config: FontConfig,
  terminal?: Terminal
): void {
  const { family, size, lineHeight, ligatures } = config;
  const root = document.documentElement;

  // Build font family string with fallbacks
  // Ensure each font name is properly quoted
  const quotedFonts = DEFAULT_FONTS.map(f => f === "monospace" ? f : `"${f}"`);
  const fontFamily = `"${family}", ${quotedFonts.join(", ")}`;

  // Apply to CSS custom properties
  root.style.setProperty("--font-family", fontFamily);
  root.style.setProperty("--font-size", `${size}px`);
  root.style.setProperty("--line-height", lineHeight.toString());
  root.style.setProperty(
    "--font-feature-settings",
    ligatures ? '"liga" 1, "calt" 1' : '"liga" 0, "calt" 0'
  );

  // Apply to xterm.js terminal if provided
  if (terminal) {
    terminal.options.fontFamily = fontFamily;
    terminal.options.fontSize = size;
    terminal.options.lineHeight = lineHeight;
    terminal.options.letterSpacing = 0;
    terminal.options.fontWeight = "normal";
    terminal.options.fontWeightBold = "bold";
  }
}

/**
 * Handles dynamic font size changes (zoom in/out/reset)
 */
export function createFontZoomHandler(
  getCurrentSize: () => number,
  onSizeChange: (newSize: number) => void
): (event: KeyboardEvent) => void {
  const MIN_SIZE = 8;
  const MAX_SIZE = 32;
  const DEFAULT_SIZE = 14;
  const STEP = 1;

  return (event: KeyboardEvent) => {
    // Safety check for event object
    if (!event) return;

    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const modKey = isMac ? event.metaKey : event.ctrlKey;

    if (!modKey) return;

    let handled = false;
    let newSize = getCurrentSize();

    // Zoom in: Cmd/Ctrl + Plus or Cmd/Ctrl + =
    if (event.key === "+" || event.key === "=") {
      newSize = Math.min(MAX_SIZE, newSize + STEP);
      handled = true;
    }
    // Zoom out: Cmd/Ctrl + Minus
    else if (event.key === "-" || event.key === "_") {
      newSize = Math.max(MIN_SIZE, newSize - STEP);
      handled = true;
    }
    // Reset: Cmd/Ctrl + 0
    else if (event.key === "0") {
      newSize = DEFAULT_SIZE;
      handled = true;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
      onSizeChange(newSize);
    }
  };
}

/**
 * Gets the default font configuration
 */
export function getDefaultFontConfig(): FontConfig {
  const defaultFamily = DEFAULT_FONTS[0];
  if (!defaultFamily) {
    throw new Error("No default fonts available");
  }
  return {
    family: defaultFamily,
    size: 14,
    lineHeight: 1.0,
    ligatures: true,
  };
}
