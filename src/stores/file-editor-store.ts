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
  content?: string; // Current content for auto-save
}

/**
 * File editor store state
 */
interface FileEditorStore {
  tabs: FileTab[];
  activeTabId: string | null;
  addTab: (path: string, name: string) => void;
  removeTab: (id: string) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTabDirty: (id: string, isDirty: boolean) => void;
  updateTabContent: (id: string, content: string) => void;
  getTabContent: (id: string) => string | undefined;
  closeAllTabs: () => void;
  closeOtherTabs: (id: string) => void;
  closeTabsToRight: (id: string) => void;
  reorderTabs: (oldIndex: number, newIndex: number) => void;
  openFile: (file: { path: string; name?: string; content: string; language: string; metadata?: string }) => void;
  openFileAtLine: (path: string, lineNumber: number) => void;
}

/**
 * File editor store - manages file tabs and active file
 */
export const useFileEditorStore = create<FileEditorStore>((set, get) => ({
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

  closeTab: (id) => get().removeTab(id),

  openFile: (file) => {
    set((state) => {
      // Check if tab already exists
      const existingTab = state.tabs.find((t) => t.path === file.path);
      if (existingTab) {
        // Update content and activate it
        return {
          tabs: state.tabs.map((t) =>
            t.id === existingTab.id
              ? { ...t, isActive: true, content: file.content }
              : { ...t, isActive: false }
          ),
          activeTabId: existingTab.id,
        };
      }

      // Extract name from path if not provided
      const fileName = file.name || file.path.split('/').pop() || file.path;

      // Create new tab with content
      const newTab: FileTab = {
        id: `tab-${Date.now()}-${Math.random()}`,
        path: file.path,
        name: fileName,
        isActive: true,
        isDirty: false,
        content: file.content,
      };

      return {
        tabs: [
          ...state.tabs.map((t) => ({ ...t, isActive: false })),
          newTab,
        ],
        activeTabId: newTab.id,
      };
    });
  },

  setActiveTab: (id) =>
    set((state) => ({
      tabs: state.tabs.map((t) => ({
        ...t,
        isActive: t.id === id,
      })),
      activeTabId: id,
    })),

  updateTabDirty: (id, isDirty) =>
    set((state) => {
      const tab = state.tabs.find(t => t.id === id);
      // Only update if the value actually changed
      if (tab && tab.isDirty === isDirty) return state;

      return {
        tabs: state.tabs.map((t) =>
          t.id === id ? { ...t, isDirty } : t
        ),
      };
    }),

  updateTabContent: (id, content) =>
    set((state) => {
      const tab = state.tabs.find(t => t.id === id);
      // Only update if the content actually changed
      if (tab && tab.content === content) return state;

      return {
        tabs: state.tabs.map((t) =>
          t.id === id ? { ...t, content } : t
        ),
      };
    }),

  getTabContent: (id) => {
    const tab = get().tabs.find((t) => t.id === id);
    return tab?.content;
  },

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

  reorderTabs: (oldIndex, newIndex) =>
    set((state) => {
      const newTabs = [...state.tabs];
      const [movedTab] = newTabs.splice(oldIndex, 1);
      if (movedTab) {
        newTabs.splice(newIndex, 0, movedTab);
      }

      return {
        tabs: newTabs,
      };
    }),

  openFileAtLine: (path, lineNumber) => {
    const fileName = path.split('/').pop() || path;

    // First, open or activate the tab
    get().addTab(path, fileName);

    // Emit a custom event to notify the editor to scroll to the line
    // The FilePreview component will listen for this event
    window.dispatchEvent(
      new CustomEvent('editor-goto-line', {
        detail: { path, lineNumber },
      })
    );
  },
}));
