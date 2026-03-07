import { useState, useEffect } from "react";
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
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { useSshStore } from "@/stores/ssh-store";
import type { SSHHostConfig } from "@/lib/tauri-ssh";
import { testSSHConnection } from "@/lib/tauri-ssh";
import { NewGroupDialog } from "./NewGroupDialog";
import { toast } from "sonner";

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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newGroupDialogOpen, setNewGroupDialogOpen] = useState(false);

  // Reset form data when editingHost changes
  useEffect(() => {
    if (open) {
      if (editingHost) {
        setFormData({ ...editingHost });
      } else {
        setFormData({
          id: crypto.randomUUID(),
          label: "",
          hostname: "",
          port: 22,
          username: "",
          authMethod: "password",
          useSSHAgent: false,
        });
      }
      setTestStatus("idle");
      setShowAdvanced(false);
    }
  }, [editingHost, open]);

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
    toast.loading("Testing connection...", { id: "ssh-test" });

    try {
      // Build config with snake_case field names for Rust backend
      const testConfig: any = {
        id: "test",
        label: "test",
        hostname: formData.hostname,
        port: formData.port || 22,
        username: formData.username,
        auth_method: formData.authMethod || "password",
        use_ssh_agent: formData.useSSHAgent || false,
      };

      if (formData.password) {
        testConfig.password = formData.password;
      }
      if (formData.privateKeyPath) {
        testConfig.private_key_path = formData.privateKeyPath;
      }
      if (formData.passphrase) {
        testConfig.passphrase = formData.passphrase;
      }

      await testSSHConnection(testConfig);
      setTestStatus("success");
      toast.success("Connection successful!", { id: "ssh-test" });
    } catch (error) {
      setTestStatus("error");
      toast.error(`Connection failed: ${error}`, { id: "ssh-test", duration: 5000 });
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

        <div className="space-y-6 py-4">
          {/* Basic Info - Two columns with equal width */}
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
                value={formData.group || "__no_group__"}
                onValueChange={(value) => {
                  if (value === "__new_group__") {
                    setNewGroupDialogOpen(true);
                  } else {
                    const newFormData = { ...formData };
                    if (value && value !== "__no_group__") {
                      newFormData.group = value;
                    } else {
                      delete newFormData.group;
                    }
                    setFormData(newFormData);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select or create new...">
                    {formData.group || "Select or create new..."}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__no_group__">No Group</SelectItem>
                  {/* Show current group even if it's not in existingGroups yet */}
                  {formData.group && !existingGroups.includes(formData.group) && (
                    <SelectItem value={formData.group}>
                      {formData.group} (new)
                    </SelectItem>
                  )}
                  {existingGroups.map((group) => (
               <SelectItem key={group} value={group!}>
                      {group}
                    </SelectItem>
                  ))}
                  <SelectItem value="__new_group__">+ Create New Group</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Hostname and Port - 3:1 ratio */}
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-3 space-y-2">
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

          {/* Username - Full width */}
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

          {/* Authentication Method */}
          <div className="space-y-3">
            <Label>Authentication Method</Label>
            <RadioGroup
              value={formData.authMethod || "password"}
              onValueChange={(value: any) =>
                setFormData({ ...formData, authMethod: value })
              }
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="password" id="auth-password" />
                <Label htmlFor="auth-password" className="font-normal cursor-pointer">
                  Password
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="key" id="auth-key" />
                <Label htmlFor="auth-key" className="font-normal cursor-pointer">
                  Private Key
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="agent" id="auth-agent" />
                <Label htmlFor="auth-agent" className="font-normal cursor-pointer">
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
            <div className="space-y-4">
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
            </div>
          )}

          {/* Color Picker - Improved layout */}
          <div className="space-y-2">
            <Label htmlFor="color">Color (optional)</Label>
            <div className="flex items-center gap-3">
              <Input
                id="color"
                type="color"
                value={formData.color || "#3b82f6"}
                onChange={(e) =>
                  setFormData({ ...formData, color: e.target.value })
                }
                className="w-16 h-10 cursor-pointer"
              />
              <Input
                value={formData.color || "#3b82f6"}
                onChange={(e) =>
                  setFormData({ ...formData, color: e.target.value })
                }
                placeholder="#3b82f6"
                className="flex-1"
              />
            </div>
          </div>

          {/* Advanced Section */}
          <div className="border-t pt-4">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm font-medium hover:underline mb-4"
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
              <div className="space-y-4">
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
        </div>

        <DialogFooter className="flex items-center justify-between">
          <Button
            type="button"
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
            Test Connection
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.label || !formData.hostname || !formData.username}
            >
              {editingHost ? "Save Changes" : "Add Host"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* New Group Dialog */}
      <NewGroupDialog
        open={newGroupDialogOpen}
        onOpenChange={setNewGroupDialogOpen}
        onConfirm={(groupName) => {
          setFormData({ ...formData, group: groupName });
        }}
        existingGroups={existingGroups as string[]}
      />
    </Dialog>
  );
}
