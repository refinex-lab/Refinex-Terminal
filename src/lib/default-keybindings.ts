/**
 * Default keybindings for Refinex Terminal
 *
 * Format: "Modifier+Key" where:
 * - Modifier: Cmd (macOS) / Ctrl (Windows/Linux), Shift, Alt, Ctrl
 * - Key: Single character or special key name
 *
 * The system automatically handles Cmd/Ctrl normalization based on platform.
 */

export interface KeybindingMap {
  [combo: string]: string;
}

/**
 * Global keybindings - work everywhere in the app
 */
export const globalKeybindings: KeybindingMap = {
  // Command Palette
  "Cmd+Shift+P": "command_palette.open",
  "Cmd+P": "command_palette.open_files",

  // Terminal Management
  "Cmd+T": "terminal.new_tab",
  "Cmd+W": "terminal.close_tab",
  "Cmd+Shift+W": "terminal.close_all_tabs",
  "Cmd+1": "terminal.switch_tab_1",
  "Cmd+2": "terminal.switch_tab_2",
  "Cmd+3": "terminal.switch_tab_3",
  "Cmd+4": "terminal.switch_tab_4",
  "Cmd+5": "terminal.switch_tab_5",
  "Cmd+6": "terminal.switch_tab_6",
  "Cmd+7": "terminal.switch_tab_7",
  "Cmd+8": "terminal.switch_tab_8",
  "Cmd+9": "terminal.switch_tab_9",
  "Cmd+Shift+[": "terminal.previous_tab",
  "Cmd+Shift+]": "terminal.next_tab",

  // Split Panes
  "Cmd+D": "terminal.split_horizontal",
  "Cmd+Shift+D": "terminal.split_vertical",
  "Cmd+Shift+X": "terminal.close_pane",
  "Cmd+Alt+ArrowLeft": "terminal.focus_pane_left",
  "Cmd+Alt+ArrowRight": "terminal.focus_pane_right",
  "Cmd+Alt+ArrowUp": "terminal.focus_pane_up",
  "Cmd+Alt+ArrowDown": "terminal.focus_pane_down",

  // Sidebar
  "Cmd+B": "sidebar.toggle",
  "Cmd+Shift+E": "sidebar.focus_explorer",
  "Cmd+Shift+F": "sidebar.focus_search",

  // File Editor
  "Cmd+S": "editor.save",
  "Cmd+Shift+S": "editor.save_all",
  "Cmd+F": "editor.find",
  "Cmd+H": "editor.replace",
  "Cmd+G": "editor.find_next",
  "Cmd+Shift+G": "editor.find_previous",

  // Settings
  "Cmd+,": "settings.open",

  // Zoom
  "Cmd+=": "terminal.zoom_in",
  "Cmd+-": "terminal.zoom_out",
  "Cmd+0": "terminal.zoom_reset",

  // Application
  "Cmd+Q": "app.quit",
  "Cmd+R": "app.reload",
  "Cmd+Shift+R": "app.hard_reload",
};

/**
 * Terminal-focused keybindings - only work when terminal has focus
 * These are more permissive to allow terminal applications to handle keys
 */
export const terminalKeybindings: KeybindingMap = {
  // Copy/Paste (terminal-specific behavior)
  "Cmd+C": "terminal.copy",
  "Cmd+V": "terminal.paste",

  // Clear
  "Cmd+K": "terminal.clear",

  // Search in terminal
  "Cmd+F": "terminal.search",
};

/**
 * Editor-focused keybindings - only work when code editor has focus
 */
export const editorKeybindings: KeybindingMap = {
  // Standard editor shortcuts
  "Cmd+Z": "editor.undo",
  "Cmd+Shift+Z": "editor.redo",
  "Cmd+X": "editor.cut",
  "Cmd+C": "editor.copy",
  "Cmd+V": "editor.paste",
  "Cmd+A": "editor.select_all",

  // Line operations
  "Cmd+L": "editor.select_line",
  "Cmd+Shift+K": "editor.delete_line",
  "Alt+ArrowUp": "editor.move_line_up",
  "Alt+ArrowDown": "editor.move_line_down",
  "Cmd+Shift+D": "editor.duplicate_line",

  // Multi-cursor
  "Cmd+D": "editor.add_cursor_to_next_match",
  "Cmd+Shift+L": "editor.add_cursors_to_all_matches",
  "Alt+Click": "editor.add_cursor",

  // Code folding
  "Cmd+Alt+[": "editor.fold",
  "Cmd+Alt+]": "editor.unfold",

  // Comments
  "Cmd+/": "editor.toggle_comment",
  "Cmd+Shift+/": "editor.toggle_block_comment",
};

/**
 * Keys that should always pass through to the terminal
 * These are never intercepted by the app
 */
export const terminalPassthroughKeys = new Set([
  "Ctrl+C",  // Interrupt
  "Ctrl+Z",  // Suspend
  "Ctrl+D",  // EOF
  "Ctrl+L",  // Clear (some shells)
  "Ctrl+R",  // Reverse search
  "Ctrl+S",  // Forward search
  "Ctrl+A",  // Beginning of line
  "Ctrl+E",  // End of line
  "Ctrl+K",  // Kill line
  "Ctrl+U",  // Kill line backwards
  "Ctrl+W",  // Kill word
  "Ctrl+Y",  // Yank
  "Ctrl+P",  // Previous command
  "Ctrl+N",  // Next command
  "Tab",     // Completion
  "Shift+Tab", // Reverse completion
]);

/**
 * Merge user keybindings with defaults
 */
export function mergeKeybindings(
  defaults: KeybindingMap,
  userOverrides: KeybindingMap = {}
): KeybindingMap {
  return { ...defaults, ...userOverrides };
}

/**
 * Get all keybindings for a specific context
 */
export function getKeybindingsForContext(
  context: "global" | "terminal" | "editor",
  userOverrides: Record<string, KeybindingMap> = {}
): KeybindingMap {
  switch (context) {
    case "global":
      return mergeKeybindings(globalKeybindings, userOverrides.global);
    case "terminal":
      return mergeKeybindings(
        { ...globalKeybindings, ...terminalKeybindings },
        { ...userOverrides.global, ...userOverrides.terminal }
      );
    case "editor":
      return mergeKeybindings(
        { ...globalKeybindings, ...editorKeybindings },
        { ...userOverrides.global, ...userOverrides.editor }
      );
    default:
      return globalKeybindings;
  }
}
