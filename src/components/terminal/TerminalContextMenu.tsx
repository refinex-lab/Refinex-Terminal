import { useEffect, useState } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Copy, Clipboard, MousePointer, Trash2 } from "lucide-react";
import { Terminal } from "@xterm/xterm";

interface TerminalContextMenuProps {
  terminal: Terminal | null;
  children: React.ReactNode;
}

export function TerminalContextMenu({
  terminal,
  children,
}: TerminalContextMenuProps) {
  const [hasSelection, setHasSelection] = useState(false);

  // Update selection state when context menu opens
  const handleContextMenu = () => {
    if (terminal) {
      setHasSelection(terminal.hasSelection());
    }
  };

  useEffect(() => {
    if (!terminal) return;

    const handleSelectionChange = () => {
      setHasSelection(terminal.hasSelection());
    };

    terminal.onSelectionChange(handleSelectionChange);
  }, [terminal]);

  const handleCopy = async (e: Event) => {
    e.preventDefault();
    if (!terminal || !terminal.hasSelection()) return;

    const selection = terminal.getSelection();
    try {
      await navigator.clipboard.writeText(selection);
      console.log("Copied:", selection);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
    // Menu will auto-close after onSelect
  };

  const handlePaste = async (e: Event) => {
    e.preventDefault();
    if (!terminal) return;

    try {
      const text = await navigator.clipboard.readText();
      console.log("Pasting:", text);
      terminal.paste(text);
    } catch (error) {
      console.error("Failed to paste from clipboard:", error);
    }
    // Menu will auto-close after onSelect
  };

  const handleSelectAll = (e: Event) => {
    e.preventDefault();
    if (!terminal) return;
    console.log("Select all");
    terminal.selectAll();
    setHasSelection(true);
    // Menu will auto-close after onSelect
  };

  const handleClear = (e: Event) => {
    e.preventDefault();
    if (!terminal) return;
    console.log("Clear terminal");
    terminal.clear();
    // Menu will auto-close after onSelect
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={handleContextMenu}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent
        className="w-48"
        style={{
          backgroundColor: "var(--ui-background)",
          borderColor: "var(--ui-border)",
          color: "var(--ui-foreground)",
        }}
      >
        <style>{`
          [data-slot="context-menu-item"]:hover,
          [data-slot="context-menu-item"]:focus {
            background-color: var(--ui-button-background) !important;
            color: var(--ui-foreground) !important;
          }
        `}</style>
        <ContextMenuItem
          onSelect={handleCopy}
          disabled={!hasSelection}
          className="gap-2"
        >
          <Copy className="size-4" />
          Copy
          <span className="ml-auto text-xs" style={{ opacity: 0.6 }}>
            ⌘C
          </span>
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={handlePaste}
          className="gap-2"
        >
          <Clipboard className="size-4" />
          Paste
          <span className="ml-auto text-xs" style={{ opacity: 0.6 }}>
            ⌘V
          </span>
        </ContextMenuItem>
        <ContextMenuSeparator style={{ backgroundColor: "var(--ui-border)" }} />
        <ContextMenuItem
          onSelect={handleSelectAll}
          className="gap-2"
        >
          <MousePointer className="size-4" />
          Select All
          <span className="ml-auto text-xs" style={{ opacity: 0.6 }}>
            ⌘A
          </span>
        </ContextMenuItem>
        <ContextMenuSeparator style={{ backgroundColor: "var(--ui-border)" }} />
        <ContextMenuItem
          onSelect={handleClear}
          className="gap-2"
        >
          <Trash2 className="size-4" />
          Clear Terminal
          <span className="ml-auto text-xs" style={{ opacity: 0.6 }}>
            ⌘K
          </span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
