/**
 * CBS Keyboard Shortcuts — teller productivity shortcuts.
 * @file src/hooks/useCbsKeyboard.ts
 *
 * Tier-1 CBS convention: tellers process 200+ transactions/day and
 * rarely touch the mouse. Standard shortcuts:
 *   F2  = New transaction / transfer
 *   F5  = Refresh current view
 *   F7  = Toggle inquiry mode
 *   F8  = Execute / Post / Submit
 *   Esc = Cancel / Close modal
 *
 * Usage:
 *   useCbsKeyboard({
 *     'F2':  () => router.push('/transfers'),
 *     'F5':  () => refetch(),
 *     'F8':  () => handleSubmit(),
 *   });
 */
import { useEffect, useCallback } from 'react';

export type CbsShortcutMap = Record<string, () => void>;

export function useCbsKeyboard(shortcuts: CbsShortcutMap, enabled = true): void {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Don't intercept when user is typing in an input/textarea/select
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        // Allow F-keys even in inputs (CBS convention)
        if (!e.key.startsWith('F')) return;
      }

      const fn = shortcuts[e.key];
      if (fn) {
        e.preventDefault();
        e.stopPropagation();
        fn();
      }
    },
    [shortcuts, enabled],
  );

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handler, enabled]);
}

/**
 * Render a keyboard shortcut badge for display in buttons/menus.
 * Pure function, not a hook — safe to call in render.
 */
export function kbdLabel(key: string): string {
  const map: Record<string, string> = {
    F2: 'F2', F5: 'F5', F7: 'F7', F8: 'F8',
    Escape: 'Esc', Enter: '↵', Tab: '⇥',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  };
  return map[key] || key;
}
