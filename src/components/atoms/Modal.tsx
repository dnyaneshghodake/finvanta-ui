/**
 * Modal primitive component for CBS Banking Application.
 * @file src/components/atoms/Modal.tsx
 *
 * Headless modal with React portal, focus trap, backdrop click
 * dismiss, and Escape key handling. This is the L1/L2 primitive
 * that ConfirmationDialog and future modals build upon.
 *
 * Renders into a portal (document.body) so the modal is always
 * above the stacking context of the parent component — critical
 * for CBS screens where modals may be triggered from within
 * deeply nested table rows or sidebar panels.
 *
 * WCAG compliance:
 *   - role="dialog" or role="alertdialog" (configurable)
 *   - aria-modal="true"
 *   - aria-labelledby / aria-describedby
 *   - Focus trapped via useFocusTrap hook
 *   - Focus returns to trigger on close
 *   - Escape key closes (configurable)
 *   - Backdrop click closes (configurable)
 *
 * Usage:
 *   <Modal open={isOpen} onClose={close} title="Edit Customer">
 *     <Modal.Header>Edit Customer CIF</Modal.Header>
 *     <Modal.Body>...form...</Modal.Body>
 *     <Modal.Footer>...buttons...</Modal.Footer>
 *   </Modal>
 */

'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export type ModalSize = 'sm' | 'md' | 'lg';
export type ModalRole = 'dialog' | 'alertdialog';

export interface ModalProps {
  /** Whether the modal is open. */
  open: boolean;
  /** Called when the modal should close. */
  onClose: () => void;
  /** Modal size. Default: md. */
  size?: ModalSize;
  /** ARIA role. Use 'alertdialog' for confirmations. Default: dialog. */
  role?: ModalRole;
  /** Title for aria-labelledby (also rendered in default header). */
  title?: string;
  /** Whether clicking the backdrop closes the modal. Default: true. */
  closeOnBackdrop?: boolean;
  /** Whether pressing Escape closes the modal. Default: true. */
  closeOnEscape?: boolean;
  /** Whether to show the close (X) button. Default: true. */
  showCloseButton?: boolean;
  /** Additional CSS class for the modal container. */
  className?: string;
  /** Modal content. */
  children: React.ReactNode;
}

const SIZE_MAP: Record<ModalSize, string> = {
  sm: 'cbs-modal-sm',
  md: 'cbs-modal-md',
  lg: 'cbs-modal-lg',
};

const Modal: React.FC<ModalProps> & {
  Header: typeof ModalHeader;
  Body: typeof ModalBody;
  Footer: typeof ModalFooter;
} = ({
  open,
  onClose,
  size = 'md',
  role: dialogRole = 'dialog',
  title,
  closeOnBackdrop = true,
  closeOnEscape = true,
  showCloseButton = true,
  className,
  children,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, open, {
    returnFocusOnDeactivate: true,
  });

  // Escape key handler
  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, closeOnEscape, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (closeOnBackdrop && e.target === e.currentTarget) {
        onClose();
      }
    },
    [closeOnBackdrop, onClose],
  );

  if (!open) return null;

  // SSR guard — portal requires document.body
  if (typeof document === 'undefined') return null;

  const titleId = title ? 'cbs-modal-title' : undefined;

  return createPortal(
    <div
      className="fixed inset-0 bg-cbs-ink/60 flex items-center justify-center p-4"
      style={{ zIndex: 'var(--z-cbs-modal, 100)' }}
      role="presentation"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        role={dialogRole}
        aria-modal="true"
        aria-labelledby={titleId}
        className={clsx('cbs-modal', SIZE_MAP[size], 'mx-4', className)}
      >
        {/* Default header with title + close button */}
        {(title || showCloseButton) && (
          <div className="cbs-modal-header">
            {title && (
              <h2
                id={titleId}
                className="text-sm font-bold text-cbs-ink uppercase tracking-wider"
              >
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded hover:bg-cbs-steel-100 text-cbs-steel-500 hover:text-cbs-ink transition-colors"
                aria-label="Close dialog"
              >
                <X size={16} strokeWidth={2} />
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
};

/* ── Sub-components for structured content ──────────────────── */

function ModalHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx('cbs-modal-header', className)}>{children}</div>;
}
ModalHeader.displayName = 'Modal.Header';

function ModalBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx('cbs-modal-body', className)}>{children}</div>;
}
ModalBody.displayName = 'Modal.Body';

function ModalFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx('cbs-modal-footer', className)}>{children}</div>;
}
ModalFooter.displayName = 'Modal.Footer';

Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;
Modal.displayName = 'Modal';

export { Modal };
