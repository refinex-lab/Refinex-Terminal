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

interface NewGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (groupName: string) => void;
  existingGroups: string[];
}

export function NewGroupDialog({
  open,
  onOpenChange,
  onConfirm,
  existingGroups,
}: NewGroupDialogProps) {
  const [groupName, setGroupName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    const trimmedName = groupName.trim();

    if (!trimmedName) {
      setError("Group name cannot be empty");
      return;
    }

    if (existingGroups.includes(trimmedName)) {
      setError("Group name already exists");
      return;
    }

    onConfirm(trimmedName);
    handleClose();
  };

  const handleClose = () => {
    setGroupName("");
    setError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Group</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="groupName">Group Name</Label>
            <Input
              id="groupName"
              autoFocus
              placeholder="e.g., AWS, Production, Home Lab"
              value={groupName}
              onChange={(e) => {
                setGroupName(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSubmit();
                } else if (e.key === "Escape") {
                  handleClose();
                }
              }}
            />
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>

          <div className="text-sm text-muted-foreground">
            Groups help you organize your SSH hosts. You can assign multiple hosts to the same group.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!groupName.trim()}>
            Create Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
