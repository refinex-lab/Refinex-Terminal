import { create } from "zustand";

/**
 * File change type for Git operations
 */
export interface FileChange {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
}

/**
 * Git status type
 */
export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: FileChange[];
  unstaged: FileChange[];
  untracked: string[];
}

/**
 * Git store state
 */
interface GitStore {
  status: GitStatus | null;
  setStatus: (status: GitStatus | null) => void;
  updateStatus: (updates: Partial<GitStatus>) => void;
}

/**
 * Git store - manages Git state
 */
export const useGitStore = create<GitStore>((set) => ({
  status: null,

  setStatus: (status) =>
    set({
      status,
    }),

  updateStatus: (updates) =>
    set((state) => ({
      status: state.status ? { ...state.status, ...updates } : null,
    })),
}));
