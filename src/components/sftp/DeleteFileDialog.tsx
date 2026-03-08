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

interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modified: number;
}

interface DeleteFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: FileEntry[];
  onConfirm: () => void;
}

export function DeleteFileDialog({
  open,
  onOpenChange,
  files,
  onConfirm,
}: DeleteFileDialogProps) {
  const handleClose = () => {
    onOpenChange(false);
  };

  const handleConfirm = () => {
    onConfirm();
    handleClose();
  };

  const fileNames = files.map((f) => f.name).join(", ");
  const hasDirectories = files.some((f) => f.isDir);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-red-500" />
            <DialogTitle>Delete {files.length === 1 ? "File" : "Files"}</DialogTitle>
          </div>
        </DialogHeader>

        <DialogDescription className="py-4">
          <div className="space-y-2">
            <p>
              Are you sure you want to delete{" "}
              {files.length === 1 ? (
                <strong>{fileNames}</strong>
              ) : (
                <>
                  <strong>{files.length}</strong> items
                </>
              )}
              ?
            </p>
            {hasDirectories && (
              <p className="text-red-500 font-medium">
                This includes directories and all their contents. This action cannot be undone.
              </p>
            )}
          </div>
        </DialogDescription>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
