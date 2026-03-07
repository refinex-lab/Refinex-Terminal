import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Shield, Info } from "lucide-react";

interface HostKeyDialogProps {
  open: boolean;
  hostname: string;
  port: number;
  keyType: string;
  fingerprint: string;
  status: "unknown" | "changed";
  onAccept: (remember: boolean) => void;
  onReject: () => void;
}

export function HostKeyDialog({
  open,
  hostname,
  port,
  keyType,
  fingerprint,
  status,
  onAccept,
  onReject,
}: HostKeyDialogProps) {
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    if (open) {
      setRemember(false);
    }
  }, [open]);

  const isChanged = status === "changed";

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onReject()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isChanged ? (
              <>
                <AlertTriangle className="size-5 text-red-500" />
                <span className="text-red-500">Host Key Changed!</span>
              </>
            ) : (
              <>
                <Shield className="size-5 text-yellow-500" />
                <span>Unknown Host Key</span>
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isChanged ? (
            <div
              className="p-4 rounded-md"
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
              }}
            >
              <p className="text-sm font-medium text-red-500 mb-2">
                WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!
              </p>
              <p className="text-sm" style={{ color: "var(--ui-foreground)" }}>
                The host key for <strong>{hostname}:{port}</strong> has changed.
                This could indicate a man-in-the-middle attack or that the host
                has been reinstalled.
              </p>
              <p className="text-sm mt-2" style={{ color: "var(--ui-foreground)" }}>
                If you trust this host, you can remove the old key from your
                known_hosts file and try connecting again.
              </p>
            </div>
          ) : (
            <div
              className="p-4 rounded-md"
              style={{
                backgroundColor: "rgba(234, 179, 8, 0.1)",
                border: "1px solid rgba(234, 179, 8, 0.3)",
              }}
            >
              <p className="text-sm" style={{ color: "var(--ui-foreground)" }}>
                The authenticity of host <strong>{hostname}:{port}</strong> cannot
                be established. This is the first time you are connecting to this
                host.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <Info className="size-4 mt-0.5" style={{ color: "var(--ui-muted-foreground)" }} />
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: "var(--ui-foreground)" }}>
                  Host Key Details
                </p>
                <div className="mt-2 space-y-1">
                  <div className="flex text-xs">
                    <span
                      className="w-24 font-medium"
                      style={{ color: "var(--ui-muted-foreground)" }}
                    >
                      Hostname:
                    </span>
                    <span style={{ color: "var(--ui-foreground)" }}>
                      {hostname}:{port}
                </span>
                  </div>
                  <div className="flex text-xs">
                    <span
                      className="w-24 font-medium"
                      style={{ color: "var(--ui-muted-foreground)" }}
                    >
                      Key Type:
                    </span>
                    <span style={{ color: "var(--ui-foreground)" }}>{keyType}</span>
                  </div>
                  <div className="flex text-xs">
                    <span
                      className="w-24 font-medium"
                      style={{ color: "var(--ui-muted-foreground)" }}
                    >
                      Fingerprint:
                    </span>
                    <span
                      className="font-mono break-all"
                      style={{ color: "var(--ui-foreground)" }}
                    >
                      {fingerprint}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {!isChanged && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="rounded"
              />
              <label
                htmlFor="remember"
                className="text-sm cursor-pointer"
                style={{ color: "var(--ui-foreground)" }}
              >
                Remember this key (add to known_hosts)
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          {isChanged ? (
            <>
              <Button variant="outline" onClick={onReject}>
                Cancel Connection
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onReject}>
                Reject
              </Button>
              <Button
                variant="outline"
                onClick={() => onAccept(false)}
              >
                Accept Once
              </Button>
              <Button onClick={() => onAccept(true)}>
                Accept & Remember
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
