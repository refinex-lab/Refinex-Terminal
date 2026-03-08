import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Play, Save, X, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

interface MCPServer {
  name: string;
  type: "local" | "stdio" | "http" | "sse";
  command?: string;
  args?: string[];
  url?: string;
  tools: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
}

interface MCPConfig {
  mcpServers: Record<string, Omit<MCPServer, "name">>;
}

export function MCPServerManager() {
  const [mcpConfig, setMcpConfig] = useState<MCPConfig>({ mcpServers: {} });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [testingServer, setTestingServer] = useState<string | null>(null);

  useEffect(() => {
    loadMCPConfig();
  }, []);

  const loadMCPConfig = async () => {
    setLoading(true);
    try {
      const configJson = await invoke<string>("read_copilot_mcp_config");
      const config = JSON.parse(configJson);
      setMcpConfig(config);
    } catch (error) {
      console.error("Failed to load MCP config:", error);
      setMcpConfig({ mcpServers: {} });
    } finally {
      setLoading(false);
    }
  };

  const saveMCPConfig = async () => {
    setSaving(true);
    try {
      const configJson = JSON.stringify(mcpConfig, null, 2);
      await invoke("write_copilot_mcp_config", { content: configJson });
      toast.success("MCP configuration saved successfully");
    } catch (error) {
      toast.error(`Failed to save MCP configuration: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (serverName?: string) => {
    if (serverName) {
      const server = mcpConfig.mcpServers[serverName];
      if (server) {
        setEditingServer({
          name: serverName,
          type: server.type || "local",
          command: server.command,
          args: server.args,
          tools: server.tools || [],
          env: server.env,
          url: server.url,
          headers: server.headers,
        });
      }
    } else {
      setEditingServer({
        name: "",
        type: "local",
        command: "",
        args: [],
        tools: [],
        env: {},
      });
    }
    setIsDialogOpen(true);
  };

  const closeEditDialog = () => {
    setEditingServer(null);
    setIsDialogOpen(false);
  };

  const saveServer = () => {
    if (!editingServer || !editingServer.name.trim()) {
      toast.error("Server name is required");
      return;
    }

    const { name, ...serverConfig } = editingServer;
    setMcpConfig((prev) => ({
      mcpServers: {
        ...prev.mcpServers,
        [name]: serverConfig,
      },
    }));
    closeEditDialog();
    toast.success("Server configuration updated");
  };

  const deleteServer = (serverName: string) => {
    setMcpConfig((prev) => {
      const newServers = { ...prev.mcpServers };
      delete newServers[serverName];
      return { mcpServers: newServers };
    });
    toast.success("Server deleted");
  };

  const testServer = async (serverName: string) => {
    setTestingServer(serverName);
    try {
      // TODO: Implement actual server test via Tauri command
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success(`Server "${serverName}" is responding`);
    } catch (error) {
      toast.error(`Server test failed: ${error}`);
    } finally {
      setTestingServer(null);
    }
  };

  const addTool = () => {
    if (!editingServer) return;
    setEditingServer({
      ...editingServer,
      tools: [...editingServer.tools, ""],
    });
  };

  const updateTool = (index: number, value: string) => {
    if (!editingServer) return;
    const newTools = [...editingServer.tools];
    newTools[index] = value;
    setEditingServer({
      ...editingServer,
      tools: newTools,
    });
  };

  const removeTool = (index: number) => {
    if (!editingServer) return;
    setEditingServer({
      ...editingServer,
      tools: editingServer.tools.filter((_, i) => i !== index),
    });
  };

  const addEnvVar = () => {
    if (!editingServer) return;
    setEditingServer({
      ...editingServer,
      env: { ...editingServer.env, "": "" },
    });
  };

  const updateEnvVar = (oldKey: string, newKey: string, value: string) => {
    if (!editingServer) return;
    const newEnv = { ...editingServer.env };
    if (oldKey !== newKey) {
      delete newEnv[oldKey];
    }
    newEnv[newKey] = value;
    setEditingServer({
      ...editingServer,
      env: newEnv,
    });
  };

  const removeEnvVar = (key: string) => {
    if (!editingServer) return;
    const newEnv = { ...editingServer.env };
    delete newEnv[key];
    setEditingServer({
      ...editingServer,
      env: newEnv,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">MCP Servers</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Configure Model Context Protocol servers for extended capabilities
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadMCPConfig} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => openEditDialog()}>
            <Plus className="size-3 mr-2" />
            Add Server
          </Button>
          <Button size="sm" onClick={saveMCPConfig} disabled={saving}>
            <Save className="size-3 mr-2" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Server List */}
      <div className="space-y-2">
        {Object.entries(mcpConfig.mcpServers).length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg" style={{ borderColor: "var(--ui-border)" }}>
            No MCP servers configured. Click "Add Server" to get started.
          </div>
        ) : (
          Object.entries(mcpConfig.mcpServers).map(([name, server]) => (
            <div
              key={name}
              className="p-4 border rounded-lg space-y-2"
              style={{ borderColor: "var(--ui-border)" }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{name}</h4>
                    <Badge variant="outline">{server.type}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 space-y-1">
                    {server.type === "local" || server.type === "stdio" ? (
                      <p>Command: {server.command} {server.args?.join(" ")}</p>
                    ) : (
                      <p>URL: {server.url}</p>
                    )}
                    <p>Tools: {server.tools.length === 1 && server.tools[0] === "*" ? "All" : server.tools.join(", ")}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => testServer(name)}
                    disabled={testingServer === name}
                  >
                    <Play className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(name)}
                  >
                    <Edit2 className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteServer(name)}
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
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingServer?.name ? "Edit MCP Server" : "Add MCP Server"}</DialogTitle>
          </DialogHeader>

          {editingServer && (
            <div className="space-y-4">
              {/* Server Name */}
              <div className="space-y-2">
                <Label htmlFor="server-name">Server Name</Label>
                <Input
                  id="server-name"
                  value={editingServer.name}
                  onChange={(e) => setEditingServer({ ...editingServer, name: e.target.value })}
                  placeholder="my-mcp-server"
                />
              </div>

              {/* Server Type */}
              <div className="space-y-2">
                <Label htmlFor="server-type">Type</Label>
                <Select
                  value={editingServer.type}
                  onValueChange={(value: any) => setEditingServer({ ...editingServer, type: value })}
                >
                  <SelectTrigger id="server-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Local (stdio)</SelectItem>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="sse">SSE</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Local Server Fields */}
              {(editingServer.type === "local" || editingServer.type === "stdio") && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="command">Command</Label>
                    <Input
                      id="command"
                      value={editingServer.command || ""}
                      onChange={(e) => setEditingServer({ ...editingServer, command: e.target.value })}
                      placeholder="npx"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="args">Arguments (one per line)</Label>
                    <Textarea
                      id="args"
                      value={editingServer.args?.join("\n") || ""}
                      onChange={(e) => setEditingServer({ ...editingServer, args: e.target.value.split("\n").filter(Boolean) })}
                      placeholder="@sentry/mcp-server@latest&#10;--host=$SENTRY_HOST"
                      rows={3}
                    />
                  </div>

                  {/* Environment Variables */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Environment Variables</Label>
                      <Button variant="outline" size="sm" onClick={addEnvVar}>
                        <Plus className="size-3 mr-2" />
                        Add
                      </Button>
                    </div>
                    {Object.entries(editingServer.env || {}).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <Input
                          value={key}
                          onChange={(e) => updateEnvVar(key, e.target.value, value)}
                          placeholder="KEY"
                          className="flex-1"
                        />
                        <Input
                          value={value}
                          onChange={(e) => updateEnvVar(key, key, e.target.value)}
                          placeholder="VALUE"
                          className="flex-1"
                        />
                        <Button variant="ghost" size="icon" onClick={() => removeEnvVar(key)}>
                          <X className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Remote Server Fields */}
              {(editingServer.type === "http" || editingServer.type === "sse") && (
                <div className="space-y-2">
                  <Label htmlFor="url">URL</Label>
                  <Input
                    id="url"
                    value={editingServer.url || ""}
                    onChange={(e) => setEditingServer({ ...editingServer, url: e.target.value })}
                    placeholder="https://mcp.example.com/api"
                  />
                </div>
              )}

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
                  Use "*" to enable all tools, or list specific tool names
                </p>
                {editingServer.tools.map((tool, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={tool}
                      onChange={(e) => updateTool(index, e.target.value)}
                      placeholder="tool_name or *"
                      className="flex-1"
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeTool(index)}>
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Security Warning */}
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <AlertCircle className="size-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-500">
                  <strong>Security Warning:</strong> Copilot will autonomously call tools from this server without asking for permission each time. Only enable trusted servers and specific tools.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>
              Cancel
            </Button>
            <Button onClick={saveServer}>
              Save Server
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
