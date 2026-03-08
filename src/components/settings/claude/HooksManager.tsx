import { useState, useEffect } from "react";
import { Webhook, Plus, Trash2, Edit2, Eye, Save, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

interface Hook {
  type: "command" | "http";
  command?: string;
  url?: string;
  timeout?: number;
}

interface HookMatcher {
  matcher: string;
  hooks: Hook[];
}

interface HooksConfig {
  PreToolUse?: HookMatcher[];
  PostToolUse?: HookMatcher[];
  Stop?: HookMatcher[];
  SubagentStop?: HookMatcher[];
  Notification?: HookMatcher[];
  SessionStart?: HookMatcher[];
  SessionEnd?: HookMatcher[];
  UserPromptSubmit?: HookMatcher[];
  PreCompact?: HookMatcher[];
  InstructionsLoaded?: HookMatcher[];
  ConfigChange?: HookMatcher[];
  WorktreeCreate?: HookMatcher[];
  WorktreeRemove?: HookMatcher[];
  TeammateIdle?: HookMatcher[];
  TaskCompleted?: HookMatcher[];
  SubagentStart?: HookMatcher[];
  Setup?: HookMatcher[];
  PermissionRequest?: HookMatcher[];
}

const HOOK_EVENTS = [
  { value: "PreToolUse", label: "Pre Tool Use", description: "Before tool execution", supportsMatcher: true },
  { value: "PostToolUse", label: "Post Tool Use", description: "After tool execution", supportsMatcher: true },
  { value: "Stop", label: "Stop", description: "After Claude completes response", supportsMatcher: true },
  { value: "SubagentStop", label: "Subagent Stop", description: "After subagent completes", supportsMatcher: true },
  { value: "SessionStart", label: "Session Start", description: "When session starts", supportsMatcher: true },
  { value: "SessionEnd", label: "Session End", description: "When session ends", supportsMatcher: false },
  { value: "UserPromptSubmit", label: "User Prompt Submit", description: "After user submits prompt", supportsMatcher: true },
  { value: "Notification", label: "Notification", description: "When Claude needs attention", supportsMatcher: false },
];

export function HooksManager() {
  const [hooks, setHooks] = useState<HooksConfig>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  const [editingMatcher, setEditingMatcher] = useState<HookMatcher | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    loadHooks();
  }, []);

  const loadHooks = async () => {
    setLoading(true);
    try {
      const settingsJson = await invoke<string>("read_claude_settings");
      const settings = JSON.parse(settingsJson);
      if (settings.hooks) {
        setHooks(settings.hooks);
      }
    } catch (error) {
      console.error("Failed to load hooks:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveHooks = async () => {
    setSaving(true);
    try {
      const settingsJson = await invoke<string>("read_claude_settings");
      const settings = JSON.parse(settingsJson);
      settings.hooks = hooks;
      await invoke("write_claude_settings", { content: JSON.stringify(settings, null, 2) });
      toast.success("Hooks saved successfully");
    } catch (error) {
      toast.error(`Failed to save hooks: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (eventName: string, matcher?: HookMatcher) => {
    setEditingEvent(eventName);
    if (matcher) {
      setEditingMatcher(matcher);
    } else {
      setEditingMatcher({
        matcher: ".*",
        hooks: [{ type: "command", command: "", timeout: 30 }],
      });
    }
    setIsDialogOpen(true);
  };

  const closeEditDialog = () => {
    setEditingEvent(null);
    setEditingMatcher(null);
    setIsDialogOpen(false);
  };

  const saveMatcher = () => {
    if (!editingEvent || !editingMatcher) return;

    setHooks((prev) => {
      const eventHooks = prev[editingEvent as keyof HooksConfig] || [];
      const existingIndex = eventHooks.findIndex((m) => m.matcher === editingMatcher.matcher);

      let updatedEventHooks;
      if (existingIndex >= 0) {
        updatedEventHooks = [...eventHooks];
        updatedEventHooks[existingIndex] = editingMatcher;
      } else {
        updatedEventHooks = [...eventHooks, editingMatcher];
      }

      return {
        ...prev,
        [editingEvent]: updatedEventHooks,
      };
    });

    closeEditDialog();
    toast.success("Hook configuration updated");
  };

  const deleteMatcher = (eventName: string, matcher: string) => {
    setHooks((prev) => {
      const eventHooks = prev[eventName as keyof HooksConfig] || [];
      return {
        ...prev,
        [eventName]: eventHooks.filter((m) => m.matcher !== matcher),
      };
    });
    toast.success("Hook deleted");
  };

  const addHookToMatcher = () => {
    if (!editingMatcher) return;
    setEditingMatcher({
      ...editingMatcher,
      hooks: [...editingMatcher.hooks, { type: "command", command: "", timeout: 30 }],
    });
  };

  const updateHook = (index: number, updates: Partial<Hook>) => {
    if (!editingMatcher) return;
    const newHooks = [...editingMatcher.hooks];
    newHooks[index] = { ...newHooks[index], ...updates };
    setEditingMatcher({
      ...editingMatcher,
      hooks: newHooks,
    });
  };

  const removeHook = (index: number) => {
    if (!editingMatcher) return;
    setEditingMatcher({
      ...editingMatcher,
      hooks: editingMatcher.hooks.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Lifecycle Hooks</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Execute custom scripts at specific points in Claude's workflow
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadHooks} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
          <Button size="sm" onClick={saveHooks} disabled={saving}>
            <Save className="size-3 mr-2" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Security Warning */}
      <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <AlertCircle className="size-4 text-yellow-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-yellow-500">
          <strong>Security Note:</strong> Hooks execute with your user permissions. PreToolUse hooks can block or modify tool calls. Always validate hook scripts before use.
        </div>
      </div>

      {/* Hook Events */}
      <div className="space-y-4">
        {HOOK_EVENTS.map((event) => {
          const eventHooks = hooks[event.value as keyof HooksConfig] || [];
          return (
            <div key={event.value} className="border rounded-lg p-4" style={{ borderColor: "var(--ui-border)" }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Webhook className="size-4" />
                    <h4 className="font-medium text-sm">{event.label}</h4>
                    {event.supportsMatcher && (
                      <Badge variant="outline" className="text-xs">Supports Matcher</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{event.description}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditDialog(event.value)}
                >
                  <Plus className="size-3 mr-2" />
                  Add Hook
                </Button>
              </div>

              {eventHooks.length > 0 && (
                <div className="space-y-2 mt-3">
                  {eventHooks.map((matcher, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 bg-muted rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono">Matcher: {matcher.matcher}</code>
                          <Badge variant="secondary" className="text-xs">
                            {matcher.hooks.length} hook{matcher.hooks.length !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {matcher.hooks.map((h, i) => (
                            <div key={i}>
                              {h.type === "command" ? `Command: ${h.command}` : `HTTP: ${h.url}`}
                            </div>
                          ))}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(event.value, matcher)}
                      >
                        <Edit2 className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMatcher(event.value, matcher.matcher)}
                      >
                        <Trash2 className="size-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Configure Hook: {editingEvent && HOOK_EVENTS.find((e) => e.value === editingEvent)?.label}
            </DialogTitle>
          </DialogHeader>

          {editingMatcher && (
            <div className="space-y-4">
              {/* Matcher Pattern */}
              <div className="space-y-2">
                <Label htmlFor="matcher">Matcher Pattern</Label>
                <Input
                  id="matcher"
                  value={editingMatcher.matcher}
                  onChange={(e) => setEditingMatcher({ ...editingMatcher, matcher: e.target.value })}
                  placeholder=".*  (regex pattern, e.g., Bash, Write|Edit, .*)"
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Regex pattern to match tool names. Use <code>.*</code> to match all, <code>Bash</code> for specific tool, <code>Write|Edit</code> for multiple.
                </p>
              </div>

              {/* Hooks List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Hooks</Label>
                  <Button variant="outline" size="sm" onClick={addHookToMatcher}>
                    <Plus className="size-3 mr-2" />
                    Add Hook
                  </Button>
                </div>

                {editingMatcher.hooks.map((hook, index) => (
                  <div key={index} className="border rounded-lg p-3 space-y-3" style={{ borderColor: "var(--ui-border)" }}>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Hook #{index + 1}</Label>
                      <Button variant="ghost" size="icon" onClick={() => removeHook(index)}>
                        <Trash2 className="size-4 text-red-500" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`type-${index}`} className="text-xs">Type</Label>
                      <Select
                        value={hook.type}
                        onValueChange={(value: "command" | "http") => updateHook(index, { type: value })}
                      >
                        <SelectTrigger id={`type-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="command">Command</SelectItem>
                          <SelectItem value="http">HTTP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {hook.type === "command" ? (
                      <div className="space-y-2">
                        <Label htmlFor={`command-${index}`} className="text-xs">Command</Label>
                        <Textarea
                          id={`command-${index}`}
                          value={hook.command || ""}
                          onChange={(e) => updateHook(index, { command: e.target.value })}
                          placeholder="/path/to/script.sh or inline command"
                          rows={3}
                          className="font-mono text-xs"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor={`url-${index}`} className="text-xs">URL</Label>
                        <Input
                          id={`url-${index}`}
                          value={hook.url || ""}
                          onChange={(e) => updateHook(index, { url: e.target.value })}
                          placeholder="https://api.example.com/webhook"
                          className="font-mono text-xs"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor={`timeout-${index}`} className="text-xs">Timeout (seconds)</Label>
                      <Input
                        id={`timeout-${index}`}
                        type="number"
                        value={hook.timeout || 30}
                        onChange={(e) => updateHook(index, { timeout: parseInt(e.target.value) || 30 })}
                        min={1}
                        max={600}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>
              Cancel
            </Button>
            <Button onClick={saveMatcher}>
              <Save className="size-3 mr-2" />
              Save Hook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
