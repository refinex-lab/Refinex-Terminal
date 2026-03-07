import { create } from "zustand";

/**
 * Project information
 */
export interface Project {
  id: string;
  name: string;
  path: string;
  lastOpened?: number; // Timestamp of last opened
}

/**
 * Project history entry
 */
export interface ProjectHistoryEntry {
  path: string;
  name: string;
  lastOpened: number;
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
  projectHistory: ProjectHistoryEntry[]; // Recent projects history

  // Actions
  toggleVisibility: () => void;
  setWidth: (width: number) => void;
  addProject: (path: string) => void;
  removeProject: (id: string) => void;
  setActiveProject: (id: string | null) => void;
  loadProjects: (paths: string[]) => void;
  addToHistory: (path: string, name: string) => void;
  loadHistory: () => void;
  saveHistory: () => void;
  clearHistory: () => void;
}

const HISTORY_STORAGE_KEY = "project-history";
const MAX_HISTORY_ITEMS = 10;

/**
 * Sidebar store - manages sidebar state and projects
 */
export const useSidebarStore = create<SidebarStore>((set, get) => ({
  isVisible: true,
  width: 260,
  projects: [],
  activeProjectId: null,
  activeProject: null,
  projectHistory: [],

  toggleVisibility: () =>
    set((state) => ({ isVisible: !state.isVisible })),

  setWidth: (width: number) =>
    set({ width: Math.max(200, Math.min(400, width)) }),

  addProject: (path: string) => {
    const { projects, addToHistory } = get();

    // Check if project already exists
    const existingProject = projects.find((p) => p.path === path);
    if (existingProject) {
      // If project exists, just set it as active and history
      const updatedProjects = projects.map(p =>
        p.id === existingProject.id ? { ...p, lastOpened: Date.now() } : p
      );
      set({
        projects: updatedProjects,
        activeProjectId: existingProject.id,
        activeProject: { ...existingProject, lastOpened: Date.now() }
      });
      addToHistory(path, existingProject.name);
      return;
    }

    // Extract project name from path
    const name = path.split("/").pop() || path.split("\\").pop() || path;

    const newProject: Project = {
      id: `project-${Date.now()}`,
      name,
      path,
      lastOpened: Date.now(),
    };

    // Add project and set it as active
    set({
      projects: [...projects, newProject],
      activeProjectId: newProject.id,
      activeProject: newProject
    });

    // Add to history
    addToHistory(path, name);
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
    const { projects, addToHistory } = get();
    const project = id ? projects.find(p => p.id === id) || null : null;

    if (project) {
      // Update last opened timestamp
      const updatedProjects = projects.map(p =>
        p.id === id ? { ...p, lastOpened: Date.now() } : p
      );
      set({
        projects: updatedProjects,
        activeProjectId: id,
        activeProject: { ...project, lastOpened: Date.now() }
      });
      addToHistory(project.path, project.name);
    } else {
      set({
        activeProjectId: id,
        activeProject: project
      });
    }
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
      activeProjectId: firstProject?.id ?? null,
      activeProject: firstProject ?? null
    });
  },

  addToHistory: (path: string, name: string) => {
    const { projectHistory, saveHistory } = get();

    // Remove existing entry if present
    const filtered = projectHistory.filter(p => p.path !== path);

    // Add to front with current timestamp
    const newHistory: ProjectHistoryEntry[] = [
      { path, name, lastOpened: Date.now() },
      ...filtered
    ].slice(0, MAX_HISTORY_ITEMS); // Keep only last N items

    set({ projectHistory: newHistory });
    saveHistory();
  },

  loadHistory: () => {
    try {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        const history: ProjectHistoryEntry[] = JSON.parse(stored);
        set({ projectHistory: history });
      }
    } catch (error) {
      console.error("Failed to load project history:", error);
    }
  },

  saveHistory: () => {
    try {
      const { projectHistory } = get();
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(projectHistory));
    } catch (error) {
      console.error("Failed to save project history:", error);
    }
  },

  clearHistory: () => {
    set({ projectHistory: [] });
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  },
}));
