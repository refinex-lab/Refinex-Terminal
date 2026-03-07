/**
 * WCAG AA Contrast Ratio Checker
 * Ensures all themes meet WCAG AA standards (4.5:1 for normal text, 3:1 for large text)
 */

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1]!, 16),
        g: parseInt(result[2]!, 16),
        b: parseInt(result[3]!, 16),
      }
    : null;
}

/**
 * Calculate relative luminance
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * (rs ?? 0) + 0.7152 * (gs ?? 0) + 0.0722 * (bs ?? 0);
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) return 0;

  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast ratio meets WCAG AA standards
 */
export function meetsWCAGAA(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): boolean {
  const ratio = getContrastRatio(foreground, background);
  const requiredRatio = isLargeText ? 3 : 4.5;
  return ratio >= requiredRatio;
}

/**
 * Check if contrast ratio meets WCAG AAA standards
 */
export function meetsWCAGAAA(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): boolean {
  const ratio = getContrastRatio(foreground, background);
  const requiredRatio = isLargeText ? 4.5 : 7;
  return ratio >= requiredRatio;
}

/**
 * Audit theme colors for WCAG compliance
 */
export interface ContrastAuditResult {
  pair: string;
  foreground: string;
  background: string;
  ratio: number;
  meetsAA: boolean;
  meetsAAA: boolean;
  isLargeText: boolean;
}

export function auditThemeContrast(theme: {
  ui: {
    background: string;
    foreground: string;
    border: string;
    tabForeground: string;
    tabForegroundActive: string;
    sidebarForeground: string;
    buttonForeground: string;
    inputForeground: string;
  };
  terminal: {
    background: string;
    foreground: string;
  };
}): ContrastAuditResult[] {
  const results: ContrastAuditResult[] = [];

  // UI text on background
  results.push({
    pair: "UI foreground on background",
    foreground: theme.ui.foreground,
    background: theme.ui.background,
    ratio: getContrastRatio(theme.ui.foreground, theme.ui.background),
    meetsAA: meetsWCAGAA(theme.ui.foreground, theme.ui.background),
    meetsAAA: meetsWCAGAAA(theme.ui.foreground, theme.ui.background),
    isLargeText: false,
  });

  // Terminal text on background
  results.push({
    pair: "Terminal foreground on background",
    foreground: theme.terminal.foreground,
    background: theme.terminal.background,
    ratio: getContrastRatio(theme.terminal.foreground, theme.terminal.background),
    meetsAA: meetsWCAGAA(theme.terminal.foreground, theme.terminal.background),
    meetsAAA: meetsWCAGAAA(theme.terminal.foreground, theme.terminal.background),
    isLargeText: false,
  });

  // Tab text
  results.push({
    pair: "Tab foreground on background",
    foreground: theme.ui.tabForeground,
    background: theme.ui.background,
    ratio: getContrastRatio(theme.ui.tabForeground, theme.ui.background),
    meetsAA: meetsWCAGAA(theme.ui.tabForeground, theme.ui.background),
    meetsAAA: meetsWCAGAAA(theme.ui.tabForeground, theme.ui.background),
    isLargeText: false,
  });

  // Active tab text
  results.push({
    pair: "Active tab foreground on background",
    foreground: theme.ui.tabForegroundActive,
    background: theme.ui.background,
    ratio: getContrastRatio(theme.ui.tabForegroundActive, theme.ui.background),
    meetsAA: meetsWCAGAA(theme.ui.tabForegroundActive, theme.ui.background),
    meetsAAA: meetsWCAGAAA(theme.ui.tabForegroundActive, theme.ui.background),
    isLargeText: false,
  });

  // Sidebar text
  results.push({
    pair: "Sidebar foreground on background",
    foreground: theme.ui.sidebarForeground,
    background: theme.ui.background,
    ratio: getContrastRatio(theme.ui.sidebarForeground, theme.ui.background),
    meetsAA: meetsWCAGAA(theme.ui.sidebarForeground, theme.ui.background),
    meetsAAA: meetsWCAGAAA(theme.ui.sidebarForeground, theme.ui.background),
    isLargeText: false,
  });

  // Button text
  results.push({
    pair: "Button foreground on background",
    foreground: theme.ui.buttonForeground,
    background: theme.ui.background,
    ratio: getContrastRatio(theme.ui.buttonForeground, theme.ui.background),
    meetsAA: meetsWCAGAA(theme.ui.buttonForeground, theme.ui.background),
    meetsAAA: meetsWCAGAAA(theme.ui.buttonForeground, theme.ui.background),
    isLargeText: false,
  });

  // Input text
  results.push({
    pair: "Input foreground on background",
    foreground: theme.ui.inputForeground,
    background: theme.ui.background,
    ratio: getContrastRatio(theme.ui.inputForeground, theme.ui.background),
    meetsAA: meetsWCAGAA(theme.ui.inputForeground, theme.ui.background),
    meetsAAA: meetsWCAGAAA(theme.ui.inputForeground, theme.ui.background),
    isLargeText: false,
  });

  return results;
}

/**
 * Log contrast audit results to console
 */
export function logContrastAudit(results: ContrastAuditResult[]) {
  console.group("🎨 WCAG Contrast Audit");

  results.forEach((result) => {
    const status = result.meetsAA ? "✅" : "❌";
    const aaaStatus = result.meetsAAA ? "AAA" : "";

    console.log(
      `${status} ${result.pair}: ${result.ratio.toFixed(2)}:1 ${aaaStatus}`,
      {
        foreground: result.foreground,
        background: result.background,
        meetsAA: result.meetsAA,
        meetsAAA: result.meetsAAA,
      }
    );
  });

  const allPass = results.every((r) => r.meetsAA);
  console.log(`\n${allPass ? "✅ All checks passed!" : "❌ Some checks failed"}`);
  console.groupEnd();
}
