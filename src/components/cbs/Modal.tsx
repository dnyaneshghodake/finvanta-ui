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

export function CbsModal({ open, onClose, title, size = 'md', children, persistent = false }: CbsModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !persistent) onClose();
    },
    [onClose, persistent],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleEscape);
    lockScroll();
    // Focus trap: focus the dialog on open
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', handleEscape);
      unlockScroll();
    };
  }, [open, handleEscape]);

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
