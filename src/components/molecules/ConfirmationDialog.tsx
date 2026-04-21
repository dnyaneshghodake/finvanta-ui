/**
 * CBS Confirmation Dialog — Tier-1 destructive action gate.
 * @file src/components/molecules/ConfirmationDialog.tsx
 *
 * Used for irreversible operations: account close, freeze, loan
 * disburse, user lock, etc. CBS convention requires explicit
 * confirmation with a descriptive warning before any destructive
 * or high-value action.
 *
 * WCAG compliance:
 *   - role="alertdialog" with aria-describedby
 *   - Focus trapped within dialog (via useFocusTrap)
 *   - Focus returns to trigger on close
 *   - Cancel button auto-focused (safe default)
 *
 * CBS benchmark: Finacle HACL (account close) and T24 FUNDS.TRANSFER
 * both show a confirmation dialog with operation summary before
 * commit. This component provides the same pattern.
 *
 * Zero business logic: receives all data via props. The parent
 * component owns the API call and error handling.
 *
 * Usage:
 *   <ConfirmationDialog
 *     open={showConfirm}
 *     title="Close Account"
 *     description="This will permanently close account SB-HQ001-000001."
 *     severity="danger"
 *     confirmLabel="Close Account"
 *     onConfirm={handleClose}
 *     onCancel={() => setShowConfirm(false)}
 *     loading={isClosing}
 *   />
 */

'use client';

import React, { useRef } from 'react';
import clsx from 'clsx';
import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export type ConfirmationSeverity = 'info' | 'warning' | 'danger';

export interface ConfirmationDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Dialog title (e.g. "Close Account"). */
  title: string;
  /** Descriptive warning text. */
  description: string;
  /** Optional detail lines (e.g. account number, amount). */
  details?: Array<{ label: string; value: string }>;
  /** Visual severity — controls icon and confirm button colour. */
  severity?: ConfirmationSeverity;
  /** Label for the confirm button. Default: "Confirm". */
  confirmLabel?: string;
  /** Label for the cancel button. Default: "Cancel". */
  cancelLabel?: string;
  /** Called when the operator confirms the action. */
  onConfirm: () => void;
  /** Called when the operator cancels. */
  onCancel: () => void;
  /** Whether the confirm action is in progress (shows spinner). */
  loading?: boolean;
}

const SEVERITY_CONFIG: Record<
  ConfirmationSeverity,
  { icon: React.FC<{ size: number; strokeWidth: number; className: string }>; iconTone: string; btnClass: string }
> = {
  info: {
    icon: Info,
    iconTone: 'text-cbs-navy-700 bg-cbs-navy-50 border-cbs-navy-200',
    btnClass: 'cbs-btn cbs-btn-primary',
  },
  warning: {
    icon: AlertTriangle,
    iconTone: 'text-cbs-gold-700 bg-cbs-gold-50 border-cbs-gold-600',
    btnClass: 'cbs-btn cbs-btn-primary',
  },
  danger: {
    icon: ShieldAlert,
    iconTone: 'text-cbs-crimson-700 bg-cbs-crimson-50 border-cbs-crimson-600',
    btnClass: 'cbs-btn cbs-btn-danger',
  },
};

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  open,
  title,
  description,
  details,
  severity = 'warning',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  loading = false,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus trap with cancel button as initial focus (safe default —
  // operator must deliberately move to confirm).
  useFocusTrap(dialogRef, open, {
    initialFocus: cancelRef,
    returnFocusOnDeactivate: true,
  });

  if (!open) return null;

  const config = SEVERITY_CONFIG[severity];
  const IconComponent = config.icon;

  return (
    <div
      className="fixed inset-0 bg-cbs-ink/60 flex items-center justify-center p-4"
      style={{ zIndex: 'var(--z-cbs-modal, 100)' }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cbs-confirm-title"
        aria-describedby="cbs-confirm-desc"
        className="cbs-modal cbs-modal-sm mx-4"
      >
        {/* Header */}
        <div className="cbs-modal-header">
          <h2 id="cbs-confirm-title" className="text-sm font-bold text-cbs-ink uppercase tracking-wider">
            {title}
          </h2>
        </div>

        {/* Body */}
        <div className="cbs-modal-body space-y-3">
          <div className="flex items-start gap-3">
            <div className={clsx(
              'flex items-center justify-center h-9 w-9 rounded-sm border shrink-0',
              config.iconTone,
            )}>
              <IconComponent size={18} strokeWidth={1.75} className="text-current" />
            </div>
            <p id="cbs-confirm-desc" className="text-sm text-cbs-steel-700 leading-relaxed">
              {description}
            </p>
          </div>

          {/* Optional detail lines */}
          {details && details.length > 0 && (
            <div className="bg-cbs-mist rounded-sm p-3 space-y-1.5">
              {details.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="cbs-field-label">{d.label}</span>
                  <span className="cbs-field-value cbs-tabular text-xs">{d.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="cbs-modal-footer">
          <button
            ref={cancelRef}
            type="button"
            className="cbs-btn cbs-btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={config.btnClass}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

ConfirmationDialog.displayName = 'ConfirmationDialog';

export { ConfirmationDialog };
