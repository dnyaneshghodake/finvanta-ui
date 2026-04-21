/**
 * Reusable focus trap hook for CBS modal dialogs.
 * @file src/hooks/useFocusTrap.ts
 *
 * WCAG 2.4.3 Focus Order + 2.1.2 No Keyboard Trap:
 *   - Tab cycles within the container (forward and backward).
 *   - Focus is moved to the first focusable element on activation.
 *   - Focus returns to the trigger element on deactivation.
 *
 * CBS benchmark: Tier-1 CBS confirmation dialogs, Tier-1 CBS
 * override prompts, and Oracle FLEXCUBE approval modals all trap
 * focus within the dialog while it is open. This hook provides
 * the same behaviour as a reusable primitive.
 *
 * Usage:
 *   const dialogRef = useRef<HTMLDivElement>(null);
 *   useFocusTrap(dialogRef, isOpen);
 *
 *   return isOpen ? <div ref={dialogRef}>...</div> : null;
 */

import { useEffect, useRef } from 'react';

/** CSS selector for all natively focusable elements. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Trap keyboard focus within a container element.
 *
 * @param containerRef  Ref to the DOM element that should trap focus.
 * @param active        Whether the trap is currently active.
 * @param options.initialFocus  Optional ref to the element that should
 *   receive focus when the trap activates. Defaults to the first
 *   focusable child.
 * @param options.returnFocusOnDeactivate  Whether to return focus to
 *   the previously focused element when the trap deactivates.
 *   Defaults to `true`.
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  active: boolean,
  options: {
    initialFocus?: React.RefObject<HTMLElement | null>;
    returnFocusOnDeactivate?: boolean;
  } = {},
) {
  const { initialFocus, returnFocusOnDeactivate = true } = options;

  // Store the element that was focused before the trap activated
  // so we can restore it on deactivation (WCAG focus return).
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // ── Activate: move focus into the container ──────────────────
  useEffect(() => {
    if (!active) return;

    // Capture the currently focused element for later restoration.
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // Move focus into the trap after a microtask so the container
    // DOM is fully rendered (important for conditional rendering).
    const raf = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;

      if (initialFocus?.current) {
        initialFocus.current.focus();
      } else {
        const first = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        first?.focus();
      }
    });

    return () => cancelAnimationFrame(raf);
  }, [active, containerRef, initialFocus]);

  // ── Deactivate: return focus ─────────────────────────────────
  useEffect(() => {
    if (active) return;

    if (returnFocusOnDeactivate && previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [active, returnFocusOnDeactivate]);

  // ── Tab key cycling ──────────────────────────────────────────
  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const container = containerRef.current;
      if (!container) return;

      const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [active, containerRef]);
}
