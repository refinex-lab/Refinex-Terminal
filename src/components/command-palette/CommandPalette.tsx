import { useState, useEffect, useCallback } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useActionBus } from "@/stores/action-bus-store";
import { commands, getCategories, searchCommands, type Command as CommandType } from "@/lib/commands";
import { Terminal, Eye, GitBranch, Settings, Navigation, FileText, Folder } from "lucide-react";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Category icons
const categoryIcons: Record<string, React.ReactNode> = {
  Terminal: <Terminal className="size-4" />,
  View: <Eye className="size-4" />,
  Git: <GitBranch className="size-4" />,
  Settings: <Settings className="size-4" />,
  Navigation: <Navigation className="size-4" />,
  Editor: <FileText className="size-4" />,
  File: <Folder className="size-4" />,
};

// Recent commands storage key
const RECENT_COMMANDS_KEY = "refinex-terminal-recent-commands";
const MAX_RECENT_COMMANDS = 5;

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [search, setSearch] = useState("");
  const [recentCommands, setRecentCommands] = useState<string[]>([]);
  const { dispatch } = useActionBus();

  // Load recent commands from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_COMMANDS_KEY);
      if (stored) {
        setRecentCommands(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load recent commands:", error);
    }
  }, []);

  // Save recent commands to localStorage
  const saveRecentCommand = useCallback((commandId: string) => {
    setRecentCommands((prev) => {
      // Remove if already exists
      const filtered = prev.filter((id) => id !== commandId);
      // Add to front
      const updated = [commandId, ...filtered].slice(0, MAX_RECENT_COMMANDS);

      try {
        localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error("Failed to save recent commands:", error);
      }

      return updated;
    });
  }, []);

  // Execute command
  const executeCommand = useCallback(
    async (command: CommandType) => {
      // Save to recent
      saveRecentCommand(command.id);

      // Close palette
      onOpenChange(false);

      // Dispatch action
      try {
        await dispatch(command.action);
      } catch (error) {
        console.error(`Failed to execute command ${command.id}:`, error);
      }

      // Reset search
      setSearch("");
    },
    [dispatch, onOpenChange, saveRecentCommand]
  );

  // Get filtered commands
  const filteredCommands = search ? searchCommands(search) : commands;

  // Get recent command objects
  const recentCommandObjects = recentCommands
    .map((id) => commands.find((cmd) => cmd.id === id))
    .filter((cmd): cmd is CommandType => cmd !== undefined);

  // Group commands by category
  const categories = getCategories();
  const commandsByCategory = categories.reduce(
    (acc, category) => {
      acc[category] = filteredCommands.filter((cmd) => cmd.category === category);
      return acc;
    },
    {} as Record<string, CommandType[]>
  );

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Type a command or search..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Recent commands */}
        {!search && recentCommandObjects.length > 0 && (
          <>
            <CommandGroup heading="Recent">
              {recentCommandObjects.map((command) => (
                <CommandItem
                  key={command.id}
                  value={command.id}
                  onSelect={() => executeCommand(command)}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    {categoryIcons[command.category]}
                    <div className="flex flex-col">
                      <span>{command.label}</span>
                      {command.description && (
                        <span className="text-xs opacity-70">{command.description}</span>
                      )}
                    </div>
                  </div>
                  {command.keybinding && (
                    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100">
                      {command.keybinding}
                    </kbd>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Commands by category */}
        {categories.map((category) => {
          const categoryCommands = commandsByCategory[category];

          if (!categoryCommands || categoryCommands.length === 0) {
            return null;
          }

          return (
            <CommandGroup key={category} heading={category}>
              {categoryCommands.map((command) => (
                <CommandItem
                  key={command.id}
                  value={`${command.label} ${command.description} ${command.keywords?.join(" ")}`}
                  onSelect={() => executeCommand(command)}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    {categoryIcons[command.category]}
                    <div className="flex flex-col">
                      <span>{command.label}</span>
                      {command.description && (
                        <span className="text-xs opacity-70">{command.description}</span>
                      )}
                    </div>
                  </div>
                  {command.keybinding && (
                    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100">
                      {command.keybinding}
                    </kbd>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
