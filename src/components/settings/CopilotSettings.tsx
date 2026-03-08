import { useState, useEffect } from "react";
import { Check, RefreshCw, AlertCircle, Plus, Trash2, ExternalLink, Save, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { MCPServerManager } from "@/components/settings/copilot/MCPServerManager";
import { CustomInstructionsManager } from "@/components/settings/copilot/CustomInstructionsManager";
import { CustomAgentsManager } from "@/components/settings/copilot/CustomAgentsManager";
import { SkillsManager } from "@/components/settings/copilot/SkillsManager";
import CopilotIcon from "@/assets/icons/copilot.svg?react";

interface CopilotSettingsProps {
  copilotDetection: { found: boolean; path: string | null; version: string | null; authenticated: boolean | null } | null;
  detectingCopilot: boolean;
  onDetect: () => void;
  shellProfilePath: string;
  isCopilotInProfile: boolean;
  checkingProfile: boolean;
  onAddToProfile: () => Promise<void>;
}

interface CopilotConfig {
  model?: string;
  reasoning_effort?: "low" | "medium" | "high" | "xhigh";
  theme?: "auto" | "dark" | "light";
  render_markdown?: boolean;
  stream?: boolean;
  trusted_folders?: string[];
  allowed_urls?: string[];
  denied_urls?: string[];
  auto_update?: boolean;
  include_coauthor?: boolean;
  log_level?: "none" | "error" | "warning" | "info" | "debug" | "all" | "default";
  beep?: boolean;
  update_terminal_title?: boolean;
}

const DEFAULT_CONFIG: CopilotConfig = {
  reasoning_effort: "medium",
  theme: "auto",
  render_markdown: true,
  stream: true,
  trusted_folders: [],
  allowed_urls: [],
  denied_urls: [],
  auto_update: true,
  include_coauthor: true,
  log_level: "default",
  beep: true,
  update_terminal_title: true,
};

const MODEL_OPTIONS = [
  { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { value: "o1", label: "OpenAI o1" },
  { value: "o1-mini", label: "OpenAI o1-mini" },
];

const LOG_LEVEL_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "none", label: "None" },
  { value: "error", label: "Error" },
  { value: "warning", label: "Warning" },
  { value: "info", label: "Info" },
  { value: "debug", label: "Debug" },
  { value: "all", label: "All" },
];

export function CopilotSettings({
  copilotDetection,
  detectingCopilot,
  onDetect,
  shellProfilePath,
  isCopilotInProfile,
  checkingProfile,
  onAddToProfile,
}: CopilotSettingsProps) {
  const [copilotConfig, setCopilotConfig] = useState<CopilotConfig>(DEFAULT_CONFIG);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [newAllowedUrl, setNewAllowedUrl] = useState("");
  const [newDeniedUrl, setNewDeniedUrl] = useState("");

  useEffect(() => {
    // Load config immediately, don't wait for detection
    loadCopilotConfig();
  }, []);

  const loadCopilotConfig = async () => {
    setLoadingConfig(true);
    try {
      const configJson = await invoke<string>("read_copilot_config");
      const config = JSON.parse(configJson);
      setCopilotConfig({ ...DEFAULT_CONFIG, ...config });
    } catch (error) {
      console.error("Failed to load Copilot config:", error);
      setCopilotConfig(DEFAULT_CONFIG);
    } finally {
      setLoadingConfig(false);
    }
  };

  const saveCopilotConfig = async () => {
    setSavingConfig(true);
    try {
      const configJson = JSON.stringify(copilotConfig, null, 2);
      await invoke("write_copilot_config", { content: configJson });
      toast.success("Configuration saved successfully");
    } catch (error) {
      toast.error(`Failed to save configuration: ${error}`);
    } finally {
      setSavingConfig(false);
    }
  };

  const addTrustedFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Trusted Folder",
      });

      if (selected && typeof selected === "string") {
        if (copilotConfig.trusted_folders?.includes(selected)) {
          toast.error("Folder already exists");
          return;
        }
        setCopilotConfig((prev) => ({
          ...prev,
          trusted_folders: [...(prev.trusted_folders || []), selected],
        }));
        toast.success("Folder added successfully");
      }
    } catch (error) {
      console.error("Failed to select folder:", error);
      toast.error("Failed to select folder");
    }
  };

  const removeTrustedFolder = (folder: string) => {
    setCopilotConfig((prev) => ({
      ...prev,
      trusted_folders: prev.trusted_folders?.filter((f) => f !== folder) || [],
    }));
  };

  const addAllowedUrl = () => {
    if (!newAllowedUrl.trim()) {
      toast.error("URL cannot be empty");
      return;
    }
    if (copilotConfig.allowed_urls?.includes(newAllowedUrl)) {
      toast.error("URL already exists");
      return;
    }
    setCopilotConfig((prev) => ({
      ...prev,
      allowed_urls: [...(prev.allowed_urls || []), newAllowedUrl],
    }));
    setNewAllowedUrl("");
  };

  const removeAllowedUrl = (url: string) => {
    setCopilotConfig((prev) => ({
      ...prev,
      allowed_urls: prev.allowed_urls?.filter((u) => u !== url) || [],
    }));
  };

  const addDeniedUrl = () => {
    if (!newDeniedUrl.trim()) {
      toast.error("URL cannot be empty");
      return;
    }
    if (copilotConfig.denied_urls?.includes(newDeniedUrl)) {
      toast.error("URL already exists");
      return;
    }
    setCopilotConfig((prev) => ({
      ...prev,
      denied_urls: [...(prev.denied_urls || []), newDeniedUrl],
    }));
    setNewDeniedUrl("");
  };

  const removeDeniedUrl = (url: string) => {
    setCopilotConfig((prev) => ({
      ...prev,
      denied_urls: prev.denied_urls?.filter((u) => u !== url) || [],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CopilotIcon className="size-6" />
          <div>
            <h3 className="text-lg font-semibold">GitHub Copilot CLI</h3>
            <p className="text-sm text-muted-foreground">
              Configure GitHub Copilot CLI integration and settings
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadCopilotConfig}
            disabled={loadingConfig || !copilotDetection?.found}
          >
            <RefreshCw className={`size-3 mr-2 ${loadingConfig ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDetect}
            disabled={detectingCopilot}
          >
            <RefreshCw className={`size-3 mr-2 ${detectingCopilot ? 'animate-spin' : ''}`} />
            Re-detect
          </Button>
        </div>
      </div>

      {/* Installation Status */}
      <div className="space-y-4">
        <Label>Installation Status</Label>
        {copilotDetection && (
          <div
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: copilotDetection.found ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
              borderColor: copilotDetection.found ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)",
            }}
          >
            <div className="flex items-start gap-3">
              {copilotDetection.found ? (
                <Check className="size-5 text-green-500 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="size-5 text-red-500 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium" style={{ color: "var(--ui-foreground)" }}>
                  {copilotDetection.found ? "GitHub Copilot CLI is installed" : "GitHub Copilot CLI not found"}
                </p>
                {copilotDetection.found ? (
                  <>
                    {copilotDetection.path && (
                      <p className="text-xs" style={{ color: "var(--ui-muted-foreground)" }}>
                        Path: {copilotDetection.path}
                      </p>
                    )}
                    {copilotDetection.version && (
                      <p className="text-xs" style={{ color: "var(--ui-muted-foreground)" }}>
                        Version: {copilotDetection.version}
                      </p>
                    )}
                    {copilotDetection.authenticated !== null && (
                      <div className="flex items-center gap-2 mt-2">
                        {copilotDetection.authenticated ? (
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
                      Install GitHub Copilot CLI to get started
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open("https://docs.github.com/en/copilot/github-copilot-in-the-cli/installing-github-copilot-in-the-cli", "_blank")}
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
      {copilotDetection?.found && (
        <div className="space-y-4 pt-4 border-t" style={{ borderColor: "var(--ui-border)" }}>
          <div>
            <Label>Shell Integration</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Add Copilot CLI to your shell profile for easy access
            </p>
          </div>

          {checkingProfile ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--ui-muted-foreground)" }}>
              <RefreshCw className="size-4 animate-spin" />
              <span>Checking shell profile...</span>
            </div>
          ) : isCopilotInProfile ? (
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
                  Copilot CLI is available in your shell profile
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
      {copilotDetection?.found && (
        <Tabs defaultValue="general" className="pt-4 border-t" style={{ borderColor: "var(--ui-border)" }}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="mcp">MCP Servers</TabsTrigger>
            <TabsTrigger value="instructions">Instructions</TabsTrigger>
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Configuration Settings</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Manage GitHub Copilot CLI configuration
                </p>
              </div>
              <Button
                onClick={saveCopilotConfig}
                disabled={savingConfig}
                size="sm"
              >
                {savingConfig ? (
                  <>
                    <RefreshCw className="size-3 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="size-3 mr-2" />
                    Save Configuration
                  </>
                )}
              </Button>
            </div>

            {/* Model Configuration */}
            <div className="space-y-3 pt-4">
              <Label className="text-sm font-medium">Model Configuration</Label>

              <div className="space-y-2">
                <Label htmlFor="model" className="text-xs">AI Model</Label>
                <Select
                  value={copilotConfig.model || ""}
                  onValueChange={(value) => setCopilotConfig((prev) => ({ ...prev, model: value }))}
                >
                  <SelectTrigger id="model">
                    <SelectValue placeholder="Select model (uses default if not set)" />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEL_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Reasoning Effort</Label>
                <RadioGroup
                  value={copilotConfig.reasoning_effort || "medium"}
                  onValueChange={(value) => setCopilotConfig((prev) => ({ ...prev, reasoning_effort: value as any }))}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="low" id="low" />
                    <Label htmlFor="low" className="text-xs font-normal cursor-pointer">Low</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="medium" id="medium" />
                    <Label htmlFor="medium" className="text-xs font-normal cursor-pointer">Medium</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="high" id="high" />
                    <Label htmlFor="high" className="text-xs font-normal cursor-pointer">High</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="xhigh" id="xhigh" />
                    <Label htmlFor="xhigh" className="text-xs font-normal cursor-pointer">XHigh</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            {/* Security & Permissions */}
            <div className="space-y-3 pt-4 border-t" style={{ borderColor: "var(--ui-border)" }}>
              <Label className="text-sm font-medium">Security & Permissions</Label>

              {/* Trusted Folders */}
              <div className="space-y-2">
                <Label className="text-xs">Trusted Folders</Label>
                <div className="space-y-2">
                  {copilotConfig.trusted_folders?.map((folder) => (
                    <div key={folder} className="flex items-center gap-2">
                      <Input
                        value={folder}
                        disabled
                        className="flex-1 font-mono text-xs"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTrustedFolder(folder)}
                      >
                        <Trash2 className="size-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    onClick={addTrustedFolder}
                    className="w-full"
                >
                    <FolderOpen className="size-4 mr-2" />
                    Select Folder
                  </Button>
                </div>
              </div>

              {/* Allowed URLs */}
              <div className="space-y-2">
                <Label className="text-xs">Allowed URLs</Label>
                <div className="space-y-2">
                  {copilotConfig.allowed_urls?.map((url) => (
                    <div key={url} className="flex items-center gap-2">
                      <Input
                        value={url}
                        disabled
                        className="flex-1 font-mono text-xs"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAllowedUrl(url)}
                      >
                        <Trash2 className="size-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="api.example.com"
                      value={newAllowedUrl}
                      onChange={(e) => setNewAllowedUrl(e.target.value)}
                      className="flex-1 font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={addAllowedUrl}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Denied URLs */}
              <div className="space-y-2">
                <Label className="text-xs">Denied URLs</Label>
                <div className="space-y-2">
                  {copilotConfig.denied_urls?.map((url) => (
                    <div key={url} className="flex items-center gap-2">
                      <Input
                        value={url}
                        disabled
                        className="flex-1 font-mono text-xs"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDeniedUrl(url)}
                      >
                        <Trash2 className="size-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="blocked.example.com"
                      value={newDeniedUrl}
                      onChange={(e) => setNewDeniedUrl(e.target.value)}
                      className="flex-1 font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={addDeniedUrl}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* User Experience */}
            <div className="space-y-3 pt-4 border-t" style={{ borderColor: "var(--ui-border)" }}>
              <Label className="text-sm font-medium">User Experience</Label>

              <div className="space-y-2">
                <Label className="text-xs">Theme</Label>
                <RadioGroup
                  value={copilotConfig.theme || "auto"}
                  onValueChange={(value) => setCopilotConfig((prev) => ({ ...prev, theme: value as any }))}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="auto" id="theme-auto" />
                    <Label htmlFor="theme-auto" className="text-xs font-normal cursor-pointer">Auto</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dark" id="theme-dark" />
                    <Label htmlFor="theme-dark" className="text-xs font-normal cursor-pointer">Dark</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="light" id="theme-light" />
                    <Label htmlFor="theme-light" className="text-xs font-normal cursor-pointer">Light</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="render-markdown" className="text-xs">Render Markdown</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Display formatted Markdown in terminal output
                  </p>
                </div>
                <Switch
                  id="render-markdown"
                  checked={copilotConfig.render_markdown ?? true}
                  onCheckedChange={(checked) => setCopilotConfig((prev) => ({ ...prev, render_markdown: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="stream" className="text-xs">Stream Response</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Enable streaming for real-time responses
                  </p>
                </div>
                <Switch
                  id="stream"
                  checked={copilotConfig.stream ?? true}
                  onCheckedChange={(checked) => setCopilotConfig((prev) => ({ ...prev, stream: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="beep" className="text-xs">Beep on Attention</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Play sound when user attention is needed
                  </p>
                </div>
                <Switch
                  id="beep"
                  checked={copilotConfig.beep ?? true}
                  onCheckedChange={(checked) => setCopilotConfig((prev) => ({ ...prev, beep: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="update-title" className="text-xs">Update Terminal Title</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Show current task in terminal title
                  </p>
                </div>
                <Switch
                  id="update-title"
                  checked={copilotConfig.update_terminal_title ?? true}
                  onCheckedChange={(checked) => setCopilotConfig((prev) => ({ ...prev, update_terminal_title: checked }))}
                />
              </div>
            </div>

            {/* Git Integration */}
            <div className="space-y-3 pt-4 border-t" style={{ borderColor: "var(--ui-border)" }}>
              <Label className="text-sm font-medium">Git Integration</Label>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="include-coauthor" className="text-xs">Include Co-author Attribution</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Add "Co-authored-by" to git commits made by Copilot
                  </p>
                </div>
                <Switch
                  id="include-coauthor"
                  checked={copilotConfig.include_coauthor ?? true}
                  onCheckedChange={(checked) => setCopilotConfig((prev) => ({ ...prev, include_coauthor: checked }))}
                />
              </div>
            </div>

            {/* Advanced */}
            <div className="space-y-3 pt-4 border-t" style={{ borderColor: "var(--ui-border)" }}>
              <Label className="text-sm font-medium">Advanced</Label>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto-update" className="text-xs">Auto Update</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Automatically download CLI updates
                  </p>
                </div>
                <Switch
                  id="auto-update"
                  checked={copilotConfig.auto_update ?? true}
                  onCheckedChange={(checked) => setCopilotConfig((prev) => ({ ...prev, auto_update: checked }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="log-level" className="text-xs">Log Level</Label>
                <Select
                  value={copilotConfig.log_level || "default"}
                  onValueChange={(value) => setCopilotConfig((prev) => ({ ...prev, log_level: value as any }))}
                >
                  <SelectTrigger id="log-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOG_LEVEL_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="mcp">
            <MCPServerManager />
          </TabsContent>

          <TabsContent value="instructions">
            <CustomInstructionsManager />
          </TabsContent>

          <TabsContent value="agents">
            <CustomAgentsManager />
          </TabsContent>

          <TabsContent value="skills">
            <SkillsManager />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
