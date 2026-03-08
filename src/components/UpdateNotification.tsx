import { useState, useEffect } from "react";
import { Bell, Download, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkForUpdatesOnLaunch, downloadAndInstallUpdate, restartApp, type UpdateInfo } from "@/lib/updater";
import { toast } from "sonner";

export function UpdateNotification() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check for updates on mount (app launch)
    checkForUpdatesOnLaunch().then((info) => {
      if (info) {
        setUpdateInfo(info);
      }
    });
  }, []);

  const handleDownloadAndInstall = async () => {
    if (!updateInfo) return;

    setIsDownloading(true);
    try {
      await downloadAndInstallUpdate((progress) => {
        setDownloadProgress(progress);
      });

      toast.success("Update downloaded successfully! Restarting...");

      // Wait a moment for the toast to show
      setTimeout(() => {
        restartApp();
      }, 1000);
    } catch (error) {
      toast.error(`Failed to download update: ${error}`);
      setIsDownloading(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  if (!updateInfo || !updateInfo.available || isDismissed) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-96 rounded-lg border shadow-lg p-4"
      style={{
        backgroundColor: "var(--ui-background)",
        borderColor: "var(--ui-border)",
      }}
    >
      <div className="flex items-start gap-3">
        <Bell className="size-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-semibold text-sm mb-1">
            Update Available: v{updateInfo.latestVersion}
          </h4>
          <p className="text-xs text-muted-foreground mb-3">
            A new version of Refinex Terminal is available.
          </p>

          {updateInfo.body && (
            <div className="text-xs text-muted-foreground mb-3 max-h-32 overflow-y-auto">
              <p className="font-medium mb-1">What's new:</p>
              <div className="whitespace-pre-wrap">{updateInfo.body}</div>
            </div>
          )}

          {isDownloading && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Downloading...</span>
                <span className="text-muted-foreground">{downloadProgress.toFixed(0)}%</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleDownloadAndInstall}
              disabled={isDownloading}
              className="flex-1"
            >
              {isDownloading ? (
                <>
                  <RefreshCw className="size-3 mr-2 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="size-3 mr-2" />
                  Update & Restart
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDismiss}
              disabled={isDownloading}
            >
              <X className="size-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
