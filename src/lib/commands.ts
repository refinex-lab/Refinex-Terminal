/**
 * Command definitions for the command palette
 */

export interface Command {
  id: string;
  label: string;
  description?: string;
  category: CommandCategory;
  action: string;
  keywords?: string[];
  keybinding?: string;
  icon?: string;
}

export type CommandCategory =
  | "Terminal"
  | "View"
  | "Git"
  | "Settings"
  | "Navigation"
  | "Editor"
  | "File";

/**
 * All available commands
 */
export const commands: Command[] = [
  // Terminal commands
  {
    id: "terminal.new_tab",
    label: "New Terminal",
    description: "Open a new terminal tab",
    category: "Terminal",
    action: "terminal.new_tab",
    keywords: ["new", "terminal", "tab", "create"],
    keybinding: "Cmd+T",
  },
  {
    id: "terminal.close_tab",
    label: "Close Terminal",
    description: "Close the current terminal tab",
    category: "Terminal",
    action: "terminal.close_tab",
    keywords: ["close", "terminal", "tab"],
    keybinding: "Cmd+W",
  },
  {
    id: "terminal.split_horizontal",
    label: "Split Terminal Horizontally",
    description: "Split the terminal into two horizontal panes",
    category: "Terminal",
    action: "terminal.split_horizontal",
    keywords: ["split", "horizontal", "pane"],
    keybinding: "Cmd+D",
  },
  {
    id: "terminal.split_vertical",
    label: "Split Terminal Vertically",
    description: "Split the terminal into two vertical panes",
    category: "Terminal",
    action: "terminal.split_vertical",
    keywords: ["split", "vertical", "pane"],
    keybinding: "Cmd+Shift+D",
  },
  {
    id: "terminal.clear",
    label: "Clear Terminal",
    description: "Clear the terminal screen",
    category: "Terminal",
    action: "terminal.clear",
    keywords: ["clear", "clean", "reset"],
    keybinding: "Cmd+K",
  },
  {
    id: "terminal.zoom_in",
    label: "Zoom In",
    description: "Increase terminal font size",
    category: "Terminal",
    action: "terminal.zoom_in",
    keywords: ["zoom", "in", "larger", "font"],
    keybinding: "Cmd+=",
  },
  {
    id: "terminal.zoom_out",
    label: "Zoom Out",
    description: "Decrease terminal font size",
    category: "Terminal",
    action: "terminal.zoom_out",
    keywords: ["zoom", "out", "smaller", "font"],
    keybinding: "Cmd+-",
  },
  {
    id: "terminal.zoom_reset",
    label: "Reset Zoom",
    description: "Reset terminal font size to default",
    category: "Terminal",
    action: "terminal.zoom_reset",
    keywords: ["zoom", "reset", "default", "font"],
    keybinding: "Cmd+0",
  },

  // View commands
  {
    id: "sidebar.toggle",
    label: "Toggle Sidebar",
    description: "Show or hide the sidebar",
    category: "View",
    action: "sidebar.toggle",
    keywords: ["sidebar", "toggle", "show", "hide"],
    keybinding: "Cmd+B",
  },
  {
    id: "sidebar.focus_explorer",
    label: "Focus Explorer",
    description: "Focus the file explorer in the sidebar",
    category: "View",
    action: "sidebar.focus_explorer",
    keywords: ["explorer", "files", "focus"],
    keybinding: "Cmd+Shift+E",
  },
  {
    id: "sidebar.focus_search",
    label: "Focus Search",
    description: "Focus the search panel in the sidebar",
    category: "View",
    action: "sidebar.focus_search",
    keywords: ["search", "find", "focus"],
    keybinding: "Cmd+Shift+F",
  },
  {
    id: "command_palette.open_files",
    label: "Go to File",
    description: "Quick open files",
    category: "Navigation",
    action: "command_palette.open_files",
    keywords: ["file", "open", "quick", "goto"],
    keybinding: "Cmd+P",
  },

  // Git commands
  {
    id: "git.commit",
    label: "Git: Commit",
    description: "Commit staged changes",
    category: "Git",
    action: "git.commit",
    keywords: ["git", "commit", "save"],
  },
  {
    id: "git.push",
    label: "Git: Push",
    description: "Push commits to remote",
    category: "Git",
    action: "git.push",
    keywords: ["git", "push", "upload", "remote"],
  },
  {
    id: "git.pull",
    label: "Git: Pull",
    description: "Pull changes from remote",
    category: "Git",
    action: "git.pull",
    keywords: ["git", "pull", "download", "remote"],
  },
  {
    id: "git.fetch",
    label: "Git: Fetch",
    description: "Fetch changes from remote",
    category: "Git",
    action: "git.fetch",
    keywords: ["git", "fetch", "remote"],
  },
  {
    id: "git.stash",
    label: "Git: Stash Changes",
    description: "Stash uncommitted changes",
    category: "Git",
    action: "git.stash",
    keywords: ["git", "stash", "save"],
  },
  {
    id: "git.stash_pop",
    label: "Git: Pop Stash",
    description: "Apply and remove the latest stash",
    category: "Git",
    action: "git.stash_pop",
    keywords: ["git", "stash", "pop", "apply"],
  },
  {
    id: "git.stage_all",
    label: "Git: Stage All Changes",
    description: "Stage all modified files",
    category: "Git",
    action: "git.stage_all",
    keywords: ["git", "stage", "add", "all"],
  },
  {
    id: "git.open_graph",
    label: "Git: Open Graph",
    description: "Open Git graph view",
    category: "Git",
    action: "git.open_graph",
    keywords: ["git", "graph", "history", "log"],
  },

  // Settings commands
  {
    id: "settings.open",
    label: "Open Settings",
    description: "Open application settings",
    category: "Settings",
    action: "settings.open",
    keywords: ["settings", "preferences", "config"],
    keybinding: "Cmd+,",
  },
  {
    id: "settings.open_keybindings",
    label: "Open Keyboard Shortcuts",
    description: "View and edit keyboard shortcuts",
    category: "Settings",
    action: "settings.open_keybindings",
    keywords: ["keyboard", "shortcuts", "keybindings"],
  },
  {
    id: "settings.change_theme",
    label: "Change Theme",
    description: "Select a different color theme",
    category: "Settings",
    action: "settings.change_theme",
    keywords: ["theme", "color", "appearance"],
  },

  // Editor commands
  {
    id: "editor.save",
    label: "Save File",
    description: "Save the current file",
    category: "Editor",
    action: "editor.save",
    keywords: ["save", "file", "write"],
    keybinding: "Cmd+S",
  },
  {
    id: "editor.save_all",
    label: "Save All Files",
    description: "Save all open files",
    category: "Editor",
    action: "editor.save_all",
    keywords: ["save", "all", "files"],
    keybinding: "Cmd+Shift+S",
  },
  {
    id: "editor.close",
    label: "Close Editor",
    description: "Close the current editor tab",
    category: "Editor",
    action: "editor.close",
    keywords: ["close", "editor", "tab"],
  },
  {
    id: "editor.close_all",
    label: "Close All Editors",
    description: "Close all editor tabs",
    category: "Editor",
    action: "editor.close_all",
    keywords: ["close", "all", "editors"],
  },

  // File commands
  {
    id: "file.new",
    label: "New File",
    description: "Create a new file",
    category: "File",
    action: "file.new",
    keywords: ["new", "file", "create"],
  },
  {
    id: "file.open_folder",
    label: "Open Folder",
    description: "Open a folder as a project",
    category: "File",
    action: "file.open_folder",
    keywords: ["open", "folder", "project"],
  },
  {
    id: "file.reveal_in_finder",
    label: "Reveal in Finder",
    description: "Show the current file in Finder",
    category: "File",
    action: "file.reveal_in_finder",
    keywords: ["reveal", "finder", "show", "explorer"],
  },

  // Navigation commands
  {
    id: "navigation.focus_terminal",
    label: "Focus Terminal",
    description: "Move focus to the terminal",
    category: "Navigation",
    action: "navigation.focus_terminal",
    keywords: ["focus", "terminal"],
  },
  {
    id: "navigation.focus_editor",
    label: "Focus Editor",
    description: "Move focus to the editor",
    category: "Navigation",
    action: "navigation.focus_editor",
    keywords: ["focus", "editor"],
  },
  {
    id: "navigation.focus_sidebar",
    label: "Focus Sidebar",
    description: "Move focus to the sidebar",
    category: "Navigation",
    action: "navigation.focus_sidebar",
    keywords: ["focus", "sidebar"],
  },
];

/**
 * Get commands by category
 */
export function getCommandsByCategory(category: CommandCategory): Command[] {
  return commands.filter((cmd) => cmd.category === category);
}

/**
 * Get all categories
 */
export function getCategories(): CommandCategory[] {
  return Array.from(new Set(commands.map((cmd) => cmd.category)));
}

/**
 * Search commands by query
 */
export function searchCommands(query: string): Command[] {
  if (!query.trim()) {
    return commands;
  }

  const lowerQuery = query.toLowerCase();

  return commands.filter((cmd) => {
    // Search in label
    if (cmd.label.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    // Search in description
    if (cmd.description?.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    // Search in keywords
    if (cmd.keywords?.some((keyword) => keyword.toLowerCase().includes(lowerQuery))) {
      return true;
    }

    // Search in action
    if (cmd.action.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    return false;
  });
}
