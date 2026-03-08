import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

interface FileConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  showApplyToAll?: boolean;
  onConfirm: (action: "overwrite" | "skip", applyToAll: boolean) => void;
}

export function FileConflictDialog({
  open,
  onOpenChange,
  fileName,
  showApplyToAll = false,
  onConfirm,
}: FileConflictDialogProps) {
  const [applyToAll, setApplyToAll] = useState(false);

  const handleClose = () => {
    setApplyToAll(false);
    onOpenChange(false);
  };

  const handleOverwrite = () => {
    onConfirm("overwrite", applyToAll);
    setApplyToAll(false);
    handleClose();
  };

  const handleSkip = () => {
    onConfirm("skip", applyToAll);
    setApplyToAll(false);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-yellow-500" />
            <DialogTitle>File Already Exists</DialogTitle>
          </div>
        </DialogHeader>

        <DialogDescription className="py-4">
          <div className="space-y-4">
            <p>
              The file <strong>{fileName}</strong> already exists in the destination.
            </p>
            <p className="text-sm text-muted-foreground">
              What would you like to do?
            </p>
            {showApplyToAll && (
              <div className="flex items-center gap-2 pt-2">
                <Checkbox
                  id="apply-to-all"
                  checked={applyToAll}
                  onCheckedChange={(checked) => setApplyToAll(checked === true)}
                />
                <label
                  htmlFor="apply-to-all"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Apply to all conflicts
                </label>
              </div>
            )}
          </div>
        </DialogDescription>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleSkip}>
            Skip
          </Button>
          <Button variant="default" onClick={handleOverwrite}>
            Overwrite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
