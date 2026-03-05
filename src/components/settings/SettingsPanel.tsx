import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { useConfigStore } from "@/stores/config-store";
import { invoke } from "@tauri-apps/api/core";
import { BUILTIN_THEMES, loadBuiltinTheme, type Theme } from "@/lib/theme-engine";
import { listSystemFonts } from "@/lib/font-manager";
import { CLISetupWizard } from "@/components/ai/CLISetupWizard";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsSection = "appearance" | "terminal" | "ai" | "git" | "keybindings";

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("appearance");
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [previewTheme, setPreviewTheme] = useState<Theme | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const { config, updateConfig } = useConfigStore();

  // Load system fonts on mount
  useEffect(() => {
    listSystemFonts().then(setSystemFonts).catch(console.error);
  }, []);

  // Load preview theme when theme changes
  useEffect(() => {
    loadBuiltinTheme(config.appearance.theme)
      .then(setPreviewTheme)
      .catch(console.error);
  }, [config.appearance.theme]);

  if (!isOpen) return null;

  const handleConfigChange = async (updates: Parameters<typeof updateConfig>[0]) => {
    updateConfig(updates);
    try {
      await invoke("update_config", { config: { ...config, ...updates } });
    } catch (error) {
      console.error("Failed to save config:", error);
    }
  };

  const sections: { id: SettingsSection; label: string }[] = [
    { id: "appearance", label: "Appearance" },
    { id: "terminal", label: "Terminal" },
    { id: "ai", label: "AI" },
    { id: "git", label: "Git" },
    { id: "keybindings", label: "Keybindings" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 backdrop-blur-sm"
      style={{
        backgroundColor: "var(--ui-background)",
        color: "var(--ui-foreground)",
      }}
    >
      <div className="flex h-full">
        {/* Left sidebar navigation */}
        <div
          className="w-48 border-r p-4"
          style={{
            borderColor: "var(--ui-border)",
          }}
        >
          <div className="mb-6">
            <h2 className="text-lg font-semibold">Settings</h2>
          </div>
          <nav className="space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className="w-full text-left px-3 py-2 rounded-md text-sm transition-colors"
                style={{
                  backgroundColor: activeSection === section.id ? "var(--ui-button-background)" : "transparent",
                  color: activeSection === section.id ? "var(--ui-foreground)" : "var(--ui-tab-foreground)",
                  fontWeight: activeSection === section.id ? 500 : 400,
                }}
                onMouseEnter={(e) => {
                  if (activeSection !== section.id) {
                    e.currentTarget.style.backgroundColor = "var(--ui-tab-background-active)";
                    e.currentTarget.style.color = "var(--ui-foreground)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSection !== section.id) {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "var(--ui-tab-foreground)";
                  }
                }}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Main content area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto p-8">
            {/* Close button */}
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-2xl font-bold capitalize">{activeSection}</h1>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>

    {/* Appearance Section */}
            {activeSection === "appearance" && (
              <div className="space-y-6">
                {/* Theme with Preview */}
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select
                    value={config.appearance.theme}
                    onValueChange={(value) =>
                      handleConfigChange({ appearance: { ...config.appearance, theme: value } })
                    }
                  >
                    <SelectTrigger id="theme">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BUILTIN_THEMES.map((theme) => (
                        <SelectItem key={theme} value={theme}>
                          {theme.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Theme Preview */}
                  {previewTheme && (
                    <div className="mt-3 p-4 rounded-md border border-border/40" style={{ backgroundColor: previewTheme.terminal.background }}>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: previewTheme.terminal.red }} />
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: previewTheme.terminal.yellow }} />
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: previewTheme.terminal.green }} />
                        </div>
                        <div className="font-mono text-xs space-y-1" style={{ color: previewTheme.terminal.foreground }}>
                          <div>
                            <span style={{ color: previewTheme.terminal.green }}>user@host</span>
                            <span style={{ color: previewTheme.terminal.foreground }}>:</span>
                            <span style={{ color: previewTheme.terminal.blue }}>~/project</span>
                            <span style={{ color: previewTheme.terminal.foreground }}> $ </span>
                          </div>
                          <div>
                            <span style={{ color: previewTheme.terminal.cyan }}>echo</span>
                            <span style={{ color: previewTheme.terminal.foreground }}> </span>
                            <span style={{ color: previewTheme.terminal.yellow }}>"Hello World"</span>
                          </div>
                          <div style={{ color: previewTheme.terminal.foreground }}>Hello World</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Font Family */}
                <div className="space-y-2">
                  <Label htmlFor="fontFamily">Font Family</Label>
                  <Select
                    value={config.appearance.fontFamily}
                    onValueChange={(value) =>
                      handleConfigChange({ appearance: { ...config.appearance, fontFamily: value } })
                    }
                  >
                    <SelectTrigger id="fontFamily">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {systemFonts.length > 0 ? (
                        systemFonts.map((font) => (
                          <SelectItem key={font} value={font}>
                            {font}
                          </SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="JetBrains Mono">JetBrains Mono</SelectItem>
                          <SelectItem value="Fira Code">Fira Code</SelectItem>
                          <SelectItem value="Cascadia Code">Cascadia Code</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Font Size */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="fontSize">Font Size</Label>
                    <span className="text-sm text-muted-foreground">{config.appearance.fontSize}px</span>
                  </div>
                  <Slider
                    id="fontSize"
                    min={8}
                    max={32}
                    step={1}
                    value={[config.appearance.fontSize]}
                    onValueChange={([value]) =>
                      handleConfigChange({ appearance: { ...config.appearance, fontSize: value ?? 14 } })
                    }
                  />
                </div>

                {/* Line Height */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="lineHeight">Line Height</Label>
                    <span className="text-sm text-muted-foreground">{config.appearance.lineHeight.toFixed(1)}</span>
                  </div>
                  <Slider
                    id="lineHeight"
                    min={1.0}
                    max={2.0}
                    step={0.1}
                    value={[config.appearance.lineHeight]}
                    onValueChange={([value]) =>
                      handleConfigChange({ appearance: { ...config.appearance, lineHeight: value ?? 1.0 } })
                    }
                  />
                </div>

                {/* Ligatures */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="ligatures">Font Ligatures</Label>
                  <Switch
                    id="ligatures"
                    checked={config.appearance.ligatures}
                    onCheckedChange={(checked) =>
                      handleConfigChange({ appearance: { ...config.appearance, ligatures: checked } })
                    }
                  />
                </div>

                {/* Opacity */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="opacity">Opacity</Label>
                    <span className="text-sm text-muted-foreground">{Math.round(config.appearance.opacity * 100)}%</span>
                  </div>
                  <Slider
                    id="opacity"
                    min={0.5}
                    max={1.0}
                    step={0.05}
                    value={[config.appearance.opacity]}
                    onValueChange={([value]) =>
                      handleConfigChange({ appearance: { ...config.appearance, opacity: value ?? 1.0 } })
                    }
                  />
                </div>

                {/* Vibrancy */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="vibrancy">Window Vibrancy (macOS)</Label>
                  <Switch
                    id="vibrancy"
                    checked={config.appearance.vibrancy}
                    onCheckedChange={(checked) =>
                      handleConfigChange({ appearance: { ...config.appearance, vibrancy: checked } })
                    }
                  />
                </div>

                {/* Cursor Style with Preview */}
                <div className="space-y-2">
                  <Label>Cursor Style</Label>
                  <RadioGroup
                    value={config.appearance.cursorStyle}
                    onValueChange={(value: "block" | "underline" | "bar") =>
                      handleConfigChange({ appearance: { ...config.appearance, cursorStyle: value } })
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="block" id="cursor-block" />
                      <Label htmlFor="cursor-block" className="font-normal flex items-center gap-2">
                        Block
                        <span className="inline-block w-2 h-4" style={{ backgroundColor: "var(--ui-foreground)" }}></span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="underline" id="cursor-underline" />
                      <Label htmlFor="cursor-underline" className="font-normal flex items-center gap-2">
                        Underline
                        <span className="inline-block w-2 h-4" style={{ borderBottom: "2px solid var(--ui-foreground)" }}></span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="bar" id="cursor-bar" />
                      <Label htmlFor="cursor-bar" className="font-normal flex items-center gap-2">
                        Bar
                        <span className="inline-block w-0.5 h-4" style={{ backgroundColor: "var(--ui-foreground)" }}></span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            )}

            {/* Terminal Section */}
            {activeSection === "terminal" && (
              <div className="space-y-6">
                {/* Shell Path */}
                <div className="space-y-2">
                  <Label htmlFor="shell">Shell Path</Label>
                  <Input
                    id="shell"
                    value={config.terminal.shell}
                    onChange={(e) =>
                      handleConfigChange({ terminal: { ...config.terminal, shell: e.target.value } })
                    }
                    placeholder="/bin/zsh"
                  />
                  <p className="text-xs text-muted-foreground">Leave empty to use system default</p>
                </div>

                {/* Scrollback Lines */}
                <div className="space-y-2">
                  <Label htmlFor="scrollbackLines">Scrollback Lines</Label>
                  <Input
                    id="scrollbackLines"
                    type="number"
                    value={config.terminal.scrollbackLines}
                    onChange={(e) =>
                      handleConfigChange({ terminal: { ...config.terminal, scrollbackLines: parseInt(e.target.value) || 10000 } })
                    }
                  />
                </div>

                {/* Copy on Select */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="copyOnSelect">Copy on Select</Label>
                  <Switch
                    id="copyOnSelect"
                    checked={config.terminal.copyOnSelect}
                    onCheckedChange={(checked) =>
                      handleConfigChange({ terminal: { ...config.terminal, copyOnSelect: checked } })
                    }
                  />
                </div>

                {/* Bell Mode */}
                <div className="space-y-2">
                  <Label>Bell Mode</Label>
                  <RadioGroup
                    value={config.terminal.bellMode}
                    onValueChange={(value: "none" | "sound" | "visual") =>
                      handleConfigChange({ terminal: { ...config.terminal, bellMode: value } })
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="none" id="bell-none" />
                      <Label htmlFor="bell-none" className="font-normal">None</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="sound" id="bell-sound" />
                      <Label htmlFor="bell-sound" className="font-normal">Sound</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="visual" id="bell-visual" />
                      <Label htmlFor="bell-visual" className="font-normal">Visual</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Environment Variables */}
                <div className="space-y-2">
                  <Label>Environment Variables</Label>
                  <div className="text-sm text-muted-foreground">
                    Environment variable editor coming soon
                  </div>
                </div>
              </div>
            )}

            {/* AI Section */}
            {activeSection === "ai" && (
              <div className="space-y-6">
                {/* Detect CLI */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="detectCLI">Detect AI CLI Tools</Label>
                    <p className="text-xs text-muted-foreground">Automatically detect Claude Code, Codex, etc.</p>
                  </div>
                  <Switch
                    id="detectCLI"
                    checked={config.ai.detectCLI}
                    onCheckedChange={(checked) =>
                      handleConfigChange({ ai: { ...config.ai, detectCLI: checked } })
                    }
                  />
                </div>

                {/* Block Mode */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="blockMode">AI Block Mode</Label>
                    <p className="text-xs text-muted-foreground">Highlight and collapse AI output blocks</p>
                  </div>
                  <Switch
                    id="blockMode"
                    checked={config.ai.blockMode}
                    onCheckedChange={(checked) =>
                      handleConfigChange({ ai: { ...config.ai, blockMode: checked } })
                    }
                  />
                </div>

                {/* Streaming Throttle */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="streamingThrottle">Streaming Throttle</Label>
                    <span className="text-sm text-muted-foreground">{config.ai.streamingThrottle}ms</span>
                  </div>
                  <Slider
                    id="streamingThrottle"
                    min={8}
                    max={100}
                    step={8}
                    value={[config.ai.streamingThrottle]}
                    onValueChange={([value]) =>
                      handleConfigChange({ ai: { ...config.ai, streamingThrottle: value ?? 16 } })
                    }
                  />
                  <p className="text-xs text-muted-foreground">Lower = faster updates, higher CPU usage</p>
                </div>

                {/* CLI Setup Wizard Button */}
                <div className="pt-4 border-t" style={{ borderColor: "var(--ui-border)" }}>
                  <Button
                    onClick={() => setWizardOpen(true)}
                    className="w-full"
                  >
                    Configure AI CLI Tools
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Set up Claude Code, GitHub Copilot, and other AI CLI tools
                  </p>
                </div>
              </div>
            )}

            {/* Git Section */}
            {activeSection === "git" && (
              <div className="space-y-6">
                {/* Enabled */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="gitEnabled">Enable Git Integration</Label>
                  <Switch
                    id="gitEnabled"
                    checked={config.git.enabled}
                    onCheckedChange={(checked) =>
                      handleConfigChange({ git: { ...config.git, enabled: checked } })
                    }
                  />
                </div>

                {/* Auto Fetch Interval */}
                <div className="space-y-2">
                  <Label htmlFor="autoFetchInterval">Auto Fetch Interval (seconds)</Label>
                  <Input
                    id="autoFetchInterval"
                    type="number"
                    value={config.git.autoFetchInterval}
                    onChange={(e) =>
                      handleConfigChange({ git: { ...config.git, autoFetchInterval: parseInt(e.target.value) || 300 } })
                    }
                  />
                </div>

                {/* Show Diff */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="showDiff">Show Diff in Sidebar</Label>
                  <Switch
                    id="showDiff"
                    checked={config.git.showDiff}
                    onCheckedChange={(checked) =>
                      handleConfigChange({ git: { ...config.git, showDiff: checked } })
                    }
                  />
                </div>
              </div>
            )}

            {/* Keybindings Section */}
            {activeSection === "keybindings" && (
              <div className="space-y-6">
                <p className="text-sm" style={{ opacity: 0.7 }}>
                  Keybinding customization coming soon
                </p>
                <div className="space-y-3">
                  {Object.entries(config.keybindings).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between py-2 border-b"
                      style={{ borderColor: "var(--ui-border)" }}
                    >
                      <span className="text-sm capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                      <code
                        className="text-sm px-2 py-1 rounded"
                        style={{
                          backgroundColor: "var(--ui-button-background)",
                          color: "var(--ui-foreground)",
                        }}
                      >
                        {value}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CLI Setup Wizard */}
      <CLISetupWizard isOpen={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}
