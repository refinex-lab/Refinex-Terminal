import { create } from "zustand";

/**
 * Project type
 */
export interface Project {
  path: string;
  name: string;
}

/**
 * Sidebar store state
 */
interface SidebarStore {
  isOpen: boolean;
  projects: Project[];
  activeProject: Project | null;
  toggleSidebar: () => void;
  addProject: (project: Project) => void;
  removeProject: (path: string) => void;
  setActiveProject: (project: Project | null) => void;
}

/**
 * Sidebar store - manages sidebar state (open/closed, active project, file tree)
 */
export const useSidebarStore = create<SidebarStore>((set) => ({
  isOpen: true,
  projects: [],
  activeProject: null,

  toggleSidebar: () =>
    set((state) => ({
      isOpen: !state.isOpen,
    })),

  addProject: (project) =>
    set((state) => ({
      projects: [...state.projects, project],
    })),

  removeProject: (path) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.path !== path),
      activeProject:
        state.activeProject?.path === path ? null : state.activeProject,
    })),

  setActiveProject: (project) =>
    set({
      activeProject: project,
    }),
}));
