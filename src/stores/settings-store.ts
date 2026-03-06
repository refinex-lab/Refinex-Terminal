import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Auto-save configuration
 */
export interface AutoSaveConfig {
  enabled: boolean;           // Enable auto-save
  onTabSwitch: boolean;       // Save when switching tabs
  onWindowChange: boolean;    // Save when window loses focus
  afterDelay: number;         // Delay in ms (0 = disabled)
  promptOnClose: boolean;     // Prompt when closing tab with unsaved changes
}

/**
 * Settings store state
 */
interface SettingsStore {
  autoSave: AutoSaveConfig;
  updateAutoSave: (config: Partial<AutoSaveConfig>) => void;
}

/**
 * Default auto-save configuration
 */
const defaultAutoSaveConfig: AutoSaveConfig = {
  enabled: true,
  onTabSwitch: true,
  onWindowChange: true,
  afterDelay: 2000,           // 2 seconds
  promptOnClose: false,       // Auto-save enabled, no prompt needed
};

/**
 * Settings store - manages application settings
 */
export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      autoSave: defaultAutoSaveConfig,

      updateAutoSave: (config) =>
        set((state) => ({
          autoSave: { ...state.autoSave, ...config },
        })),
    }),
    {
      name: "refinex-terminal-settings",
    }
  )
);
