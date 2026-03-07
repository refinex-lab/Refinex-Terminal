/**
 * Focus Management System
 * Manages keyboard focus order and focus trapping
 */

/**
 * Focus trap for modals and dialogs
 */
export function trapFocus(element: HTMLElement) {
  const focusableElements = element.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    }
  };

  element.addEventListener("keydown", handleKeyDown);

  // Focus first element
  firstFocusable?.focus();

  return () => {
    element.removeEventListener("keydown", handleKeyDown);
  };
}

/**
 * Get all focusable elements in the document
 */
export function getFocusableElements(): HTMLElement[] {
  const selector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(document.querySelectorAll<HTMLElement>(selector));
}

/**
 * Focus management zones
 */
export enum FocusZone {
  Sidebar = "sidebar",
  Terminal = "terminal",
  TabBar = "tabbar",
  StatusBar = "statusbar",
  Modal = "modal",
}

/**
 * Focus manager class
 */
class FocusManager {
  private currentZone: FocusZone | null = null;
  private previousElement: HTMLElement | null = null;

  /**
   * Set focus to a specific zone
   */
  setZone(zone: FocusZone) {
    this.currentZone = zone;
    const element = this.getZoneElement(zone);
    if (element) {
      this.previousElement = document.activeElement as HTMLElement;
      element.focus();
    }
  }

  /**
   * Get the root element for a zone
   */
  private getZoneElement(zone: FocusZone): HTMLElement | null {
    switch (zone) {
      case FocusZone.Sidebar:
        return document.querySelector('[data-focus-zone="sidebar"]');
      case FocusZone.Terminal:
        return document.querySelector('[data-focus-zone="terminal"]');
      case FocusZone.TabBar:
        return document.querySelector('[data-focus-zone="tabbar"]');
      case FocusZone.StatusBar:
        return document.querySelector('[data-focus-zone="statusbar"]');
      case FocusZone.Modal:
        return document.querySelector('[data-focus-zone="modal"]');
      default:
        return null;
    }
  }

  /**
   * Return focus to previous element
   */
  restoreFocus() {
    if (this.previousElement) {
      this.previousElement.focus();
      this.previousElement = null;
    }
  }

  /**
   * Get current zone
   */
  getCurrentZone(): FocusZone | null {
    return this.currentZone;
  }
}

export const focusManager = new FocusManager();

/**
 * Hook for focus trap
 */
import { useEffect, useRef } from "react";

export function useFocusTrap(isActive: boolean) {
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isActive || !elementRef.current) return;

    const cleanup = trapFocus(elementRef.current);
    return cleanup;
  }, [isActive]);

  return elementRef;
}

/**
 * Hook for focus zone
 */
export function useFocusZone(zone: FocusZone) {
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (elementRef.current) {
      elementRef.current.setAttribute("data-focus-zone", zone);
    }
  }, [zone]);

  return elementRef;
}
