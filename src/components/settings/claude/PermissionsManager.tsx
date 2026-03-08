import { useState, useEffect } from "react";
import { Shield, Plus, Trash2, AlertCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

interface PermissionRule {
  tool: string;
  pattern?: string;
}

interface PermissionsConfig {
  allow: string[];
  deny: string[];
  ask: string[];
  defaultMode: "default" | "acceptEdits" | "plan" | "bypassPermissions";
  additionalDirectories?: string[];
  disableBypassPermissionsMode?: "disable";
}

const TOOL_OPTIONS = [
  { value: "Bash", label: "Bash", description: "Execute shell commands" },
  { value: "Read", label: "Read", description: "Read files" },
  { value: "Write", label: "Write", description: "Write files" },
  { value: "Edit", label: "Edit", description: "Edit files (diff)" },
  { value: "Glob", label: "Glob", description: "File pattern matching" },
  { value: "Grep", label: "Grep", description: "Content search" },
  { value: "WebSearch", label: "WebSearch", description: "Web search" },
  { value: "WebFetch", label: "WebFetch", description: "Fetch URL content" },
  { value: "Task", label: "Task", description: "Launch subagent" },
];

const PATTERN_EXAMPLES = {
  Bash: ["npm *", "git *", "rm -rf *", "sudo *"],
  Read: ["./src/**", "**/.env", "**/secrets/**"],
  Write: ["./src/**", "./dist/**"],
  Edit: ["./src/**/*.ts", "./src/**/*.tsx"],
  Glob: ["**/*.js", "src/**"],
  Grep: ["*"],
};

export function PermissionsManager() {
  const [permissions, setPermissions] = useState<PermissionsConfig>({
    allow: [],
    deny: [],
    ask: [],
    defaultMode: "default",
    additionalDirectories: [],
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // New rule inputs
  const [newAllowTool, setNewAllowTool] = useState("");
  const [newAllowPattern, setNewAllowPattern] = useState("");
  const [newDenyTool, setNewDenyTool] = useState("");
  const [newDenyPattern, setNewDenyPattern] = useState("");
  const [newAskTool, setNewAskTool] = useState("");
  const [newAdditionalDir, setNewAdditionalDir] = useState("");

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const settingsJson = await invoke<string>("read_claude_settings");
      const settings = JSON.parse(settingsJson);
      if (settings.permissions) {
        setPermissions({
          allow: settings.permissions.allow || [],
          deny: settings.permissions.deny || [],
          ask: settings.permissions.ask || [],
          defaultMode: settings.permissions.defaultMode || "default",
          additionalDirectories: settings.permissions.additionalDirectories || [],
          disableBypassPermissionsMode: settings.permissions.disableBypassPermissionsMode,
        });
      }
    } catch (error) {
      console.error("Failed to load permissions:", error);
    } finally {
      setLoading(false);
    }
  };

  const savePermissions = async () => {
    setSaving(true);
    try {
      const settingsJson = await invoke<string>("read_claude_settings");
      const settings = JSON.parse(settingsJson);
      settings.permissions = permissions;
      await invoke("write_claude_settings", { content: JSON.stringify(settings, null, 2) });
      toast.success("Permissions saved successfully");
    } catch (error) {
      toast.error(`Failed to save permissions: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  const addAllowRule = () => {
    if (!newAllowTool) {
      toast.error("Please select a tool");
      return;
    }
    const rule = newAllowPattern ? `${newAllowTool}(${newAllowPattern})` : newAllowTool;
    if (permissions.allow.includes(rule)) {
      toast.error("Rule already exists");
      return;
    }
    setPermissions((prev) => ({
      ...prev,
      allow: [...prev.allow, rule],
    }));
    setNewAllowTool("");
    setNewAllowPattern("");
  };

  const removeAllowRule = (rule: string) => {
    setPermissions((prev) => ({
      ...prev,
      allow: prev.allow.filter((r) => r !== rule),
    }));
  };

  const addDenyRule = () => {
    if (!newDenyTool) {
      toast.error("Please select a tool");
      return;
    }
    const rule = newDenyPattern ? `${newDenyTool}(${newDenyPattern})` : newDenyTool;
    if (permissions.deny.includes(rule)) {
      toast.error("Rule already exists");
      return;
    }
    setPermissions((prev) => ({
      ...prev,
      deny: [...prev.deny, rule],
    }));
    setNewDenyTool("");
    setNewDenyPattern("");
  };

  const removeDenyRule = (rule: string) => {
    setPermissions((prev) => ({
      ...prev,
      deny: prev.deny.filter((r) => r !== rule),
    }));
  };

  const addAskRule = () => {
    if (!newAskTool) {
      toast.error("Please select a tool");
      return;
    }
    if (permissions.ask.includes(newAskTool)) {
      toast.error("Rule already exists");
      return;
    }
    setPermissions((prev) => ({
      ...prev,
      ask: [...prev.ask, newAskTool],
    }));
    setNewAskTool("");
  };

  const removeAskRule = (rule: string) => {
    setPermissions((prev) => ({
      ...prev,
      ask: prev.ask.filter((r) => r !== rule),
    }));
  };

  const addAdditionalDir = () => {
    if (!newAdditionalDir.trim()) {
      toast.error("Directory path cannot be empty");
      return;
    }
    if (permissions.additionalDirectories?.includes(newAdditionalDir)) {
      toast.error("Directory already exists");
      return;
    }
    setPermissions((prev) => ({
      ...prev,
      additionalDirectories: [...(prev.additionalDirectories || []), newAdditionalDir],
    }));
    setNewAdditionalDir("");
  };

  const removeAdditionalDir = (dir: string) => {
    setPermissions((prev) => ({
      ...prev,
      additionalDirectories: prev.additionalDirectories?.filter((d) => d !== dir),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Permissions</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Fine-grained access control for Claude Code tools
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadPermissions} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
          <Button size="sm" onClick={savePermissions} disabled={saving}>
            <Save className="size-3 mr-2" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Security Warning */}
      <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <AlertCircle className="size-4 text-yellow-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-yellow-500">
          <strong>Security Note:</strong> Deny rules have the highest priority and cannot be overridden by allow rules. Use wildcards carefully (e.g., <code>Bash(rm -rf *)</code>).
        </div>
      </div>

      {/* Default Mode */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Default Mode</Label>
        <RadioGroup
          value={permissions.defaultMode}
          onValueChange={(value: any) => setPermissions((prev) => ({ ...prev, defaultMode: value }))}
          className="grid grid-cols-2 gap-3"
        >
          <div className="flex items-center space-x-2 border rounded-lg p-3">
            <RadioGroupItem value="default" id="mode-default" />
            <div className="flex-1">
              <Label htmlFor="mode-default" className="text-xs font-medium cursor-pointer">Default</Label>
              <p className="text-xs text-muted-foreground">Ask for dangerous operations</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 border rounded-lg p-3">
            <RadioGroupItem value="acceptEdits" id="mode-accept" />
            <div className="flex-1">
              <Label htmlFor="mode-accept" className="text-xs font-medium cursor-pointer">Accept Edits</Label>
              <p className="text-xs text-muted-foreground">Auto-accept file edits</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 border rounded-lg p-3">
            <RadioGroupItem value="plan" id="mode-plan" />
            <div className="flex-1">
              <Label htmlFor="mode-plan" className="text-xs font-medium cursor-pointer">Plan</Label>
              <p className="text-xs text-muted-foreground">Read-only planning mode</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 border rounded-lg p-3 bg-red-500/5">
            <RadioGroupItem value="bypassPermissions" id="mode-bypass" />
            <div className="flex-1">
              <Label htmlFor="mode-bypass" className="text-xs font-medium cursor-pointer text-red-500">Bypass Permissions</Label>
              <p className="text-xs text-red-500">⚠️ Skip all checks (dangerous)</p>
            </div>
          </div>
        </RadioGroup>
      </div>

      {/* Allow Rules */}
      <div className="space-y-3 pt-4 border-t" style={{ borderColor: "var(--ui-border)" }}>
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-green-500" />
          <Label className="text-sm font-medium">Allow Rules</Label>
          <Badge variant="secondary" className="text-xs">Pre-approved</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Tools and patterns that Claude can use without asking
        </p>
        <div className="space-y-2">
          {permissions.allow.map((rule) => (
            <div key={rule} className="flex items-center gap-2 p-2 border rounded-lg" style={{ borderColor: "var(--ui-border)" }}>
              <code className="flex-1 text-xs font-mono">{rule}</code>
              <Button variant="ghost" size="icon" onClick={() => removeAllowRule(rule)}>
                <Trash2 className="size-4 text-red-500" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Select value={newAllowTool} onValueChange={setNewAllowTool}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select tool" />
              </SelectTrigger>
              <SelectContent>
                {TOOL_OPTIONS.map((tool) => (
                  <SelectItem key={tool.value} value={tool.value}>
                    {tool.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Pattern (optional): npm *, ./src/**"
              value={newAllowPattern}
              onChange={(e) => setNewAllowPattern(e.target.value)}
              className="flex-1 font-mono text-xs"
            />
            <Button variant="outline" size="icon" onClick={addAllowRule}>
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Deny Rules */}
      <div className="space-y-3 pt-4 border-t" style={{ borderColor: "var(--ui-border)" }}>
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-red-500" />
          <Label className="text-sm font-medium">Deny Rules</Label>
          <Badge variant="destructive" className="text-xs">Blocked</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Tools and patterns that Claude cannot use (highest priority)
        </p>
        <div className="space-y-2">
          {permissions.deny.map((rule) => (
            <div key={rule} className="flex items-center gap-2 p-2 border rounded-lg bg-red-500/5" style={{ borderColor: "var(--ui-border)" }}>
              <code className="flex-1 text-xs font-mono text-red-500">{rule}</code>
              <Button variant="ghost" size="icon" onClick={() => removeDenyRule(rule)}>
                <Trash2 className="size-4 text-red-500" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Select value={newDenyTool} onValueChange={setNewDenyTool}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select tool" />
              </SelectTrigger>
              <SelectContent>
                {TOOL_OPTIONS.map((tool) => (
                  <SelectItem key={tool.value} value={tool.value}>
                    {tool.label}
                  </SelectItem>
                ))}
            </SelectContent>
            </Select>
            <Input
              placeholder="Pattern (optional): rm -rf *, **/.env"
              value={newDenyPattern}
              onChange={(e) => setNewDenyPattern(e.target.value)}
              className="flex-1 font-mono text-xs"
            />
            <Button variant="outline" size="icon" onClick={addDenyRule}>
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Ask Rules */}
      <div className="space-y-3 pt-4 border-t" style={{ borderColor: "var(--ui-border)" }}>
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-blue-500" />
          <Label className="text-sm font-medium">Ask Rules</Label>
          <Badge variant="outline" className="text-xs">Always Confirm</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Tools that always require user confirmation
        </p>
        <div className="space-y-2">
          {permissions.ask.map((rule) => (
            <div key={rule} className="flex items-center gap-2 p-2 border rounded-lg" style={{ borderColor: "var(--ui-border)" }}>
              <code className="flex-1 text-xs font-mono">{rule}</code>
              <Button variant="ghost" size="icon" onClick={() => removeAskRule(rule)}>
                <Trash2 className="size-4 text-red-500" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Select value={newAskTool} onValueChange={setNewAskTool}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select tool" />
              </SelectTrigger>
              <SelectContent>
                {TOOL_OPTIONS.map((tool) => (
                  <SelectItem key={tool.value} value={tool.value}>
                    {tool.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={addAskRule}>
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Additional Directories */}
      <div className="space-y-3 pt-4 border-t" style={{ borderColor: "var(--ui-border)" }}>
        <Label className="text-sm font-medium">Additional Directories</Label>
        <p className="text-xs text-muted-foreground">
          Allow Claude to access directories outside the project root
        </p>
        <div className="space-y-2">
          {permissions.additionalDirectories?.map((dir) => (
            <div key={dir} className="flex items-center gap-2 p-2 border rounded-lg" style={{ borderColor: "var(--ui-border)" }}>
              <code className="flex-1 text-xs font-mono">{dir}</code>
              <Button variant="ghost" size="icon" onClick={() => removeAdditionalDir(dir)}>
                <Trash2 className="size-4 text-red-500" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              placeholder="/path/to/additional/directory"
              value={newAdditionalDir}
              onChange={(e) => setNewAdditionalDir(e.target.value)}
              className="flex-1 font-mono text-xs"
            />
            <Button variant="outline" size="icon" onClick={addAdditionalDir}>
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
