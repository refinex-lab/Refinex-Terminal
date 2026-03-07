import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Check, X, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { useSshStore } from "@/stores/ssh-store";
import type { SSHHostConfig } from "@/lib/tauri-ssh";
import { testSSHConnection } from "@/lib/tauri-ssh";

interface HostFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingHost: SSHHostConfig | null;
}

export function HostFormDialog({
  open,
  onOpenChange,
  editingHost,
}: HostFormDialogProps) {
  const { addHost, updateHost, hosts } = useSshStore();

  const [formData, setFormData] = useState<Partial<SSHHostConfig>>(() =>
    editingHost
      ? { ...editingHost }
      : {
          id: crypto.randomUUID(),
          label: "",
          hostname: "",
          port: 22,
          username: "",
          authMethod: "password",
          useSSHAgent: false,
        }
  );

  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [testError, setTestError] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Get unique groups from existing hosts
  const existingGroups = Array.from(
    new Set(hosts.map((h) => h.group).filter(Boolean))
  );

  const handleSubmit = () => {
    if (!formData.label || !formData.hostname || !formData.username) {
      return;
    }

    const hostConfig: SSHHostConfig = {
      id: formData.id!,
      label: formData.label,
      hostname: formData.hostname,
      port: formData.port || 22,
      username: formData.username,
      authMethod: formData.authMethod || "password",
      useSSHAgent: formData.useSSHAgent || false,
      ...(formData.group && { group: formData.group }),
      ...(formData.password && { password: formData.password }),
      ...(formData.privateKeyPath && { privateKeyPath: formData.privateKeyPath }),
      ...(formData.passphrase && { passphrase: formData.passphrase }),
      ...(formData.proxyJump && { proxyJump: formData.proxyJump }),
      ...(formData.startupCommand && { startupCommand: formData.startupCommand }),
      ...(formData.color && { color: formData.color }),
      ...(formData.sshConfigHost && { sshConfigHost: formData.sshConfigHost }),
      ...(formData.terminalSettings && { terminalSettings: formData.terminalSettings }),
    };

    if (editingHost) {
      updateHost(editingHost.id, hostConfig);
    } else {
      addHost(hostConfig);
    }

    onOpenChange(false);
    resetForm();
  };

  const handleTestConnection = async () => {
    if (!formData.hostname || !formData.username) {
      return;
    }

    setTestStatus("testing");
    setTestError("");

    try {
      const testConfig: SSHHostConfig = {
        id: "test",
        label: "test",
        hostname: formData.hostname,
        port: formData.port || 22,
        username: formData.username,
        authMethod: formData.authMethod || "password",
        useSSHAgent: formData.useSSHAgent || false,
        ...(formData.password && { password: formData.password }),
        ...(formData.privateKeyPath && { privateKeyPath: formData.privateKeyPath }),
        ...(formData.passphrase && { passphrase: formData.passphrase }),
      };

      await testSSHConnection(testConfig);
      setTestStatus("success");
    } catch (error) {
      setTestStatus("error");
      setTestError(String(error));
    }
  };

  const resetForm = () => {
    setFormData({
      id: crypto.randomUUID(),
      label: "",
      hostname: "",
      port: 22,
      username: "",
      authMethod: "password",
      useSSHAgent: false,
    });
    setTestStatus("idle");
    setTestError("");
    setShowAdvanced(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingHost ? "Edit SSH Host" : "New SSH Host"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="label">Label *</Label>
              <Input
                id="label"
                placeholder="My Server"
                value={formData.label || ""}
                onChange={(e) =>
                  setFormData({ ...formData, label: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="group">Group</Label>
              <Select
                value={formData.group || ""}
                onValueChange={(value) => {
                  const newFormData = { ...formData };
                  if (value) {
                    newFormData.group = value;
                  } else {
                    delete newFormData.group;
                  }
                  setFormData(newFormData);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select or type new..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No Group</SelectItem>
                  {existingGroups.map((group) => (
                    <SelectItem key={group} value={group!}>
                      {group}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="hostname">Hostname *</Label>
              <Input
                id="hostname"
                placeholder="example.com or 192.168.1.100"
                value={formData.hostname || ""}
                onChange={(e) =>
                  setFormData({ ...formData, hostname: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                placeholder="22"
                value={formData.port || 22}
                onChange={(e) =>
                  setFormData({ ...formData, port: parseInt(e.target.value) })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username *</Label>
            <Input
              id="username"
              placeholder="root"
              value={formData.username || ""}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
            />
          </div>

          {/* Authentication */}
          <div className="space-y-3">
            <Label>Authentication Method</Label>
            <RadioGroup
              value={formData.authMethod || "password"}
              onValueChange={(value: any) =>
                setFormData({ ...formData, authMethod: value })
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="password" id="auth-password" />
                <Label htmlFor="auth-password" className="font-normal">
                  Password
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="key" id="auth-key" />
                <Label htmlFor="auth-key" className="font-normal">
                  Private Key
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="agent" id="auth-agent" />
                <Label htmlFor="auth-agent" className="font-normal">
                  SSH Agent
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Auth-specific fields */}
          {formData.authMethod === "password" && (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Leave empty to prompt on connect"
                value={formData.password || ""}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
              />
            </div>
          )}

          {formData.authMethod === "key" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="privateKeyPath">Private Key Path</Label>
                <Input
                  id="privateKeyPath"
                  placeholder="~/.ssh/id_rsa"
                  value={formData.privateKeyPath || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, privateKeyPath: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passphrase">Passphrase (if encrypted)</Label>
                <Input
                  id="passphrase"
                  type="password"
                  placeholder="Leave empty if no passphrase"
                  value={formData.passphrase || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, passphrase: e.target.value })
                  }
                />
              </div>
            </>
          )}

          {/* Color Picker */}
          <div className="space-y-2">
            <Label htmlFor="color">Color (optional)</Label>
            <div className="flex gap-2">
              <Input
                id="color"
                type="color"
                value={formData.color || "#3b82f6"}
                onChange={(e) =>
                  setFormData({ ...formData, color: e.target.value })
                }
                className="w-20 h-10"
              />
              <Input
                value={formData.color || ""}
                onChange={(e) =>
                  setFormData({ ...formData, color: e.target.value })
                }
                placeholder="#3b82f6"
              />
            </div>
          </div>

          {/* Advanced Section */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm font-medium hover:underline"
              style={{ color: "var(--ui-foreground)" }}
            >
              {showAdvanced ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
              Advanced Settings
            </button>

            {showAdvanced && (
              <div className="mt-4 space-y-4 pl-6">
                <div className="space-y-2">
                  <Label htmlFor="proxyJump">Proxy Jump</Label>
                  <Input
                    id="proxyJump"
                    placeholder="user@jumphost:22"
                    value={formData.proxyJump || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, proxyJump: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="startupCommand">Startup Command</Label>
                  <Input
                    id="startupCommand"
                    placeholder="cd /var/www && ls"
                    value={formData.startupCommand || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        startupCommand: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>

          {/* Test Connection */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={
                !formData.hostname ||
                !formData.username ||
                testStatus === "testing"
              }
            >
              {testStatus === "testing" && (
                <Loader2 className="size-4 mr-2 animate-spin" />
              )}
              {testStatus === "success" && (
                <Check className="size-4 mr-2 text-green-500" />
              )}
              {testStatus === "error" && (
                <X className="size-4 mr-2 text-red-500" />
              )}
              Test Connection
            </Button>

            {testStatus === "success" && (
              <span className="text-sm text-green-500">
                Connection successful!
              </span>
            )}
            {testStatus === "error" && (
              <span className="text-sm text-red-500">{testError}</span>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!formData.label || !formData.hostname || !formData.username}
          >
            {editingHost ? "Save Changes" : "Add Host"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
