import { create } from "zustand";

/**
 * Project information
 */
export interface Project {
  id: string;
  name: string;
  path: string;
}

/**
 * Sidebar store state
 */
interface SidebarStore {
  isVisible: boolean;
  width: number;
  projects: Project[];
  activeProjectId: string | null;

  // Actions
  toggleVisibility: () => void;
  setWidth: (width: number) => void;
  addProject: (path: string) => void;
  removeProject: (id: string) => void;
  setActiveProject: (id: string | null) => void;
  loadProjects: (paths: string[]) => void;
}

/**
 * Sidebar store - manages sidebar state and projects
 */
export const useSidebarStore = create<SidebarStore>((set, get) => ({
  isVisible: true,
  width: 260,
  projects: [],
  activeProjectId: null,

  toggleVisibility: () =>
    set((state) => ({ isVisible: !state.isVisible })),

  setWidth: (width: number) =>
    set({ width: Math.max(200, Math.min(400, width)) }),

  addProject: (path: string) => {
    const { projects } = get();

    // Check if project already exists
    if (projects.some((p) => p.path === path)) {
      return;
    }

    // Extract project name from path
    const name = path.split("/").pop() || path.split("\\").pop() || path;

    const newProject: Project = {
      id: `project-${Date.now()}`,
      name,
      path,
    };

    set({ projects: [...projects, newProject] });
  },

  removeProject: (id: string) => {
    const { projects, activeProjectId } = get();
    const newProjects = projects.filter((p) => p.id !== id);

    set({
      projects: newProjects,
      activeProjectId: activeProjectId === id ? null : activeProjectId,
    });
  },

  setActiveProject: (id: string | null) =>
    set({ activeProjectId: id }),

  loadProjects: (paths: string[]) => {
    const projects = paths.map((path, index) => {
      const name = path.split("/").pop() || path.split("\\").pop() || path;
      return {
        id: `project-${index}`,
        name,
        path,
      };
    });

    set({ projects });
  },
}));
