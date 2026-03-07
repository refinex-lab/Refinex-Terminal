import { useEffect } from "react";
import { useActionBus } from "@/stores/action-bus-store";
import {
  KeybindingMap,
  getKeybindingsForContext,
  terminalPassthroughKeys,
} from "./default-keybindings";

/**
 * Keybinding context - determines which keybindings are active
 */
export type KeybindingContext = "global" | "terminal" | "editor";

/**
 * Normalized key event
 */
interface NormalizedKeyEvent {
  key: string;
  combo: string;
  originalEvent: KeyboardEvent;
}

/**
 * KeybindingManager - handles global keyboard shortcuts
 */
export class KeybindingManager {
  private context: KeybindingContext = "global";
  private keybindings: KeybindingMap = {};
  private userOverrides: Record<string, KeybindingMap> = {};
  private isEnabled = true;
  private isMac = false;

  constructor() {
    this.isMac = navigator.platform.toLowerCase().includes("mac");
    this.loadKeybindings();
    this.attachListeners();
  }

  /**
   * Load keybindings for current context
   */
  private loadKeybindings() {
    this.keybindings = getKeybindingsForContext(this.context, this.userOverrides);
  }

  /**
   * Attach global keydown listener
   */
  private attachListeners() {
    document.addEventListener("keydown", this.handleKeyDown, true);
  }

  /**
   * Detach listeners (cleanup)
   */
  public destroy() {
    document.removeEventListener("keydown", this.handleKeyDown, true);
  }

  /**
   * Handle keydown event
   */
  private handleKeyDown = (event: KeyboardEvent) => {
    if (!this.isEnabled) return;

    const normalized = this.normalizeKeyEvent(event);

    // Check if this is a terminal passthrough key
    if (this.context === "terminal" && this.isTerminalPassthrough(normalized.combo)) {
      return; // Let it pass through to terminal
    }

    // Look up action for this key combo
    const action = this.keybindings[normalized.combo];

    if (action) {
      // Prevent default browser behavior
      event.preventDefault();
      event.stopPropagation();

      // Dispatch action
      this.dispatchAction(action, { event: normalized.originalEvent });
    }
  };

  /**
   * Normalize keyboard event to canonical string format
   * Handles Cmd/Ctrl cross-platform normalization
   */
  private normalizeKeyEvent(event: KeyboardEvent): NormalizedKeyEvent {
    const parts: string[] = [];

    // Handle modifiers
    // On Mac: Cmd is primary, Ctrl is secondary
    // On Windows/Linux: Ctrl is primary
    if (this.isMac) {
      if (event.metaKey) parts.push("Cmd");
      if (event.ctrlKey) parts.push("Ctrl");
    } else {
      // Normalize Cmd to Ctrl on non-Mac platforms
      if (event.ctrlKey || event.metaKey) parts.push("Cmd");
    }

    if (event.altKey) parts.push("Alt");
    if (event.shiftKey) parts.push("Shift");

    // Handle key
    let key = event.key;

    // Normalize special keys
    const specialKeys: Record<string, string> = {
      " ": "Space",
      "ArrowUp": "ArrowUp",
      "ArrowDown": "ArrowDown",
      "ArrowLeft": "ArrowLeft",
      "ArrowRight": "ArrowRight",
      "Enter": "Enter",
      "Escape": "Escape",
      "Backspace": "Backspace",
      "Delete": "Delete",
      "Tab": "Tab",
      "Home": "Home",
      "End": "End",
      "PageUp": "PageUp",
      "PageDown": "PageDown",
      "F1": "F1",
      "F2": "F2",
      "F3": "F3",
      "F4": "F4",
      "F5": "F5",
      "F6": "F6",
      "F7": "F7",
      "F8": "F8",
      "F9": "F9",
      "F10": "F10",
      "F11": "F11",
      "F12": "F12",
    };

    let normalizedKey = key;
    if (specialKeys[key]) {
      normalizedKey = specialKeys[key];
    } else {
      // Normalize letter keys to uppercase
      if (key.length === 1) {
        normalizedKey = key.toUpperCase();
      }
    }

    parts.push(normalizedKey);

    const combo = parts.join("+");

    return {
      key: normalizedKey,
      combo,
      originalEvent: event,
    };
  }

  /**
   * Check if key combo should pass through to terminal
   */
  private isTerminalPassthrough(combo: string): boolean {
    return terminalPassthroughKeys.has(combo);
  }

  /**
   * Dispatch action to action bus
   */
  private dispatchAction(action: string, payload?: unknown) {
    const { dispatch } = useActionBus.getState();
    dispatch(action, payload).catch((error) => {
      console.error(`Failed to dispatch action ${action}:`, error);
    });
  }

  /**
   * Set current context
   */
  public setContext(context: KeybindingContext) {
    if (this.context !== context) {
      this.context = context;
      this.loadKeybindings();
    }
  }

  /**
   * Get current context
   */
  public getContext(): KeybindingContext {
    return this.context;
  }

  /**
   * Update user keybinding overrides
   */
  public setUserOverrides(overrides: Record<string, KeybindingMap>) {
    this.userOverrides = overrides;
    this.loadKeybindings();
  }

  /**
   * Enable/disable keybinding system
   */
  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  /**
   * Get current keybindings
   */
  public getKeybindings(): KeybindingMap {
    return { ...this.keybindings };
  }

  /**
   * Get action for a specific key combo
   */
  public getAction(combo: string): string | undefined {
    return this.keybindings[combo];
  }

  /**
   * Check if a key combo is bound
   */
  public isBound(combo: string): boolean {
    return combo in this.keybindings;
  }
}

// Singleton instance
let keybindingManagerInstance: KeybindingManager | null = null;

/**
 * Get or create the global keybinding manager instance
 */
export function getKeybindingManager(): KeybindingManager {
  if (!keybindingManagerInstance) {
    keybindingManagerInstance = new KeybindingManager();
  }
  return keybindingManagerInstance;
}

/**
 * Destroy the global keybinding manager instance
 */
export function destroyKeybindingManager() {
  if (keybindingManagerInstance) {
    keybindingManagerInstance.destroy();
    keybindingManagerInstance = null;
  }
}

/**
 * React hook to use keybinding manager
 */
export function useKeybindingManager() {
  return getKeybindingManager();
}

/**
 * React hook to register an action handler
 */
export function useActionHandler(action: string, handler: () => void | Promise<void>) {
  const { register } = useActionBus();

  // Register on mount, unregister on unmount
  useEffect(() => {
    const unregister = register(action, handler);
    return unregister;
  }, [action, handler, register]);
}

// Export for use in non-React contexts
export { useActionBus };
