import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Check, X, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CLIIcon } from "@/components/ui/cli-icon";
import type { CLIType } from "@/lib/ai-block-detector";

interface CLIDetectionResult {
  name: string;
  found: boolean;
  path: string | null;
  version: string | null;
  authenticated: boolean | null;
  error: string | null;
}

interface CLISetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

type WizardStep = "detection" | "configuration" | "shell-integration" | "test";

// CLI metadata for display and installation
const CLI_METADATA: Record<string, { displayName: string; installUrl: string; docsUrl: string }> = {
  "claude": {
    displayName: "Claude Code",
    installUrl: "https://code.claude.com/docs/en/setup",
    docsUrl: "https://code.claude.com/docs/en/setup",
  },
  "codex": {
    displayName: "Codex CLI",
    installUrl: "https://github.com/openai/codex",
    docsUrl: "https://github.com/openai/codex/blob/main/codex-cli/README.md",
  },
  "gemini": {
    displayName: "Gemini CLI",
    installUrl: "https://github.com/google-gemini/gemini-cli",
    docsUrl: "https://github.com/google-gemini/gemini-cli",
  },
  "gh-copilot": {
    displayName: "GitHub Copilot CLI",
    installUrl: "https://docs.github.com/en/copilot/github-copilot-in-the-cli",
    docsUrl: "https://docs.github.com/en/copilot/github-copilot-in-the-cli",
  },
};

// Authentication guidance for each CLI
const AUTH_GUIDANCE: Record<string, { envVar?: string; credPath?: string; command?: string }> = {
  "claude": {
    credPath: "~/.claude/",
    command: "claude doctor",
  },
  "codex": {
    envVar: "OPENAI_API_KEY",
    credPath: "~/.codex/",
  },
  "gemini": {
    envVar: "GEMINI_API_KEY",
    credPath: "~/.gemini/",
  },
  "gh-copilot": {
    command: "gh auth status",
  },
};

export function CLISetupWizard({ isOpen, onClose }: CLISetupWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>("detection");
  const [clis, setClis] = useState<CLIDetectionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; output: string }>>({});
  const [shellProfilePath, setShellProfilePath] = useState<string>("");

  // Detect CLIs on mount
  useEffect(() => {
    if (isOpen) {
      detectCLIs();
      getShellProfile();
    }
  }, [isOpen]);

  const detectCLIs = async () => {
    setLoading(true);
    try {
      const detected = await invoke<CLIDetectionResult[]>("detect_ai_clis");
      setClis(detected);
    } catch (error) {
      console.error("Failed to detect CLIs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getShellProfile = async () => {
    try {
      const path = await invoke<string>("get_shell_profile_path");
      setShellProfilePath(path);
    } catch (error) {
      console.error("Failed to get shell profile:", error);
    }
  };

  const testCLI = async (binaryName: string) => {
    setLoading(true);
    try {
      const output = await invoke<string>("test_cli", { binaryName });
      setTestResults((prev) => ({
        ...prev,
        [binaryName]: { success: true, output },
      }));
    } catch (error) {
      setTestResults((prev) => ({
        ...prev,
        [binaryName]: { success: false, output: String(error) },
      }));
    } finally {
      setLoading(false);
    }
  };

  const addToShellProfile = async (line: string) => {
    try {
      await invoke("add_to_shell_profile", { line });
    } catch (error) {
      console.error("Failed to add to shell profile:", error);
    }
  };

  const renderDetectionStep = () => (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: "var(--ui-foreground)" }}>
        Scanning your system for installed AI CLI tools...
      </p>

      {loading && clis.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-6 animate-spin" style={{ color: "var(--ui-foreground)" }} />
        </div>
      ) : (
        <div className="space-y-3">
          {clis.map((cli) => {
            const metadata = CLI_METADATA[cli.name];
            return (
              <div
                key={cli.name}
                className="flex items-center justify-between p-3 rounded-lg"
                style={{
                  backgroundColor: "var(--ui-button-background)",
                  border: "1px solid var(--ui-border)",
                }}
              >
                <div className="flex items-center gap-3">
                  {/* CLI Icon */}
                  {cli.found && cli.name !== "generic" && (
                    <CLIIcon type={cli.name as CLIType} size={20} />
                  )}

                  {/* Status Icon */}
                  {cli.found ? (
                    <Check className="size-5 text-green-500" />
                  ) : (
                    <X className="size-5 text-red-500" />
                  )}

                  <div>
                    <p className="font-medium text-sm" style={{ color: "var(--ui-foreground)" }}>
                      {metadata?.displayName || cli.name}
                    </p>
                    {cli.found ? (
                      <div className="text-xs space-y-0.5" style={{ color: "var(--ui-foreground)", opacity: 0.7 }}>
                        <p>{cli.version || cli.path}</p>
                        {cli.authenticated !== null && (
                          <p className={cli.authenticated ? "text-green-500" : "text-yellow-500"}>
                            {cli.authenticated ? "✓ Authenticated" : "⚠ Not authenticated"}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-red-500">{cli.error || "Not installed"}</p>
                    )}
                  </div>
                </div>

                {!cli.found && metadata && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(metadata.installUrl, "_blank")}
                    className="gap-2"
                  >
                    Install
                    <ExternalLink className="size-3" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button onClick={() => setCurrentStep("configuration")}>
          Next: Configuration
        </Button>
      </div>
    </div>
  );

  const renderConfigurationStep = () => {
    const installedCLIs = clis.filter((cli) => cli.found);

    return (
      <div className="space-y-4">
        <p className="text-sm" style={{ color: "var(--ui-foreground)" }}>
          Configure your installed AI CLI tools. Check their documentation for setup instructions.
        </p>

        {installedCLIs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <AlertCircle className="size-8" style={{ color: "var(--ui-foreground)", opacity: 0.5 }} />
            <p className="text-sm" style={{ color: "var(--ui-foreground)", opacity: 0.7 }}>
              No AI CLI tools detected. Install them first.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {installedCLIs.map((cli) => {
              const metadata = CLI_METADATA[cli.name];
              const authGuide = AUTH_GUIDANCE[cli.name];
              return (
                <div
                  key={cli.name}
                  className="p-4 rounded-lg space-y-3"
                  style={{
                    backgroundColor: "var(--ui-button-background)",
                    border: "1px solid var(--ui-border)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {cli.name !== "generic" && (
                        <CLIIcon type={cli.name as CLIType} size={18} />
                      )}
                      <h3 className="font-medium" style={{ color: "var(--ui-foreground)" }}>
                        {metadata?.displayName || cli.name}
                      </h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(metadata?.docsUrl, "_blank")}
                      className="gap-2"
                    >
                      Open Docs
                      <ExternalLink className="size-3" />
                    </Button>
                  </div>

                  <div className="text-xs space-y-1" style={{ color: "var(--ui-foreground)", opacity: 0.7 }}>
                    <p>Binary: {cli.name}</p>
                    <p>Path: {cli.path}</p>
                    {cli.version && <p>Version: {cli.version}</p>}
                  </div>

                  {/* Authentication status */}
                  <div className="pt-2 border-t" style={{ borderColor: "var(--ui-border)" }}>
                    <p className="text-xs font-medium mb-2" style={{ color: "var(--ui-foreground)" }}>
                      Authentication:
                    </p>
                    {cli.authenticated === true ? (
                      <p className="text-xs text-green-500">✓ Authenticated</p>
                    ) : cli.authenticated === false ? (
                      <div className="space-y-2">
                        <p className="text-xs text-yellow-500">⚠ Not authenticated</p>
                        <div className="text-xs space-y-1" style={{ color: "var(--ui-foreground)", opacity: 0.7 }}>
                          {authGuide?.envVar && <p>• Set {authGuide.envVar} environment variable</p>}
                          {authGuide?.credPath && <p>• Or configure credentials in {authGuide.credPath}</p>}
                          {authGuide?.command && <p>• Run: {authGuide.command}</p>}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs" style={{ color: "var(--ui-foreground)", opacity: 0.5 }}>
                        Status unknown
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={() => setCurrentStep("detection")}>
            Back
          </Button>
          <Button onClick={() => setCurrentStep("shell-integration")}>
            Next: Shell Integration
          </Button>
        </div>
      </div>
    );
  };

  const renderShellIntegrationStep = () => (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: "var(--ui-foreground)" }}>
        Add shell aliases or PATH modifications to your shell profile for easier access.
      </p>

      <div
        className="p-4 rounded-lg space-y-3"
        style={{
          backgroundColor: "var(--ui-button-background)",
          border: "1px solid var(--ui-border)",
        }}
      >
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--ui-foreground)" }}>
            Shell Profile
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--ui-foreground)", opacity: 0.7 }}>
            {shellProfilePath || "Detecting..."}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium" style={{ color: "var(--ui-foreground)" }}>
            Suggested Aliases:
          </p>
          <div className="space-y-2">
            {clis
              .filter((cli) => cli.found && cli.path)
              .map((cli) => {
                const alias = `alias ${cli.name}="${cli.path}"`;
                return (
                  <div
                    key={cli.name}
                    className="flex items-center justify-between p-2 rounded"
                    style={{ backgroundColor: "var(--ui-input-background)" }}
                  >
                    <code className="text-xs" style={{ color: "var(--ui-foreground)" }}>
                      {alias}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => addToShellProfile(alias)}
                    >
                      Add
                    </Button>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={() => setCurrentStep("configuration")}>
          Back
        </Button>
        <Button onClick={() => setCurrentStep("test")}>
          Next: Test
        </Button>
      </div>
    </div>
  );

  const renderTestStep = () => {
    const installedCLIs = clis.filter((cli) => cli.found);

    return (
      <div className="space-y-4">
        <p className="text-sm" style={{ color: "var(--ui-foreground)" }}>
          Test your AI CLI tools to verify they're working correctly.
        </p>

        {installedCLIs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <AlertCircle className="size-8" style={{ color: "var(--ui-foreground)", opacity: 0.5 }} />
            <p className="text-sm" style={{ color: "var(--ui-foreground)", opacity: 0.7 }}>
              No AI CLI tools to test.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {installedCLIs.map((cli) => {
              const metadata = CLI_METADATA[cli.name];
              const result = testResults[cli.name];
              return (
                <div
                  key={cli.name}
                  className="p-4 rounded-lg space-y-3"
                  style={{
                    backgroundColor: "var(--ui-button-background)",
                    border: "1px solid var(--ui-border)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium" style={{ color: "var(--ui-foreground)" }}>
                      {metadata?.displayName || cli.name}
                    </h3>
                    <Button
                      size="sm"
                      onClick={() => testCLI(cli.name)}
                      disabled={loading}
                    >
                      {loading ? <Loader2 className="size-4 animate-spin" /> : "Test"}
                    </Button>
                  </div>

                  {result && (
                    <div
                      className="p-3 rounded text-xs font-mono"
                      style={{
                        backgroundColor: result.success
                          ? "rgba(34, 197, 94, 0.1)"
                          : "rgba(239, 68, 68, 0.1)",
                        color: result.success ? "#22c55e" : "#ef4444",
                      }}
                    >
                      {result.output}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={() => setCurrentStep("shell-integration")}>
            Back
          </Button>
          <Button onClick={onClose}>
            Finish
          </Button>
        </div>
      </div>
    );
  };


  const steps: Record<WizardStep, { title: string; description: string; render: () => React.ReactElement }> = {
    detection: {
      title: "Detection",
      description: "Scan for installed AI CLI tools",
      render: renderDetectionStep,
    },
    configuration: {
      title: "Configuration",
      description: "Configure detected tools",
      render: renderConfigurationStep,
    },
    "shell-integration": {
      title: "Shell Integration",
      description: "Add aliases to your shell profile",
      render: renderShellIntegrationStep,
    },
    test: {
      title: "Test",
      description: "Verify CLI tools are working",
      render: renderTestStep,
    },
  };

  const currentStepData = steps[currentStep];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-2xl max-h-[80vh] overflow-y-auto"
        style={{
          backgroundColor: "var(--ui-background)",
          border: "1px solid var(--ui-border)",
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: "var(--ui-foreground)" }}>
            AI CLI Setup Wizard
          </DialogTitle>
          <DialogDescription style={{ color: "var(--ui-foreground)", opacity: 0.7 }}>
            {currentStepData.description}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 pb-4">
          {Object.keys(steps).map((step, index) => (
            <div key={step} className="flex items-center gap-2 flex-1">
              <div
                className="flex items-center justify-center size-8 rounded-full text-xs font-medium"
                style={{
                  backgroundColor:
                    step === currentStep
                      ? "var(--ui-border-active)"
                      : "var(--ui-button-background)",
                  color: "var(--ui-foreground)",
                }}
              >
                {index + 1}
              </div>
              {index < Object.keys(steps).length - 1 && (
                <div
                  className="flex-1 h-0.5"
                  style={{ backgroundColor: "var(--ui-border)" }}
                />
              )}
            </div>
          ))}
        </div>

        {currentStepData.render()}
      </DialogContent>
    </Dialog>
  );
}
