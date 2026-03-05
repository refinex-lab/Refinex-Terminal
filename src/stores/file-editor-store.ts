import { create } from "zustand";

/**
 * File tab type
 */
export interface FileTab {
  id: string;
  path: string;
  name: string;
  isActive: boolean;
  isDirty: boolean; // Has unsaved changes
}

/**
 * File editor store state
 */
interface FileEditorStore {
  tabs: FileTab[];
  activeTabId: string | null;
  addTab: (path: string, name: string) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTabDirty: (id: string, isDirty: boolean) => void;
  closeAllTabs: () => void;
  closeOtherTabs: (id: string) => void;
  closeTabsToRight: (id: string) => void;
}

/**
 * File editor store - manages file tabs and active file
 */
export const useFileEditorStore = create<FileEditorStore>((set) => ({
  tabs: [],
  activeTabId: null,

  addTab: (path, name) =>
    set((state) => {
      // Check if tab already exists
      const existingTab = state.tabs.find((t) => t.path === path);
      if (existingTab) {
        // Just activate it
        return {
          tabs: state.tabs.map((t) => ({
            ...t,
            isActive: t.id === existingTab.id,
          })),
          activeTabId: existingTab.id,
        };
      }

      // Create new tab
      const newTab: FileTab = {
        id: `tab-${Date.now()}-${Math.random()}`,
        path,
        name,
        isActive: true,
        isDirty: false,
      };

      return {
        tabs: [
          ...state.tabs.map((t) => ({ ...t, isActive: false })),
          newTab,
        ],
        activeTabId: newTab.id,
      };
    }),

  removeTab: (id) =>
    set((state) => {
      const tabIndex = state.tabs.findIndex((t) => t.id === id);
      if (tabIndex === -1) return state;

      const newTabs = state.tabs.filter((t) => t.id !== id);

      // If closing active tab, activate another one
      let newActiveTabId = state.activeTabId;
      if (state.activeTabId === id && newTabs.length > 0) {
        // Activate the tab to the right, or the last tab if closing the last one
        const nextIndex = Math.min(tabIndex, newTabs.length - 1);
        const nextTab = newTabs[nextIndex];
        if (nextTab) {
          newActiveTabId = nextTab.id;
          newTabs[nextIndex] = { ...nextTab, isActive: true };
        }
      } else if (newTabs.length === 0) {
        newActiveTabId = null;
      }

      return {
        tabs: newTabs,
        activeTabId: newActiveTabId,
      };
    }),

  setActiveTab: (id) =>
    set((state) => ({
      tabs: state.tabs.map((t) => ({
        ...t,
        isActive: t.id === id,
      })),
      activeTabId: id,
    })),

  updateTabDirty: (id, isDirty) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === id ? { ...t, isDirty } : t
      ),
    })),

  closeAllTabs: () =>
    set(() => ({
      tabs: [],
      activeTabId: null,
    })),

  closeOtherTabs: (id) =>
    set((state) => {
      const tab = state.tabs.find((t) => t.id === id);
      if (!tab) return state;

      return {
        tabs: [{ ...tab, isActive: true }],
        activeTabId: id,
      };
    }),

  closeTabsToRight: (id) =>
    set((state) => {
      const tabIndex = state.tabs.findIndex((t) => t.id === id);
      if (tabIndex === -1) return state;

      return {
        tabs: state.tabs.slice(0, tabIndex + 1),
        activeTabId: state.activeTabId,
      };
    }),
}));
