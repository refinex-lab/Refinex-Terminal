import { create } from "zustand";
import { arrayMove } from "@dnd-kit/sortable";

/**
 * Terminal session type
 */
export interface TerminalSession {
  id: string;
  title: string;
  cwd: string;
  ptyId: number | null;
  isActive: boolean;
  isPane?: boolean; // Mark if this is a split pane (not a tab)
}

/**
 * Terminal store state
 */
interface TerminalStore {
  sessions: TerminalSession[];
  activeSessionId: string | null;
  addSession: (session: Omit<TerminalSession, "isActive">) => void;
  removeSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  updateSessionTitle: (id: string, title: string) => void;
  reorderSessions: (oldIndex: number, newIndex: number) => void;
}

/**
 * Terminal store - manages terminal sessions (tabs, active tab, PTY ids)
 */
export const useTerminalStore = create<TerminalStore>((set) => ({
  sessions: [],
  activeSessionId: null,

  addSession: (session) =>
    set((state) => {
      // If this is a pane (not a tab), don't change active states
      if (session.isPane) {
        return {
          sessions: [...state.sessions, { ...session, isActive: false }],
        };
      }

      // For tabs, mark all others as inactive and renumber
      const newSessions = [
        ...state.sessions.map((s) => ({ ...s, isActive: false })),
        { ...session, isActive: true },
      ];
      // Renumber only tab sessions (not panes)
      const renumberedSessions = newSessions.map((s, index) => {
        if (s.isPane) return s;
        const tabIndex = newSessions.filter((ns, i) => i <= index && !ns.isPane).length;
        return {
          ...s,
          title: `⌘ ${tabIndex}`,
        };
      });
      return {
        sessions: renumberedSessions,
        activeSessionId: session.id,
      };
    }),

  removeSession: (id) =>
    set((state) => {
      const newSessions = state.sessions.filter((s) => s.id !== id);
      const wasActive = state.activeSessionId === id;

      // Renumber remaining sessions to be sequential
      const renumberedSessions = newSessions.map((s, index) => ({
        ...s,
        title: `⌘ ${index + 1}`,
      }));

      if (wasActive && renumberedSessions.length > 0) {
        const lastSession = renumberedSessions[renumberedSessions.length - 1];
        if (lastSession) {
          return {
            sessions: renumberedSessions.map((s) => ({
              ...s,
              isActive: s.id === lastSession.id,
            })),
            activeSessionId: lastSession.id,
          };
        }
      }

      return {
        sessions: renumberedSessions,
        activeSessionId: wasActive ? null : state.activeSessionId,
      };
    }),

  setActiveSession: (id) =>
    set((state) => ({
      sessions: state.sessions.map((s) => ({
        ...s,
        isActive: s.id === id,
      })),
      activeSessionId: id,
    })),

  updateSessionTitle: (id, title) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, title } : s
      ),
    })),

  reorderSessions: (oldIndex, newIndex) =>
    set((state) => {
      const reordered = arrayMove(state.sessions, oldIndex, newIndex);
      // Renumber after reordering to maintain sequential numbers
      const renumberedSessions = reordered.map((s, index) => ({
        ...s,
        title: `⌘ ${index + 1}`,
      }));
      return {
        sessions: renumberedSessions,
      };
    }),
}));
