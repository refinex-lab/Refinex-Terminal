import { create } from "zustand";

/**
 * Action handler function type
 */
export type ActionHandler = (payload?: unknown) => void | Promise<void>;

/**
 * Action bus store for dispatching keybinding actions
 */
interface ActionBusState {
  handlers: Map<string, Set<ActionHandler>>;
  register: (action: string, handler: ActionHandler) => () => void;
  unregister: (action: string, handler: ActionHandler) => void;
  dispatch: (action: string, payload?: unknown) => Promise<void>;
}

export const useActionBus = create<ActionBusState>((set, get) => ({
  handlers: new Map(),

  /**
   * Register an action handler
   * Returns an unregister function
   */
  register: (action: string, handler: ActionHandler) => {
    const { handlers } = get();

    if (!handlers.has(action)) {
      handlers.set(action, new Set());
    }

    handlers.get(action)!.add(handler);
    set({ handlers: new Map(handlers) });

    // Return unregister function
    return () => {
      get().unregister(action, handler);
    };
  },

  /**
   * Unregister an action handler
   */
  unregister: (action: string, handler: ActionHandler) => {
    const { handlers } = get();

    if (handlers.has(action)) {
      handlers.get(action)!.delete(handler);

      if (handlers.get(action)!.size === 0) {
        handlers.delete(action);
      }

      set({ handlers: new Map(handlers) });
    }
  },

  /**
   * Dispatch an action to all registered handlers
   */
  dispatch: async (action: string, payload?: unknown) => {
    const { handlers } = get();

    if (!handlers.has(action)) {
      console.warn(`No handlers registered for action: ${action}`);
      return;
    }

    const actionHandlers = Array.from(handlers.get(action)!);

    // Execute all handlers in parallel
    await Promise.all(
      actionHandlers.map(handler => {
        try {
          return Promise.resolve(handler(payload));
        } catch (error) {
          console.error(`Error executing handler for action ${action}:`, error);
          return Promise.resolve();
        }
      })
    );
  },
}));
