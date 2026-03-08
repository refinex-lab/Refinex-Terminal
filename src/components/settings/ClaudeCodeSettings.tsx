import { useState, useEffect } from "react";
import { Check, RefreshCw, AlertCircle, Plus, Trash2, ExternalLink, Save, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { PermissionsManager } from "./claude/PermissionsManager";
import { HooksManager } from "./claude/HooksManager";
import { ClaudeInstructionsManager } from "./claude/ClaudeInstructionsManager";
import { EnvironmentManager } from "./claude/EnvironmentManager";
import { SandboxManager } from "./claude/SandboxManager";
import { AgentsManager } from "./claude/AgentsManager";
import { SkillsManager } from "./claude/SkillsManager";
import { CommandsManager } from "./claude/CommandsManager";

interface ClaudeCodeSettingsProps {
  claudeDetection: { found: boolean; path: string | null; version: string | null; authenticated: boolean | null } | null;
  detectingClaude: boolean;
  onDetect: () => void;
  shellProfilePath: string;
  isClaudeInProfile: boolean;
  checkingProfile: boolean;
  onAddToProfile: () => Promise<void>;
}

interface ClaudeSettings {
  env: Record<string, string>;
  skipDangerousModePermissionPrompt?: boolean;
  statusLine?: any;
  enabledPlugins?: Record<string, boolean>;
}

export function ClaudeCodeSettings({
  claudeDetection,
  detectingClaude,
  onDetect,
  shellProfilePath,
  isClaudeInProfile,
  checkingProfile,
  onAddToProfile,
}: ClaudeCodeSettingsProps) {
  const [claudeSettings, setClaudeSettings] = useState<ClaudeSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvValue, setNewEnvValue] = useState("");

  useEffect(() => {
    if (claudeDetection?.found) {
      loadClaudeSettings();
    }
  }, [claudeDetection?.found]);

  const loadClaudeSettings = async () => {
    setLoadingSettings(true);
    try {
      const settingsJson = await invoke<string>("read_claude_settings");
      const settings = JSON.parse(settingsJson);
      setClaudeSettings(settings);
    } catch (error) {
      console.error("Failed to load Claude settings:", error);
      setClaudeSettings({
        env: {},
        skipDangerousModePermissionPrompt: false,
      });
    } finally {
      setLoadingSettings(false);
    }
  };

  const saveClaudeSettings = async () => {
    if (!claudeSettings) return;

    setSavingSettings(true);
    try {
      const settingsJson = JSON.stringify(claudeSettings, null, 2);
      await invoke("write_claude_settings", { content: settingsJson });
      toast.success("Settings saved successfully");
    } catch (error) {
      toast.error(`Failed to save settings: ${error}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const updateEnvVar = (key: string, value: string) => {
    setClaudeSettings((prev) => prev ? {
      ...prev,
      env: { ...prev.env, [key]: value },
    } : null);
  };

  const deleteEnvVar = (key: string) => {
    setClaudeSettings((prev) => {
      if (!prev) return null;
      const newEnv = { ...prev.env };
      delete newEnv[key];
      return { ...prev, env: newEnv };
    });
  };

  const addEnvVar = () => {
    if (!newEnvKey.trim()) {
      toast.error("Environment variable name cannot be empty");
      return;
    }
    if (claudeSettings?.env[newEnvKey]) {
      toast.error("Environment variable already exists");
      return;
    }
    updateEnvVar(newEnvKey, newEnvValue);
    setNewEnvKey("");
    setNewEnvValue("");
  };

  const toggleDangerousMode = (checked: boolean) => {
    setClaudeSettings((prev) => prev ? {
      ...prev,
      skipDangerousModePermissionPrompt: checked,
    } : null);
  };

  // Key environment variables
  const keyEnvVars = [
    { key: "ANTHROPIC_BASE_URL", label: "API Base URL", placeholder: "https://api.anthropic.com" },
    { key: "ANTHROPIC_AUTH_TOKEN", label: "Auth Token", placeholder: "sk-...", type: "password" },
    { key: "ANTHROPIC_DEFAULT_HAIKU_MODEL", label: "Default Haiku Model", placeholder: "claude-haiku-4-5-20251001" },
    { key: "ANTHROPIC_DEFAULT_SONNET_MODEL", label: "Default Sonnet Model", placeholder: "claude-sonnet-4-5-20250929" },
    { key: "ANTHROPIC_DEFAULT_OPUS_MODEL", label: "Default Opus Model", placeholder: "claude-opus-4-6" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="size-6" />
          <div>
            <h3 className="text-lg font-semibold">Claude Code</h3>
            <p className="text-sm text-muted-foreground">
              Configure Claude Code CLI integration and settings
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadClaudeSettings}
            disabled={loadingSettings || !claudeDetection?.found}
          >
            <RefreshCw className={`size-3 mr-2 ${loadingSettings ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDetect}
            disabled={detectingClaude}
          >
            <RefreshCw className={`size-3 mr-2 ${detectingClaude ? 'animate-spin' : ''}`} />
            Re-detect
          </Button>
        </div>
      </div>

      {/* Installation Status */}
      <div className="space-y-4">
        <Label>Installation Status</Label>
        {claudeDetection && (
          <div
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: claudeDetection.found ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
              borderColor: claudeDetection.found ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)",
            }}
          >
            <div className="flex items-start gap-3">
              {claudeDetection.found ? (
                <Check className="size-5 text-green-500 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="size-5 text-red-500 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium" style={{ color: "var(--ui-foreground)" }}>
                  {claudeDetection.found ? "Claude Code is installed" : "Claude Code not found"}
                </p>
                {claudeDetection.found ? (
                  <>
                    {claudeDetection.path && (
                      <p className="text-xs" style={{ color: "var(--ui-muted-foreground)" }}>
                        Path: {claudeDetection.path}
                      </p>
                    )}
                    {claudeDetection.version && (
                      <p className="text-xs" style={{ color: "var(--ui-muted-foreground)" }}>
                        Version: {claudeDetection.version}
                      </p>
                    )}
                    {claudeDetection.authenticated !== null && (
                      <div className="flex items-center gap-2 mt-2">
                        {claudeDetection.authenticated ? (
                          <>
                            <Check className="size-4 text-green-500" />
                            <span className="text-xs text-green-500">Authenticated</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="size-4 text-yellow-500" />
                            <span className="text-xs text-yellow-500">Not authenticated</span>
                          </>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs" style={{ color: "var(--ui-muted-foreground)" }}>
                      Install Claude Code to get started
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open("https://code.claude.com/docs/en/quickstart", "_blank")}
                      >
                        <ExternalLink className="size-3 mr-2" />
                        Installation Guide
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Shell Integration */}
      {claudeDetection?.found && (
        <div className="space-y-4 pt-4 border-t" style={{ borderColor: "var(--ui-border)" }}>
          <div>
            <Label>Shell Integration</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Add Claude Code to your shell profile for easy access
            </p>
          </div>

          {checkingProfile ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--ui-muted-foreground)" }}>
              <RefreshCw className="size-4 animate-spin" />
              <span>Checking shell profile...</span>
            </div>
          ) : isClaudeInProfile ? (
            <div
              className="p-3 rounded-lg border flex items-start gap-3"
              style={{
                backgroundColor: "rgba(34, 197, 94, 0.1)",
                borderColor: "rgba(34, 197, 94, 0.3)",
              }}
            >
              <Check className="size-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-500">
                  Already configured
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--ui-muted-foreground)" }}>
                  Claude Code is available in your shell profile
                </p>
                {shellProfilePath && (
                  <p className="text-xs mt-1" style={{ color: "var(--ui-muted-foreground)" }}>
                    Location: {shellProfilePath}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={onAddToProfile}>
              Add to Shell Profile
            </Button>
          )}
        </div>
      )}

      {/* Configuration Settings */}
      {claudeDetection?.found && claudeSettings && (
        <div className="pt-4 border-t" style={{ borderColor: "var(--ui-border)" }}>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-9">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="permissions">Permissions</TabsTrigger>
              <TabsTrigger value="hooks">Hooks</TabsTrigger>
              <TabsTrigger value="instructions">Instructions</TabsTrigger>
              <TabsTrigger value="environment">Environment</TabsTrigger>
              <TabsTrigger value="sandbox">Sandbox</TabsTrigger>
              <TabsTrigger value="agents">Agents</TabsTrigger>
              <TabsTrigger value="skills">Skills</TabsTrigger>
              <TabsTrigger value="commands">Commands</TabsTrigger>
            </TabsList>

            {/* General Settings */}
            <TabsContent value="general" className="space-y-4 mt-6">
              <div className="flex items-center justify-between">
                <Label>Basic Configuration</Label>
                <Button
                  onClick={saveClaudeSettings}
                  disabled={savingSettings}
                  size="sm"
                >
                  {savingSettings ? (
                    <>
                      <RefreshCw className="size-3 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="size-3 mr-2" />
                      Save Settings
                    </>
                  )}
                </Button>
              </div>

              {/* Key Environment Variables */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">API Configuration</Label>
                {keyEnvVars.map(({ key, label, placeholder, type }) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={key} className="text-xs">{label}</Label>
                    <Input
                      id={key}
                      type={type || "text"}
                      value={claudeSettings.env[key] || ""}
                      onChange={(e) => updateEnvVar(key, e.target.value)}
                      placeholder={placeholder}
                      className="font-mono text-xs"
                    />
                  </div>
                ))}
              </div>

              {/* Dangerous Mode */}
              <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: "var(--ui-border)" }}>
                <div>
                  <Label htmlFor="dangerousMode">Skip Dangerous Mode Permission Prompt</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enable full permissions without prompts (use with caution)
                  </p>
                </div>
                <Switch
                  id="dangerousMode"
                  checked={claudeSettings.skipDangerousModePermissionPrompt || false}
                  onCheckedChange={toggleDangerousMode}
                />
              </div>
            </TabsContent>

            {/* Permissions */}
            <TabsContent value="permissions" className="mt-6">
              <PermissionsManager />
            </TabsContent>

            {/* Hooks */}
            <TabsContent value="hooks" className="mt-6">
              <HooksManager />
            </TabsContent>

            {/* Instructions */}
            <TabsContent value="instructions" className="mt-6">
              <ClaudeInstructionsManager />
            </TabsContent>

            {/* Environment */}
            <TabsContent value="environment" className="mt-6">
              <EnvironmentManager />
            </TabsContent>

            {/* Sandbox */}
            <TabsContent value="sandbox" className="mt-6">
              <SandboxManager />
            </TabsContent>

            {/* Agents */}
            <TabsContent value="agents" className="mt-6">
              <AgentsManager />
            </TabsContent>

            {/* Skills */}
            <TabsContent value="skills" className="mt-6">
              <SkillsManager />
            </TabsContent>

            {/* Commands */}
            <TabsContent value="commands" className="mt-6">
              <CommandsManager />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
