import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
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

interface HostKeyRequest {
  hostname: string;
  port: number;
  key_type: string;
  fingerprint: string;
}

interface HostKeyVerifyDialogProps {
  connId: string;
}

export function HostKeyVerifyDialog({ connId }: HostKeyVerifyDialogProps) {
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState<HostKeyRequest | null>(null);

  useEffect(() => {
    const eventName = `ssh-host-key-verify-${connId}`;

    const unlisten = listen<HostKeyRequest>(eventName, (event) => {
      setRequest(event.payload);
      setOpen(true);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [connId]);

  const handleResponse = async (action: "reject" | "accept_once" | "accept_and_remember") => {
    if (!request) return;

    try {
      await invoke("ssh_host_key_response", {
        connId,
        action,
      });
      setOpen(false);
      setRequest(null);
    } catch (error) {
      console.error("Failed to send host key response:", error);
    }
  };

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-yellow-500" />
            <DialogTitle>Unknown SSH Host Key</DialogTitle>
          </div>
          <DialogDescription>
            The authenticity of host '{request.hostname}:{request.port}' can't be established.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="text-sm">
              <span className="font-medium">Key Type:</span>{" "}
              <code className="bg-white/10 px-2 py-1 rounded text-xs">
                {request.key_type}
              </code>
            </div>
            <div className="text-sm">
              <span className="font-medium">Fingerprint:</span>
              <pre className="mt-2 bg-white/10 p-3 rounded text-xs overflow-x-auto">
                {request.fingerprint}
              </pre>
            </div>
          </div>

          <div className="text-sm text-yellow-500/80 bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
            <p className="font-medium mb-1">Security Warning</p>
            <p>
              This host key is not recognized. If you're connecting to this server for the first time,
              this is normal. However, if you've connected before, this could indicate a security issue
              (man-in-the-middle attack).
            </p>
          </div>

          <div className="text-sm text-muted-foreground">
            Do you want to continue connecting?
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => handleResponse("reject")}
          >
            Reject
          </Button>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleResponse("accept_once")}
            >
              Accept Once
            </Button>
            <Button
              onClick={() => handleResponse("accept_and_remember")}
            >
              Accept and Remember
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
