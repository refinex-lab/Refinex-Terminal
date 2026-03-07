import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";

/**
 * Global terminal instance manager
 * Manages terminal lifecycle independently of React component lifecycle
 */

interface TerminalInstance {
  terminal: Terminal;
  fitAddon: FitAddon;
  searchAddon: SearchAddon;
  container: HTMLDivElement;
  cleanupListeners: (() => void) | undefined;
  disposable: any; // terminal.onData disposable
  resizeObserver: ResizeObserver;
}

class TerminalManager {
  private instances = new Map<string, TerminalInstance>();

  /**
   * Get or create a terminal instance
   */
  getInstance(sessionId: string): TerminalInstance | null {
    return this.instances.get(sessionId) || null;
  }

  /**
   * Register a new terminal instance
   */
  registerInstance(sessionId: string, instance: TerminalInstance): void {
    this.instances.set(sessionId, instance);
  }

  /**
   * Check if a terminal instance exists
   */
  hasInstance(sessionId: string): boolean {
    return this.instances.has(sessionId);
  }

  /**
   * Destroy a terminal instance
   */
  destroyInstance(sessionId: string): void {
    const instance = this.instances.get(sessionId);
    if (instance) {
      // Clean up listeners
      if (instance.cleanupListeners) {
        instance.cleanupListeners();
      }
      // Dispose terminal input handler
      if (instance.disposable) {
        instance.disposable.dispose();
      }
      // Disconnect resize observer
      if (instance.resizeObserver) {
        instance.resizeObserver.disconnect();
      }
      // Dispose terminal
      instance.terminal.dispose();
 // Remove container from DOM
      if (instance.container.parentNode) {
        instance.container.parentNode.removeChild(instance.container);
      }
      // Remove from registry
      this.instances.delete(sessionId);
    }
  }

  /**
   * Get all registered session IDs
   */
  getAllSessionIds(): string[] {
    return Array.from(this.instances.keys());
  }
}

// Singleton instance
export const terminalManager = new TerminalManager();
