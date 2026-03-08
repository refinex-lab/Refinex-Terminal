import { useState, useEffect } from "react";
import { Bot, Plus, Trash2, Edit2, Eye, Save, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

interface Agent {
  name: string;
  fileName: string;
  frontmatter: {
    name?: string;
    description: string;
    tools?: string[];
    "disable-model-invocation"?: boolean;
    "user-invocable"?: boolean;
    target?: string;
  };
  content: string;
}

export function CustomAgentsManager() {
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
      const agentsList = await invoke<Agent[]>("list_copilot_agents");
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
        frontmatter: {
          description: "",
          tools: [],
          "disable-model-invocation": false,
          "user-invocable": true,
        },
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

    if (!editingAgent.frontmatter.description.trim()) {
      toast.error("Agent description is required");
      return;
    }

    try {
      await invoke("save_copilot_agent", {
        fileName: editingAgent.fileName,
        frontmatter: editingAgent.frontmatter,
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
      await invoke("delete_copilot_agent", { fileName });
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

  const addTool = () => {
    if (!editingAgent) return;
    setEditingAgent({
      ...editingAgent,
      frontmatter: {
        ...editingAgent.frontmatter,
        tools: [...(editingAgent.frontmatter.tools || []), ""],
      },
    });
  };

  const updateTool = (index: number, value: string) => {
    if (!editingAgent) return;
    const newTools = [...(editingAgent.frontmatter.tools || [])];
    newTools[index] = value;
    setEditingAgent({
      ...editingAgent,
      frontmatter: {
        ...editingAgent.frontmatter,
        tools: newTools,
      },
    });
  };

  const removeTool = (index: number) => {
    if (!editingAgent) return;
    setEditingAgent({
      ...editingAgent,
      frontmatter: {
        ...editingAgent.frontmatter,
        tools: editingAgent.frontmatter.tools?.filter((_, i) => i !== index),
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Custom Agents</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Define specialized AI agents with custom instructions and tool access
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
                    <h4 className="font-medium">{agent.frontmatter.name || agent.fileName.replace(".agent.md", "")}</h4>
                    {!agent.frontmatter["user-invocable"] && (
                      <Badge variant="secondary">Programmatic Only</Badge>
                    )}
                    {agent.frontmatter["disable-model-invocation"] && (
                      <Badge variant="outline">Manual Only</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {agent.frontmatter.description}
                  </p>
                  {agent.frontmatter.tools && agent.frontmatter.tools.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Tools: {agent.frontmatter.tools.join(", ")}
                    </p>
                  )}
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
                  placeholder="my-agent.agent.md"
                />
                <p className="text-xs text-muted-foreground">
                  Location: <code>~/.copilot/agents/{editingAgent.fileName || "..."}</code>
                </p>
              </div>

              {/* Display Name */}
              <div className="space-y-2">
                <Label htmlFor="display-name">Display Name (Optional)</Label>
                <Input
                  id="display-name"
                  value={editingAgent.frontmatter.name || ""}
                  onChange={(e) => setEditingAgent({
                    ...editingAgent,
                    frontmatter: { ...editingAgent.frontmatter, name: e.target.value },
                  })}
                  placeholder="My Custom Agent"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={editingAgent.frontmatter.description}
                  onChange={(e) => setEditingAgent({
                    ...editingAgent,
                    frontmatter: { ...editingAgent.frontmatter, description: e.target.value },
                  })}
                  placeholder="Describe when and how this agent should be used..."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Copilot uses this to decide when to automatically invoke the agent
                </p>
              </div>

              {/* Tools */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Tools</Label>
                  <Button variant="outline" size="sm" onClick={addTool}>
                    <Plus className="size-3 mr-2" />
                    Add Tool
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave empty to enable all, or specify: read, edit, search, execute, web, agent, github/*, etc.
                </p>
                {editingAgent.frontmatter.tools?.map((tool, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={tool}
                      onChange={(e) => updateTool(index, e.target.value)}
                      placeholder="read"
                      className="flex-1"
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeTool(index)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Invocation Settings */}
              <div className="space-y-3">
                <Label>Invocation Settings</Label>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="user-invocable" className="text-xs font-normal">User Invocable</Label>
                    <p className="text-xs text-muted-foreground">Allow users to manually select this agent</p>
                  </div>
                  <Switch
                    id="user-invocable"
                    checked={editingAgent.frontmatter["user-invocable"] ?? true}
                    onCheckedChange={(checked) => setEditingAgent({
                      ...editingAgent,
                      frontmatter: { ...editingAgent.frontmatter, "user-invocable": checked },
                    })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="disable-auto" className="text-xs font-normal">Disable Auto-Invocation</Label>
                    <p className="text-xs text-muted-foreground">Prevent model from automatically calling this agent</p>
                  </div>
                  <Switch
                    id="disable-auto"
                    checked={editingAgent.frontmatter["disable-model-invocation"] ?? false}
                    onCheckedChange={(checked) => setEditingAgent({
                      ...editingAgent,
                      frontmatter: { ...editingAgent.frontmatter, "disable-model-invocation": checked },
                    })}
                  />
                </div>
              </div>

              {/* Agent Instructions */}
              <div className="space-y-2">
                <Label htmlFor="content">Agent Instructions (Markdown)</Label>
                <Textarea
                  id="content"
                  value={editingAgent.content}
                  onChange={(e) => setEditingAgent({ ...editingAgent, content: e.target.value })}
                  placeholder="You are a specialized agent for...&#10;&#10;## Your Role&#10;- Task 1&#10;- Task 2&#10;&#10;## Guidelines&#10;- Guideline 1&#10;- Guideline 2"
                  rows={12}
                  className="font-mono text-xs"
                />
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
            <DialogTitle>Agent Preview: {previewAgent?.frontmatter.name || previewAgent?.fileName}</DialogTitle>
          </DialogHeader>
          {previewAgent && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-medium">Description</Label>
                <p className="text-sm mt-1">{previewAgent.frontmatter.description}</p>
              </div>
              {previewAgent.frontmatter.tools && previewAgent.frontmatter.tools.length > 0 && (
                <div>
                  <Label className="text-xs font-medium">Tools</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {previewAgent.frontmatter.tools.map((tool, i) => (
                      <Badge key={i} variant="secondary">{tool}</Badge>
                    ))}
                  </div>
                </div>
              )}
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
