'use client';

/**
 * CBS Keyboard Navigation System — Tier-1 teller productivity.
 * @file src/hooks/useCbsKeyboardNav.ts
 *
 * Finacle/T24/FLEXCUBE operators rarely touch the mouse. The entire
 * workflow is driven by function keys and keyboard shortcuts:
 *
 *   F1  = Help / Context Help
 *   F2  = New Transaction (context-sensitive)
 *   F3  = Find / Search (global search focus)
 *   F4  = Close current tab / Cancel
 *   F5  = Refresh current screen
 *   F7  = Previous record / Scroll up
 *   F8  = Next record / Scroll down
 *   F9  = Print current screen
 *   F10 = Submit / Commit (form submission)
 *   Esc = Cancel / Close dialog
 *
 * Additional CBS shortcuts:
 *   Ctrl+S     = Save draft
 *   Ctrl+Enter = Submit form (alias for F10)
 *   Ctrl+P     = Print
 *   Ctrl+/     = Toggle shortcut help overlay
 *   Alt+D      = Go to Dashboard
 *   Alt+T      = Go to Transfers
 *   Alt+A      = Go to Accounts
 *   Alt+W      = Go to Workflow
 *
 * Per RBI IT Governance 2023: keyboard-only operation must be
 * possible for all critical banking functions (WCAG 2.1 §2.1.1).
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface CbsKeyAction {
  /** Human-readable label for the shortcut help overlay. */
  label: string;
  /** Handler function. Return false to allow default browser behavior. */
  handler: () => void | boolean;
  /** Category for grouping in the help overlay. */
  category?: 'navigation' | 'action' | 'form' | 'system';
}

export type CbsKeyMap = Record<string, CbsKeyAction>;

/**
 * Normalize a keyboard event into a canonical key string.
 * Examples: "F2", "Ctrl+S", "Alt+D", "Ctrl+Enter", "Escape"
 */
function normalizeKey(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');

  // Guard: e.key can be undefined for dead keys, IME composition
  // events, or browser-specific quirks. Bail out with an empty
  // string so the caller's Map lookup silently misses.
  let key = e.key;
  if (key == null) return parts.join('+') || '';

  // Normalize key name
  if (key === ' ') key = 'Space';
  if (key === 'Enter') key = 'Enter';
  if (key.length === 1) key = key.toUpperCase();

  // Don't duplicate modifier names
  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    parts.push(key);
  }

  return parts.join('+');
}

/**
 * Global CBS keyboard navigation hook.
 *
 * Provides the standard Finacle/T24 function key map plus
 * page-specific overrides. The shortcut help overlay (Ctrl+/)
 * is built-in.
 *
 * @param pageKeyMap - Page-specific shortcuts that override globals
 * @returns { isHelpOpen, toggleHelp, activeKeyMap }
 */
export function useCbsKeyboardNav(pageKeyMap: CbsKeyMap = {}) {
  const router = useRouter();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const pageKeyMapRef = useRef(pageKeyMap);
  pageKeyMapRef.current = pageKeyMap;

  const toggleHelp = useCallback(() => {
    setIsHelpOpen((prev) => !prev);
  }, []);

  // ── Global key map (always active) ──────────────────────────
  const globalKeyMap = useCallback((): CbsKeyMap => ({
    'F1': {
      label: 'Help / Shortcut Reference',
      handler: () => { setIsHelpOpen(true); },
      category: 'system',
    },
    // NOTE: F5 is intentionally NOT in the global key map.
    // Page-level useCbsKeyboard handlers own F5 behavior (e.g.
    // workflow page refreshes data, branches page reloads list).
    // The dashboard page registers its own F5: window.location.reload().
    // A global F5 here (capture phase) would override all page-specific
    // handlers because capture fires before bubble.
    'Escape': {
      label: 'Close Dialog / Cancel',
      handler: () => {
        // Close help overlay if open
        if (isHelpOpen) { setIsHelpOpen(false); return; }
        // Close any open modal (dispatch custom event)
        window.dispatchEvent(new CustomEvent('cbs:escape'));
      },
      category: 'system',
    },
    'Ctrl+/': {
      label: 'Toggle Shortcut Help',
      handler: toggleHelp,
      category: 'system',
    },
    // ── Navigation shortcuts ────────────────────────────────
    'Alt+D': {
      label: 'Go to Dashboard',
      handler: () => { router.push('/dashboard'); },
      category: 'navigation',
    },
    'Alt+T': {
      label: 'Go to Transfers',
      handler: () => { router.push('/transfers'); },
      category: 'navigation',
    },
    'Alt+A': {
      label: 'Go to Accounts',
      handler: () => { router.push('/accounts'); },
      category: 'navigation',
    },
    'Alt+W': {
      label: 'Go to Workflow',
      handler: () => { router.push('/workflow'); },
      category: 'navigation',
    },
    'Alt+L': {
      label: 'Go to Loans',
      handler: () => { router.push('/loans'); },
      category: 'navigation',
    },
  }), [router, isHelpOpen, toggleHelp]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when typing in input/textarea/select
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      const keyStr = normalizeKey(e);

      // Page-specific shortcuts take priority
      const pageAction = pageKeyMapRef.current[keyStr];
      if (pageAction) {
        // Allow input fields for Ctrl+S, Ctrl+Enter, F10 (form actions)
        if (!isInput || ['Ctrl+S', 'Ctrl+Enter', 'F10', 'Escape'].includes(keyStr)) {
          e.preventDefault();
          e.stopPropagation();
          pageAction.handler();
          return;
        }
      }

      // Global shortcuts — skip if typing in inputs (except system keys)
      const globalAction = globalKeyMap()[keyStr];
      if (globalAction) {
        const isSystemKey = keyStr.startsWith('F') || keyStr.startsWith('Alt+') ||
          keyStr === 'Escape' || keyStr === 'Ctrl+/';
        if (!isInput || isSystemKey) {
          e.preventDefault();
          e.stopPropagation();
          globalAction.handler();
        }
      }
    };

    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [globalKeyMap]);

  // Merge all active shortcuts for the help overlay
  const activeKeyMap: CbsKeyMap = {
    ...globalKeyMap(),
    ...pageKeyMapRef.current,
  };

  return { isHelpOpen, toggleHelp, activeKeyMap };
}

/**
 * Shortcut help overlay data grouped by category.
 */
export function groupShortcutsByCategory(keyMap: CbsKeyMap): Record<string, Array<{ key: string; label: string }>> {
  const groups: Record<string, Array<{ key: string; label: string }>> = {};
  for (const [key, action] of Object.entries(keyMap)) {
    const cat = action.category || 'action';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({ key, label: action.label });
  }
  return groups;
}
