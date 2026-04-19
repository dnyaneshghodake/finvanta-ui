/**
 * CBS Modal — confirmation / authorization dialog.
 * @file src/components/cbs/Modal.tsx
 *
 * Tier-1 CBS convention: every financial posting requires a two-step
 * confirmation. The modal traps focus (Escape to close), prevents
 * background scroll, and renders a header/body/footer structure
 * matching the cbs-surface pattern.
 *
 * Usage:
 *   <CbsModal
 *     open={showConfirm}
 *     onClose={() => setShowConfirm(false)}
 *     title="Confirm Transfer"
 *     size="md"
 *   >
 *     <CbsModal.Body>...</CbsModal.Body>
 *     <CbsModal.Footer>
 *       <button className="cbs-btn cbs-btn-secondary" onClick={cancel}>Cancel</button>
 *       <button className="cbs-btn cbs-btn-primary" onClick={confirm}>Authorize</button>
 *     </CbsModal.Footer>
 *   </CbsModal>
 */
'use client';

import { useEffect, useCallback, useRef, type ReactNode } from 'react';

export interface CbsModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  /** If true, clicking the backdrop does NOT close the modal. */
  persistent?: boolean;
}

/**
 * Ref-counted body scroll lock so nested modals (e.g. persistent
 * confirmation inside a detail modal) don't prematurely restore
 * overflow when the inner one closes.
 */
let modalCount = 0;
function lockScroll() {
  modalCount++;
  if (modalCount === 1) document.body.style.overflow = 'hidden';
}
function unlockScroll() {
  modalCount = Math.max(0, modalCount - 1);
  if (modalCount === 0) document.body.style.overflow = '';
}

const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function CbsModal({ open, onClose, title, size = 'md', children, persistent = false }: CbsModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !persistent) { onClose(); return; }
      // Focus trap — Tab cycles within the modal only (WCAG 2.4.3)
      if (e.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose, persistent],
  );

  useEffect(() => {
    if (!open) return;
    // Save the element that had focus before the modal opened
    // so we can restore it on close (WCAG 2.4.3 Focus Order).
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    document.addEventListener('keydown', handleKeyDown);
    lockScroll();
    // Focus the first focusable element inside the modal, or the
    // dialog itself if nothing is focusable.
    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    if (firstFocusable) firstFocusable.focus();
    else dialogRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      unlockScroll();
      // Restore focus to the element that triggered the modal
      previousFocusRef.current?.focus();
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  const sizeClass = size === 'sm' ? 'cbs-modal-sm' : size === 'lg' ? 'cbs-modal-lg' : 'cbs-modal-md';

  return (
    <div
      className="cbs-modal-overlay"
      onClick={() => !persistent && onClose()}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`cbs-modal ${sizeClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cbs-modal-header">
          <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
            {title}
          </span>
          {!persistent && (
            <button
              type="button"
              onClick={onClose}
              className="text-cbs-steel-500 hover:text-cbs-ink text-lg leading-none"
              aria-label="Close"
            >
              ×
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`cbs-modal-body ${className}`.trim()}>{children}</div>;
}

function ModalFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`cbs-modal-footer ${className}`.trim()}>{children}</div>;
}

CbsModal.Body = ModalBody;
CbsModal.Footer = ModalFooter;
