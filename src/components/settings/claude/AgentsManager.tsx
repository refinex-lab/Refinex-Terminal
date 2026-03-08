import { useState, useEffect } from "react";
import { Bot, Plus, Trash2, Edit2, Eye, Save, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

interface Agent {
  name: string;
  fileName: string;
  content: string;
}

export function AgentsManager() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewAgent, setPreviewAgent] = useState<Agent | null>(null);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    setLoading(true);
    try {
      const agentsList = await invoke<Agent[]>("list_claude_agents");
      setAgents(agentsList);
    } catch (error) {
      console.error("Failed to load agents:", error);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (agent?: Agent) => {
    if (agent) {
      setEditingAgent(agent);
    } else {
      setEditingAgent({
        name: "",
        fileName: "",
        content: "",
      });
    }
    setIsDialogOpen(true);
  };

  const closeEditDialog = () => {
    setEditingAgent(null);
    setIsDialogOpen(false);
  };

  const saveAgent = async () => {
    if (!editingAgent || !editingAgent.fileName.trim()) {
      toast.error("Agent file name is required");
      return;
    }

    if (!editingAgent.content.trim()) {
      toast.error("Agent content is required");
      return;
    }

    try {
      await invoke("save_claude_agent", {
        fileName: editingAgent.fileName,
        content: editingAgent.content,
      });
      toast.success("Agent saved successfully");
      loadAgents();
      closeEditDialog();
    } catch (error) {
      toast.error(`Failed to save agent: ${error}`);
    }
  };

  const deleteAgent = async (fileName: string) => {
    try {
      await invoke("delete_claude_agent", { fileName });
      toast.success("Agent deleted successfully");
      loadAgents();
    } catch (error) {
      toast.error(`Failed to delete agent: ${error}`);
    }
  };

  const openPreview = (agent: Agent) => {
    setPreviewAgent(agent);
    setIsPreviewOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Custom Agents</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Define specialized AI agents with custom instructions (stored in ~/.claude/agents/)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadAgents} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => openEditDialog()}>
            <Plus className="size-3 mr-2" />
            New Agent
          </Button>
        </div>
      </div>

      {/* Agent List */}
      <div className="space-y-2">
        {agents.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg" style={{ borderColor: "var(--ui-border)" }}>
            No custom agents configured. Click "New Agent" to create one.
          </div>
        ) : (
          agents.map((agent) => (
            <div
              key={agent.fileName}
              className="p-4 border rounded-lg space-y-2"
              style={{ borderColor: "var(--ui-border)" }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Bot className="size-4" />
                    <h4 className="font-medium">{agent.name || agent.fileName.replace(".md", "")}</h4>
                    <Badge variant="outline" className="text-xs">Markdown</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {agent.fileName}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openPreview(agent)}
                  >
                    <Eye className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(agent)}
                  >
                    <Edit2 className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteAgent(agent.fileName)}
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
            <DialogTitle>{editingAgent?.fileName ? "Edit Agent" : "New Agent"}</DialogTitle>
          </DialogHeader>

          {editingAgent && (
            <div className="space-y-4">
              {/* File Name */}
              <div className="space-y-2">
                <Label htmlFor="file-name">File Name</Label>
                <Input
                  id="file-name"
                  value={editingAgent.fileName}
                  onChange={(e) => setEditingAgent({ ...editingAgent, fileName: e.target.value })}
                  placeholder="my-agent.md"
                />
                <p className="text-xs text-muted-foreground">
                  Location: <code>~/.claude/agents/{editingAgent.fileName || "..."}</code>
                </p>
              </div>

              {/* Display Name */}
              <div className="space-y-2">
                <Label htmlFor="display-name">Display Name</Label>
                <Input
                  id="display-name"
                  value={editingAgent.name || ""}
                  onChange={(e) => setEditingAgent({ ...editingAgent, name: e.target.value })}
                  placeholder="My Custom Agent"
                />
              </div>

              {/* Agent Instructions */}
              <div className="space-y-2">
                <Label htmlFor="content">Agent Instructions (Markdown)</Label>
                <Textarea
                  id="content"
                  value={editingAgent.content}
                  onChange={(e) => setEditingAgent({ ...editingAgent, content: e.target.value })}
                  placeholder="# Agent Name&#10;&#10;## Purpose&#10;This agent specializes in...&#10;&#10;## Instructions&#10;- Task 1&#10;- Task 2&#10;&#10;## Guidelines&#10;- Guideline 1&#10;- Guideline 2"
                  rows={16}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Write natural language instructions for this agent. Use Markdown formatting.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>
              Cancel
            </Button>
            <Button onClick={saveAgent}>
              <Save className="size-3 mr-2" />
              Save Agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agent Preview: {previewAgent?.name || previewAgent?.fileName}</DialogTitle>
          </DialogHeader>
          {previewAgent && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-medium">File Name</Label>
                <p className="text-sm mt-1 font-mono">{previewAgent.fileName}</p>
              </div>
              <div>
                <Label className="text-xs font-medium">Instructions</Label>
                <pre className="mt-1 p-3 bg-muted rounded-lg text-xs whitespace-pre-wrap">
                  {previewAgent.content || "No instructions provided"}
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
