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
  activeProject: Project | null;

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
  activeProject: null,

  toggleVisibility: () =>
    set((state) => ({ isVisible: !state.isVisible })),

  setWidth: (width: number) =>
    set({ width: Math.max(200, Math.min(400, width)) }),

  addProject: (path: string) => {
    const { projects } = get();

    // Check if project already exists
    const existingProject = projects.find((p) => p.path === path);
    if (existingProject) {
      // If project exists, just set it as active
      set({
        activeProjectId: existingProject.id,
        activeProject: existingProject
      });
      return;
    }

    // Extract project name from path
    const name = path.split("/").pop() || path.split("\\").pop() || path;

    const newProject: Project = {
      id: `project-${Date.now()}`,
      name,
      path,
    };

    // Add project and set it as active
    set({
      projects: [...projects, newProject],
      activeProjectId: newProject.id,
      activeProject: newProject
    });
  },

  removeProject: (id: string) => {
    const { projects, activeProjectId } = get();
    const newProjects = projects.filter((p) => p.id !== id);
    const newActiveId = activeProjectId === id ? null : activeProjectId;
    const newActiveProject = newActiveId ? newProjects.find(p => p.id === newActiveId) || null : null;

    set({
      projects: newProjects,
      activeProjectId: newActiveId,
      activeProject: newActiveProject
    });
  },

  setActiveProject: (id: string | null) => {
    const { projects } = get();
    const project = id ? projects.find(p => p.id === id) || null : null;
    set({
      activeProjectId: id,
      activeProject: project
    });
  },

  loadProjects: (paths: string[]) => {
    const projects = paths.map((path, index) => {
      const name = path.split("/").pop() || path.split("\\").pop() || path;
      return {
        id: `project-${index}`,
        name,
        path,
      };
    });

    // Set first project as active if there are projects
    const firstProject = projects.length > 0 ? projects[0] : null;
    set({
      projects,
      activeProjectId: firstProject?.id || null,
      activeProject: firstProject
    });
  },
}));
