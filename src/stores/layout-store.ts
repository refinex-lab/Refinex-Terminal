import { create } from "zustand";

/**
 * Layout mode type
 */
export type LayoutMode = "terminal" | "ide";

/**
 * Layout store state
 */
interface LayoutStore {
  mode: LayoutMode;
  bottomPanelVisible: boolean; // For IDE mode terminal panel
  bottomPanelHeight: number; // Height of bottom terminal panel in IDE mode

  // Actions
  setMode: (mode: LayoutMode) => void;
  toggleBottomPanel: () => void;
  setBottomPanelHeight: (height: number) => void;
}

/**
 * Layout store - manages application layout mode and bottom panel state
 * Persists mode preference to localStorage
 */
export const useLayoutStore = create<LayoutStore>((set) => ({
  mode: (localStorage.getItem("layout-mode") as LayoutMode) || "terminal",
  bottomPanelVisible: false,
  bottomPanelHeight: 300,

  setMode: (mode) => {
    localStorage.setItem("layout-mode", mode);
    set({
      mode,
      // When switching to terminal mode, hide bottom panel
      bottomPanelVisible: mode === "terminal" ? false : false,
    });
  },

  toggleBottomPanel: () =>
    set((state) => ({
      bottomPanelVisible: !state.bottomPanelVisible,
    })),

  setBottomPanelHeight: (height) =>
    set({
      bottomPanelHeight: Math.max(200, Math.min(600, height)),
    }),
}));
