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
      backgroundColor: "var(--ui-background)",
      color: "var(--ui-muted-foreground)",
      border: "none",
      paddingRight: "8px",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "var(--ui-accent)",
      color: "var(--ui-accent-foreground)",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(255, 255, 255, 0.05)",
    },
    ".cm-selectionBackground, ::selection": {
      backgroundColor: "var(--ui-accent) !important",
      color: "var(--ui-accent-foreground) !important",
    },
    "&.cm-focused .cm-selectionBackground, &.cm-focused ::selection": {
      backgroundColor: "var(--ui-accent) !important",
    },
    ".cm-cursor": {
      borderLeftColor: "var(--ui-foreground)",
    },
    ".cm-searchMatch": {
      backgroundColor: "rgba(255, 200, 0, 0.3)",
      outline: "1px solid rgba(255, 200, 0, 0.5)",
    },
    ".cm-searchMatch-selected": {
      backgroundColor: "rgba(255, 150, 0, 0.5)",
      outline: "1px solid rgba(255, 150, 0, 0.8)",
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
  }, { dark: true });
}

