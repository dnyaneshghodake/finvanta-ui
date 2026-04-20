'use client';

/**
 * Keyboard Shortcut Help Overlay — CBS teller productivity aid.
 * @file src/components/cbs/KeyboardHelpOverlay.tsx
 *
 * Activated by F1 or Ctrl+/. Shows all active shortcuts grouped
 * by category (system, navigation, action, form). Dismissed by
 * Escape or clicking outside.
 *
 * CBS benchmark: Finacle shows "Key Help" via F1; T24 has a
 * similar shortcut reference accessible from every screen.
 */

import { useEffect, useRef } from 'react';
import { X, Keyboard } from 'lucide-react';
import type { CbsKeyMap } from '@/hooks/useCbsKeyboardNav';
import { groupShortcutsByCategory } from '@/hooks/useCbsKeyboardNav';

const CATEGORY_LABELS: Record<string, string> = {
  system: 'System',
  navigation: 'Navigation',
  action: 'Actions',
  form: 'Form Controls',
};

const CATEGORY_ORDER = ['system', 'navigation', 'action', 'form'];

interface KeyboardHelpOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  keyMap: CbsKeyMap;
}

export function KeyboardHelpOverlay({ isOpen, onClose, keyMap }: KeyboardHelpOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const groups = groupShortcutsByCategory(keyMap);

  return (
    <div className="fixed inset-0 bg-cbs-ink/50 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div ref={overlayRef} className="bg-cbs-paper rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cbs-steel-200">
          <div className="flex items-center gap-2">
            <Keyboard size={18} className="text-cbs-navy-700" />
            <h2 className="text-sm font-bold text-cbs-ink uppercase tracking-wider">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-cbs-mist"
            aria-label="Close shortcut help"
          >
            <X size={16} className="text-cbs-steel-600" />
          </button>
        </div>

        {/* Shortcut groups */}
        <div className="px-5 py-4 space-y-5">
          {CATEGORY_ORDER.map((cat) => {
            const items = groups[cat];
            if (!items || items.length === 0) return null;
            return (
              <div key={cat}>
                <h3 className="text-[10px] font-bold text-cbs-steel-500 uppercase tracking-widest mb-2">
                  {CATEGORY_LABELS[cat] || cat}
                </h3>
                <div className="space-y-1">
                  {items.map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between py-1">
                      <span className="text-xs text-cbs-steel-700">{label}</span>
                      <kbd className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-cbs-mist border border-cbs-steel-200 rounded text-[11px] font-mono text-cbs-ink">
                        {key.split('+').map((part, i) => (
                          <span key={i}>
                            {i > 0 && <span className="text-cbs-steel-400 mx-0.5">+</span>}
                            {part}
                          </span>
                        ))}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-cbs-steel-200 bg-cbs-mist rounded-b-lg">
          <p className="text-[10px] text-cbs-steel-500 text-center">
            Press <kbd className="px-1 py-0.5 bg-white border border-cbs-steel-200 rounded text-[10px] font-mono">Esc</kbd> to close
            {' · '}
            <kbd className="px-1 py-0.5 bg-white border border-cbs-steel-200 rounded text-[10px] font-mono">Ctrl+/</kbd> to toggle
          </p>
        </div>
      </div>
    </div>
  );
}
