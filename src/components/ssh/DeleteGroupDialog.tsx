import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface DeleteGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupName: string;
  hostCount: number;
  onConfirm: () => void;
}

export function DeleteGroupDialog({
  open,
  onOpenChange,
  groupName,
  hostCount,
  onConfirm,
}: DeleteGroupDialogProps) {
  const [showSecondConfirm, setShowSecondConfirm] = useState(false);

  const handleClose = () => {
    setShowSecondConfirm(false);
    onOpenChange(false);
  };

  const handleFirstConfirm = () => {
    if (hostCount === 0) {
      // Empty group, delete directly
      onConfirm();
      handleClose();
    } else {
      // Show second confirmation
      setShowSecondConfirm(true);
    }
  };

  const handleSecondConfirm = () => {
    onConfirm();
    handleClose();
  };

  const handleSecondCancel = () => {
    setShowSecondConfirm(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-red-500" />
            <DialogTitle>
              {showSecondConfirm ? "Final Confirmation" : "Delete Group"}
            </DialogTitle>
          </div>
        </DialogHeader>

        {!showSecondConfirm ? (
          <>
            <DialogDescription className="py-4">
              {hostCount === 0 ? (
                <p>Are you sure you want to delete the group "{groupName}"?</p>
              ) : (
                <div className="space-y-2">
                  <p>
                    This group contains <strong>{hostCount}</strong> host{hostCount > 1 ? "s" : ""}.
                  </p>
                  <p className="text-red-500 font-medium">
                    Deleting the group will also delete all hosts in it. This action cannot be undone.
                  </p>
                </div>
              )}
            </DialogDescription>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleFirstConfirm}>
                {hostCount === 0 ? "Delete" : "Continue"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogDescription className="py-4">
              <div className="space-y-2">
                <p className="font-semibold">
                  Are you absolutely sure you want to delete the group "{groupName}" and all {hostCount} host{hostCount > 1 ? "s" : ""}?
                </p>
                <p className="text-sm text-muted-foreground">
                  This action is permanent and cannot be undone.
                </p>
              </div>
            </DialogDescription>

            <DialogFooter>
              <Button variant="outline" onClick={handleSecondCancel}>
                Go Back
              </Button>
              <Button variant="destructive" onClick={handleSecondConfirm}>
                Delete Everything
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
