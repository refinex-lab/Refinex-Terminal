import { create } from "zustand";

/**
 * Terminal session type
 */
export interface TerminalSession {
  id: string;
  title: string;
  cwd: string;
  ptyId: number | null;
  isActive: boolean;
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
}

/**
 * Terminal store - manages terminal sessions (tabs, active tab, PTY ids)
 */
export const useTerminalStore = create<TerminalStore>((set) => ({
  sessions: [],
  activeSessionId: null,

  addSession: (session) =>
    set((state) => ({
      sessions: [
        ...state.sessions.map((s) => ({ ...s, isActive: false })),
        { ...session, isActive: true },
      ],
      activeSessionId: session.id,
    })),

  removeSession: (id) =>
    set((state) => {
      const newSessions = state.sessions.filter((s) => s.id !== id);
      const wasActive = state.activeSessionId === id;

      if (wasActive && newSessions.length > 0) {
        const lastSession = newSessions[newSessions.length - 1];
        if (lastSession) {
          return {
            sessions: newSessions.map((s) => ({
              ...s,
              isActive: s.id === lastSession.id,
            })),
            activeSessionId: lastSession.id,
          };
        }
      }

      return {
        sessions: newSessions,
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
}));
