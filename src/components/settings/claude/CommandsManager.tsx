import { useState, useEffect } from "react";
import { Terminal, Plus, Trash2, Edit2, Eye, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

interface Command {
  name: string;
  fileName: string;
  content: string;
}

export function CommandsManager() {
  const [commands, setCommands] = useState<Command[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingCommand, setEditingCommand] = useState<Command | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewCommand, setPreviewCommand] = useState<Command | null>(null);

  useEffect(() => {
    loadCommands();
  }, []);

  const loadCommands = async () => {
    setLoading(true);
    try {
      const commandsList = await invoke<Command[]>("list_claude_commands");
      setCommands(commandsList);
    } catch (error) {
      console.error("Failed to load commands:", error);
      setCommands([]);
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (command?: Command) => {
    if (command) {
      setEditingCommand(command);
    } else {
      setEditingCommand({
        name: "",
        fileName: "",
        content: "",
      });
    }
    setIsDialogOpen(true);
  };

  const closeEditDialog = () => {
    setEditingCommand(null);
    setIsDialogOpen(false);
  };

  const saveCommand = async () => {
    if (!editingCommand || !editingCommand.fileName.trim()) {
      toast.error("Command file name is required");
      return;
    }

    if (!editingCommand.content.trim()) {
      toast.error("Command content is required");
      return;
    }

    try {
      await invoke("save_claude_command", {
        fileName: editingCommand.fileName,
        content: editingCommand.content,
      });
      toast.success("Command saved successfully");
      loadCommands();
      closeEditDialog();
    } catch (error) {
      toast.error(`Failed to save command: ${error}`);
    }
  };

  const deleteCommand = async (fileName: string) => {
    try {
      await invoke("delete_claude_command", { fileName });
      toast.success("Command deleted successfully");
      loadCommands();
    } catch (error) {
      toast.error(`Failed to delete command: ${error}`);
    }
  };

  const openPreview = (command: Command) => {
    setPreviewCommand(command);
    setIsPreviewOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Custom Slash Commands</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Define custom slash commands (stored in ~/.claude/commands/)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadCommands} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => openEditDialog()}>
            <Plus className="size-3 mr-2" />
            New Command
          </Button>
        </div>
      </div>

      {/* Command List */}
      <div className="space-y-2">
        {commands.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg" style={{ borderColor: "var(--ui-border)" }}>
            No custom commands configured. Click "New Command" to create one.
          </div>
        ) : (
          commands.map((command) => (
            <div
              key={command.fileName}
              className="p-4 border rounded-lg space-y-2"
              style={{ borderColor: "var(--ui-border)" }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Terminal className="size-4" />
                    <h4 className="font-medium">/{command.name || command.fileName.replace(".md", "")}</h4>
                    <Badge variant="outline" className="text-xs">Slash Command</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {command.fileName}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openPreview(command)}
                  >
                    <Eye className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(command)}
                  >
                    <Edit2 className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteCommand(command.fileName)}
                  >
                    <Trash2 className="size-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCommand?.fileName ? "Edit Command" : "New Command"}</DialogTitle>
          </DialogHeader>

          {editingCommand && (
            <div className="space-y-4">
              {/* File Name */}
              <div className="space-y-2">
                <Label htmlFor="file-name">File Name</Label>
                <Input
                  id="file-name"
                  value={editingCommand.fileName}
                  onChange={(e) => setEditingCommand({ ...editingCommand, fileName: e.target.value })}
                  placeholder="my-command.md"
                />
                <p className="text-xs text-muted-foreground">
                  Location: <code>~/.claude/commands/{editingCommand.fileName || "..."}</code>
                </p>
              </div>

              {/* Command Name */}
              <div className="space-y-2">
                <Label htmlFor="command-name">Command Name (without /)</Label>
                <Input
                  id="command-name"
                  value={editingCommand.name || ""}
                  onChange={(e) => setEditingCommand({ ...editingCommand, name: e.target.value })}
                  placeholder="mycommand"
                />
                <p className="text-xs text-muted-foreground">
                  Usage: <code>/{editingCommand.name || "mycommand"}</code>
                </p>
              </div>

              {/* Command Instructions */}
              <div className="space-y-2">
                <Label htmlFor="content">Command Instructions (Markdown)</Label>
                <Textarea
                  id="content"
                  value={editingCommand.content}
                  onChange={(e) => setEditingCommand({ ...editingCommand, content: e.target.value })}
                  placeholder="# Command Description&#10;&#10;This command does...&#10;&#10;## Usage&#10;Use this command to...&#10;&#10;## Examples&#10;- Example 1&#10;- Example 2"
                  rows={16}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Define what this slash command should do. Use natural language instructions.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>
              Cancel
            </Button>
            <Button onClick={saveCommand}>
              <Save className="size-3 mr-2" />
              Save Command
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Command Preview: /{previewCommand?.name || previewCommand?.fileName}</DialogTitle>
          </DialogHeader>
          {previewCommand && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-medium">File Name</Label>
                <p className="text-sm mt-1 font-mono">{previewCommand.fileName}</p>
              </div>
         <div>
                <Label className="text-xs font-medium">Usage</Label>
                <p className="text-sm mt-1 font-mono">/{previewCommand.name || previewCommand.fileName.replace(".md", "")}</p>
              </div>
              <div>
                <Label className="text-xs font-medium">Instructions</Label>
                <pre className="mt-1 p-3 bg-muted rounded-lg text-xs whitespace-pre-wrap">
                  {previewCommand.content || "No instructions provided"}
                </pre>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
