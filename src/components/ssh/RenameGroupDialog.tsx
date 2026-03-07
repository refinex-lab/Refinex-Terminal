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

interface RenameGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  onConfirm: (newName: string) => void;
  existingGroups: string[];
}

export function RenameGroupDialog({
  open,
  onOpenChange,
  currentName,
  onConfirm,
  existingGroups,
}: RenameGroupDialogProps) {
  const [newName, setNewName] = useState(currentName);
  const [error, setError] = useState("");

  // Update newName when dialog opens or currentName changes
  useEffect(() => {
    if (open) {
      setNewName(currentName);
      setError("");
    }
  }, [open, currentName]);

  const handleSubmit = () => {
    const trimmedName = newName.trim();

    if (!trimmedName) {
      setError("Group name cannot be empty");
      return;
    }

    if (trimmedName === currentName) {
      setError("Please enter a different name");
      return;
    }

    if (existingGroups.includes(trimmedName)) {
      setError("A group with this name already exists");
      return;
    }

    onConfirm(trimmedName);
    handleClose();
  };

  const handleClose = () => {
    setNewName(currentName);
    setError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rename Group</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="groupName">New Group Name</Label>
            <Input
              id="groupName"
              autoFocus
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!newName.trim()}>
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
