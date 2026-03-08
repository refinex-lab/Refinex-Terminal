import { useState, useEffect } from "react";
import { Shield, Plus, Trash2, Save, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

interface SandboxConfig {
  enabled?: boolean;
  networkIsolation?: boolean;
  excludedCommands?: string[];
  allowedUnixSockets?: string[];
}

export function SandboxManager() {
  const [sandbox, setSandbox] = useState<SandboxConfig>({
    enabled: false,
    networkIsolation: false,
    excludedCommands: [],
    allowedUnixSockets: [],
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newCommand, setNewCommand] = useState("");
  const [newSocket, setNewSocket] = useState("");

  useEffect(() => {
    loadSandbox();
  }, []);

  const loadSandbox = async () => {
    setLoading(true);
    try {
      const settingsJson = await invoke<string>("read_claude_settings");
      const settings = JSON.parse(settingsJson);
      if (settings.sandbox) {
        setSandbox({
          enabled: settings.sandbox.enabled ?? false,
          networkIsolation: settings.sandbox.networkIsolation ?? false,
          excludedCommands: settings.sandbox.excludedCommands || [],
          allowedUnixSockets: settings.sandbox.allowedUnixSockets || [],
        });
      }
    } catch (error) {
      console.error("Failed to load sandbox config:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveSandbox = async () => {
    setSaving(true);
    try {
      const settingsJson = await invoke<string>("read_claude_settings");
      const settings = JSON.parse(settingsJson);
      settings.sandbox = sandbox;
      await invoke("write_claude_settings", { content: JSON.stringify(settings, null, 2) });
      toast.success("Sandbox configuration saved successfully");
    } catch (error) {
      toast.error(`Failed to save sandbox configuration: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  const addExcludedCommand = () => {
    if (!newCommand.trim()) {
      toast.error("Command cannot be empty");
      return;
    }
    if (sandbox.excludedCommands?.includes(newCommand)) {
      toast.error("Command already excluded");
      return;
    }
    setSandbox((prev) => ({
      ...prev,
      excludedCommands: [...(prev.excludedCommands || []), newCommand],
    }));
    setNewCommand("");
    toast.success("Command excluded");
  };

  const removeExcludedCommand = (command: string) => {
    setSandbox((prev) => ({
      ...prev,
      excludedCommands: prev.excludedCommands?.filter((c) => c !== command),
    }));
    toast.success("Command removed");
  };

  const addAllowedSocket = () => {
    if (!newSocket.trim()) {
      toast.error("Socket path cannot be empty");
      return;
    }
    if (sandbox.allowedUnixSockets?.includes(newSocket)) {
      toast.error("Socket already allowed");
      return;
    }
    setSandbox((prev) => ({
      ...prev,
      allowedUnixSockets: [...(prev.allowedUnixSockets || []), newSocket],
    }));
    setNewSocket("");
    toast.success("Socket allowed");
  };

  const removeAllowedSocket = (socket: string) => {
    setSandbox((prev) => ({
      ...prev,
      allowedUnixSockets: prev.allowedUnixSockets?.filter((s) => s !== socket),
    }));
    toast.success("Socket removed");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Sandbox Configuration</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Isolate Claude Code execution environment for enhanced security
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadSandbox} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
          <Button size="sm" onClick={saveSandbox} disabled={saving}>
            <Save className="size-3 mr-2" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Security Warning */}
      <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <AlertCircle className="size-4 text-yellow-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-yellow-500">
          <strong>Security Note:</strong> Sandbox mode restricts file system access and network operations. Some tools may not work correctly when enabled. Test thoroughly before production use.
        </div>
      </div>

      {/* Enable Sandbox */}
      <div className="flex items-center justify-between p-4 border rounded-lg" style={{ borderColor: "var(--ui-border)" }}>
        <div>
          <Label htmlFor="sandbox-enabled" className="text-sm font-medium">Enable Sandbox</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Run Claude Code in an isolated environment with restricted permissions
          </p>
        </div>
        <Switch
          id="sandbox-enabled"
          checked={sandbox.enabled ?? false}
          onCheckedChange={(checked) => setSandbox((prev) => ({ ...prev, enabled: checked }))}
        />
      </div>

      {/* Network Isolation */}
      <div className="flex items-center justify-between p-4 border rounded-lg" style={{ borderColor: "var(--ui-border)" }}>
        <div>
          <Label htmlFor="network-isolation" className="text-sm font-medium">Network Isolation</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Block all network access except allowed Unix sockets
          </p>
        </div>
        <Switch
          id="network-isolation"
          checked={sandbox.networkIsolation ?? false}
          onCheckedChange={(checked) => setSandbox((prev) => ({ ...prev, networkIsolation: checked }))}
          disabled={!sandbox.enabled}
        />
      </div>

      {/* Excluded Commands */}
      <div className="space-y-3 pt-4 border-t" style={{ borderColor: "var(--ui-border)" }}>
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-red-500" />
          <Label className="text-sm font-medium">Excluded Commands</Label>
          <Badge variant="destructive" className="text-xs">Blocked in Sandbox</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Commands that are blocked when sandbox is enabled
        </p>
        <div className="space-y-2">
          {sandbox.excludedCommands && sandbox.excludedCommands.length > 0 ? (
            sandbox.excludedCommands.map((command) => (
              <div key={command} className="flex items-center gap-2 p-2 border rounded-lg bg-red-500/5" style={{ borderColor: "var(--ui-border)" }}>
                <code className="flex-1 text-xs font-mono text-red-500">{command}</code>
                <Button variant="ghost" size="icon" onClick={() => removeExcludedCommand(command)}>
                  <Trash2 className="size-4 text-red-500" />
                </Button>
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-xs text-muted-foreground border rounded-lg" style={{ borderColor: "var(--ui-border)" }}>
              No commands excluded
            </div>
          )}
          <div className="flex gap-2">
            <Input
              placeholder="rm, curl, wget, etc."
              value={newCommand}
              onChange={(e) => setNewCommand(e.target.value)}
              className="flex-1 font-mono text-xs"
              disabled={!sandbox.enabled}
            />
            <Button variant="outline" size="icon" onClick={addExcludedCommand} disabled={!sandbox.enabled}>
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Allowed Unix Sockets */}
      <div className="space-y-3 pt-4 border-t" style={{ borderColor: "var(--ui-border)" }}>
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-green-500" />
          <Label className="text-sm font-medium">Allowed Unix Sockets</Label>
          <Badge variant="secondary" className="text-xs">Network Isolation</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Unix socket paths that are allowed when network isolation is enabled
        </p>
        <div className="space-y-2">
          {sandbox.allowedUnixSockets && sandbox.allowedUnixSockets.length > 0 ? (
            sandbox.allowedUnixSockets.map((socket) => (
              <div key={socket} className="flex items-center gap-2 p-2 border rounded-lg" style={{ borderColor: "var(--ui-border)" }}>
                <code className="flex-1 text-xs font-mono">{socket}</code>
                <Button variant="ghost" size="icon" onClick={() => removeAllowedSocket(socket)}>
                  <Trash2 className="size-4 text-red-500" />
                </Button>
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-xs text-muted-foreground border rounded-lg" style={{ borderColor: "var(--ui-border)" }}>
              No sockets allowed
            </div>
          )}
          <div className="flex gap-2">
            <Input
              placeholder="/var/run/docker.sock, /tmp/my-app.sock"
              value={newSocket}
              onChange={(e) => setNewSocket(e.target.value)}
              className="flex-1 font-mono text-xs"
              disabled={!sandbox.enabled || !sandbox.networkIsolation}
            />
            <Button variant="outline" size="icon" onClick={addAllowedSocket} disabled={!sandbox.enabled || !sandbox.networkIsolation}>
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
