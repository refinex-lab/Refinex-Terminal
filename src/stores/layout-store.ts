import { create } from "zustand";

/**
 * Layout mode type
 */
export type LayoutMode = "terminal" | "ide" | "ssh";

/**
 * Bottom panel type for IDE mode
 */
export type BottomPanelType = "terminal" | "git-graph" | null;

/**
 * Layout store state
 */
interface LayoutStore {
  mode: LayoutMode;
  bottomPanelType: BottomPanelType; // What's shown in the bottom panel
  bottomPanelHeight: number; // Height of bottom panel in IDE mode

  // Actions
  setMode: (mode: LayoutMode) => void;
  setBottomPanelType: (type: BottomPanelType) => void;
  toggleBottomPanel: (type?: BottomPanelType) => void;
  setBottomPanelHeight: (height: number) => void;
}

/**
 * Layout store - manages application layout mode and bottom panel state
 * Persists mode preference to localStorage
 */
export const useLayoutStore = create<LayoutStore>((set, get) => ({
  mode: (localStorage.getItem("layout-mode") as LayoutMode) || "terminal",
  bottomPanelType: null,
  bottomPanelHeight: 300,

  setMode: (mode) => {
    localStorage.setItem("layout-mode", mode);
    set({
      mode,
      // When switching to terminal mode, hide bottom panel
      bottomPanelType: mode === "terminal" ? null : null,
    });
  },

  setBottomPanelType: (type) =>
    set({
      bottomPanelType: type,
    }),

  toggleBottomPanel: (type) =>
    set((state) => {
      // If no type specified, close the panel
      if (!type) {
        return { bottomPanelType: null };
      }

      // If same type, toggle visibility
      if (state.bottomPanelType === type) {
        return { bottomPanelType: null };
      }

      // Otherwise, switch to the new type
      return { bottomPanelType: type };
    }),

  setBottomPanelHeight: (height) =>
    set({
      bottomPanelHeight: Math.max(200, Math.min(600, height)),
    }),
}));
