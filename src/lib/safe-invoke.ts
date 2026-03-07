import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

/**
 * Typed error response from Tauri
 */
export interface TauriError {
  message: string;
  code?: string;
}

/**
 * Wrap Tauri invoke with error handling
 */
export async function safeInvoke<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T | null> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    console.error(`Tauri command "${command}" failed:`, error);

    const errorMessage = typeof error === "string"
      ? error
      : (error as Error).message || "Unknown error";

    toast.error(`Command failed: ${command}`, {
      description: errorMessage,
      duration: 4000,
    });

    return null;
  }
}

/**
 * Wrap Tauri invoke with custom error handler
 */
export async function safeInvokeWithHandler<T>(
  command: string,
  args?: Record<string, unknown>,
  onError?: (error: string) => void
): Promise<T | null> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    console.error(`Tauri command "${command}" failed:`, error);

    const errorMessage = typeof error === "string"
      ? error
      : (error as Error).message || "Unknown error";

    if (onError) {
      onError(errorMessage);
    } else {
      toast.error(`Command failed: ${command}`, {
        description: errorMessage,
        duration: 4000,
      });
    }

    return null;
  }
}

/**
 * Wrap Tauri invoke without showing toast (silent error handling)
 */
export async function silentInvoke<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T | null> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    console.error(`Tauri command "${command}" failed:`, error);
    return null;
  }
}
