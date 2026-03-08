import { useState, useEffect } from "react";
import { Key, Plus, Trash2, Save, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

interface EnvConfig {
  [key: string]: string;
}

export function EnvironmentManager() {
  const [envVars, setEnvVars] = useState<EnvConfig>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  useEffect(() => {
    loadEnvVars();
  }, []);

  const loadEnvVars = async () => {
    setLoading(true);
    try {
      const settingsJson = await invoke<string>("read_claude_settings");
      const settings = JSON.parse(settingsJson);
      if (settings.env) {
        setEnvVars(settings.env);
      }
    } catch (error) {
      console.error("Failed to load environment variables:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveEnvVars = async () => {
    setSaving(true);
    try {
      const settingsJson = await invoke<string>("read_claude_settings");
      const settings = JSON.parse(settingsJson);
      settings.env = envVars;
      await invoke("write_claude_settings", { content: JSON.stringify(settings, null, 2) });
      toast.success("Environment variables saved successfully");
    } catch (error) {
      toast.error(`Failed to save environment variables: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  const addEnvVar = () => {
    if (!newKey.trim()) {
      toast.error("Variable name cannot be empty");
      return;
    }
    if (envVars[newKey]) {
      toast.error("Variable already exists");
      return;
    }
    setEnvVars((prev) => ({ ...prev, [newKey]: newValue }));
    setNewKey("");
    setNewValue("");
    toast.success("Variable added");
  };

  const updateEnvVar = (key: string, value: string) => {
    setEnvVars((prev) => ({ ...prev, [key]: value }));
  };

  const removeEnvVar = (key: string) => {
    setEnvVars((prev) => {
      const newVars = { ...prev };
      delete newVars[key];
      return newVars;
    });
    toast.success("Variable removed");
  };

  const toggleVisibility = (key: string) => {
    setVisibleKeys((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const maskValue = (value: string) => {
    return "•".repeat(Math.min(value.length, 20));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Environment Variables</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Custom environment variables available to Claude Code and spawned processes
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadEnvVars} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
          <Button size="sm" onClick={saveEnvVars} disabled={saving}>
            <Save className="size-3 mr-2" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Existing Variables */}
      <div className="space-y-2">
        {Object.entries(envVars).length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg" style={{ borderColor: "var(--ui-border)" }}>
            No environment variables configured
          </div>
        ) : (
          Object.entries(envVars).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2 p-3 border rounded-lg" style={{ borderColor: "var(--ui-border)" }}>
              <Key className="size-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 grid grid-cols-2 gap-2">
                <code className="text-xs font-mono font-medium">{key}</code>
                <Input
                  type={visibleKeys.has(key) ? "text" : "password"}
                  value={value}
                  onChange={(e) => updateEnvVar(key, e.target.value)}
                  className="font-mono text-xs h-8"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => toggleVisibility(key)}
              >
                {visibleKeys.has(key) ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeEnvVar(key)}
              >
                <Trash2 className="size-4 text-red-500" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Add New Variable */}
      <div className="space-y-2 pt-4 border-t" style={{ borderColor: "var(--ui-border)" }}>
        <Label className="text-sm font-medium">Add New Variable</Label>
        <div className="flex gap-2">
          <Input
            placeholder="VARIABLE_NAME"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="flex-1 font-mono text-xs"
          />
          <Input
            placeholder="value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="flex-1 font-mono text-xs"
          />
          <Button variant="outline" size="icon" onClick={addEnvVar}>
            <Plus className="size-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Common variables: ANTHROPIC_API_KEY, OPENAI_API_KEY, GITHUB_TOKEN, etc.
        </p>
      </div>
    </div>
  );
}
