import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion?: string;
  body?: string;
}

/**
 * Check for available updates
 * @returns Update information
 */
export async function checkForUpdates(): Promise<UpdateInfo> {
  try {
    const update = await check();

    if (update) {
      return {
        available: true,
        currentVersion: update.currentVersion,
        latestVersion: update.version,
        body: update.body,
      };
    }

    return {
      available: false,
      currentVersion: update?.currentVersion || "unknown",
    };
  } catch (error) {
    console.error("Failed to check for updates:", error);
    throw error;
  }
}

/**
 * Download and install an available update
 * @param onProgress Optional progress callback (0-100)
 */
export async function downloadAndInstallUpdate(
  onProgress?: (progress: number) => void
): Promise<void> {
  try {
    const update = await check();

    if (!update) {
      throw new Error("No update available");
    }

    // Download and install the update
    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case "Started":
          onProgress?.(0);
          console.log("Update download started");
          break;
        case "Progress":
          if (event.data.contentLength) {
            const progress = (event.data.chunkLength / event.data.contentLength) * 100;
            onProgress?.(progress);
            console.log(`Download progress: ${progress.toFixed(1)}%`);
          }
          break;
        case "Finished":
          onProgress?.(100);
          console.log("Update download finished");
          break;
      }
    });

    console.log("Update installed successfully");
  } catch (error) {
    console.error("Failed to download and install update:", error);
    throw error;
  }
}

/**
 * Restart the application to apply updates
 */
export async function restartApp(): Promise<void> {
  try {
    await relaunch();
  } catch (error) {
    console.error("Failed to restart application:", error);
    throw error;
  }
}

/**
 * Check for updates on app launch (non-blocking)
 * Returns update info if available, null otherwise
 */
export async function checkForUpdatesOnLaunch(): Promise<UpdateInfo | null> {
  try {
    // Run check in background, don't block app startup
    const updateInfo = await checkForUpdates();

    if (updateInfo.available) {
      console.log(`Update available: ${updateInfo.latestVersion}`);
      return updateInfo;
    }

    console.log("No updates available");
    return null;
  } catch (error) {
    // Silently fail - don't interrupt app startup
    console.error("Update check failed:", error);
    return null;
  }
}
