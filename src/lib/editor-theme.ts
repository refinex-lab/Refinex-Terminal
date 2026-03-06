import { EditorView } from "@codemirror/view";

/**
 * Creates a CodeMirror theme that integrates with Refinex Terminal's CSS variables.
 * This ensures the editor matches the app's theme system (dark/light mode).
 */
export function createRefinexTheme() {
  return EditorView.theme({
    "&": {
      backgroundColor: "var(--ui-background)",
      color: "var(--ui-foreground)",
      height: "100%",
    },
    ".cm-content": {
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", "SF Mono", Consolas, monospace',
      fontSize: "13px",
      lineHeight: "1.6",
      caretColor: "var(--ui-foreground)",
      padding: "8px 0",
      backgroundColor: "var(--ui-background)",
    },
    ".cm-line": {
      padding: "0 8px",
      backgroundColor: "transparent",
    },
    ".cm-gutters": {
      backgroundColor: "var(--ui-background) !important",
      color: "var(--ui-muted-foreground)",
      border: "none",
      paddingRight: "8px",
    },
    ".cm-gutter": {
      backgroundColor: "var(--ui-background) !important",
    },
    ".cm-lineNumbers": {
      backgroundColor: "var(--ui-background) !important",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      backgroundColor: "var(--ui-background) !important",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent !important",
      color: "var(--ui-foreground)",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(255, 255, 255, 0.05)",
    },
    ".cm-selectionBackground": {
      backgroundColor: "#3b82f6 !important",
      opacity: "0.5 !important",
    },
    "&.cm-focused .cm-selectionBackground": {
      backgroundColor: "#3b82f6 !important",
      opacity: "0.6 !important",
    },
    "&.cm-focused .cm-selectionMatch": {
      backgroundColor: "rgba(59, 130, 246, 0.2) !important",
    },
    ".cm-content ::selection": {
      backgroundColor: "#3b82f6 !important",
    },
    ".cm-line ::selection": {
      backgroundColor: "#3b82f6 !important",
    },
    "& ::selection": {
      backgroundColor: "#3b82f6 !important",
    },
    ".cm-cursor": {
      borderLeftColor: "var(--ui-foreground)",
    },
    ".cm-searchMatch": {
      backgroundColor: "#ffc107 !important",
      color: "#000 !important",
      borderRadius: "2px",
      padding: "0 1px",
    },
    ".cm-searchMatch-selected": {
      backgroundColor: "#ff9800 !important",
      color: "#000 !important",
      borderRadius: "2px",
      padding: "0 1px",
      outline: "2px solid #ff5722",
    },
    ".cm-tooltip": {
      backgroundColor: "var(--ui-popover)",
      color: "var(--ui-popover-foreground)",
      border: "1px solid var(--ui-border)",
      borderRadius: "4px",
    },
    ".cm-tooltip-autocomplete": {
      "& > ul > li[aria-selected]": {
        backgroundColor: "var(--ui-accent)",
        color: "var(--ui-accent-foreground)",
      },
    },
    ".cm-scroller": {
      backgroundColor: "var(--ui-background)",
    },
    // Minimap styles
    ".cm-minimap": {
      backgroundColor: "var(--ui-background)",
      borderLeft: "1px solid var(--ui-border)",
      width: "120px",
      opacity: 1,
      cursor: "pointer !important",
    },
    ".cm-minimap *": {
      cursor: "pointer !important",
    },
    ".cm-minimap-gutter": {
      backgroundColor: "var(--ui-background) !important",
    },
    ".cm-minimap-inner": {
      backgroundColor: "var(--ui-background) !important",
    },
    ".cm-minimap-content": {
      backgroundColor: "var(--ui-background)",
      cursor: "pointer !important",
    },
    ".cm-minimap-overlay": {
      backgroundColor: "rgba(255, 255, 255, 0.15)",
      border: "1px solid rgba(255, 255, 255, 0.3)",
      borderRadius: "2px",
      cursor: "pointer !important",
    },
    ".cm-minimap .cm-gutters": {
      display: "none",
      backgroundColor: "var(--ui-background) !important",
    },
    ".cm-minimap .cm-line": {
      cursor: "pointer !important",
    },
  }, { dark: true });
}

