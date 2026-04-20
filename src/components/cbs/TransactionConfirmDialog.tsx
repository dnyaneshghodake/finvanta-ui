'use client';

/**
 * CBS Transaction Confirmation Dialog — 3-step financial safety.
 * @file src/components/cbs/TransactionConfirmDialog.tsx
 *
 * Tier-1 CBS standard for ALL financial operations:
 *   Step 1: INPUT    — Operator fills the form
 *   Step 2: CONFIRM  — Review all details before submission
 *   Step 3: RESULT   — Success/failure with voucher number
 *
 * This dialog handles Step 2 (Confirm). It shows a read-only summary
 * of the transaction details with a mandatory "I confirm" action.
 * The operator must explicitly click "Confirm & Submit" — there is
 * no auto-submit, no double-click, and no keyboard shortcut that
 * bypasses this step.
 *
 * CBS benchmark:
 *   Finacle: HFINTRN confirmation screen before COMMIT
 *   T24: OFS.COMMIT step with full detail review
 *   FLEXCUBE: CSTB_TXN_CONFIRM with amount-in-words
 */

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle, X, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/utils/formatters';

/* ── Types ─────────────────────────────────────────────────────── */

export interface ConfirmField {
  label: string;
  value: string | number;
  /** Highlight as amount (right-aligned, monospace). */
  isAmount?: boolean;
  /** Highlight as critical (red border, e.g. penalty amount). */
  isCritical?: boolean;
}

export interface TransactionConfirmDialogProps {
  /** Whether the dialog is visible. */
  isOpen: boolean;
  /** Called when operator cancels. */
  onCancel: () => void;
  /** Called when operator confirms — trigger the actual API call. */
  onConfirm: () => void | Promise<void>;
  /** Transaction type label (e.g. "Internal Transfer", "FD Booking"). */
  transactionType: string;
  /** Fields to display in the confirmation summary. */
  fields: ConfirmField[];
  /** Primary amount for the large display. */
  amount?: number;
  /** Currency code. Default: INR. */
  currency?: string;
  /** Optional warning message (e.g. "This transfer exceeds ₹2L — requires checker approval"). */
  warning?: string;
  /** Optional additional content below the fields. */
  children?: ReactNode;
}

/* ── Component ─────────────────────────────────────────────────── */

export function TransactionConfirmDialog({
  isOpen,
  onCancel,
  onConfirm,
  transactionType,
  fields,
  amount,
  currency = 'INR',
  warning,
  children,
}: TransactionConfirmDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false);
      setConfirmed(false);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, isSubmitting, onCancel]);

  // Focus trap
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (isSubmitting) return; // Prevent double-click
    setIsSubmitting(true);
    try {
      await onConfirm();
    } catch {
      // Error handling is done by the caller
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-cbs-ink/60 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Confirm ${transactionType}`}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="bg-cbs-paper rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cbs-steel-200 bg-cbs-navy-800 rounded-t-lg">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Confirm {transactionType}
          </h2>
          {!isSubmitting && (
            <button
              type="button"
              onClick={onCancel}
              className="p-1 rounded hover:bg-cbs-navy-700 text-cbs-navy-300"
              aria-label="Cancel"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Amount display */}
        {amount !== undefined && (
          <div className="px-5 py-4 bg-cbs-mist border-b border-cbs-steel-200 text-center">
            <div className="text-[10px] text-cbs-steel-500 uppercase tracking-wider font-semibold">
              Transaction Amount
            </div>
            <div className="text-2xl font-bold cbs-tabular text-cbs-ink mt-1">
              {formatCurrency(amount, currency)}
            </div>
          </div>
        )}

        {/* Warning */}
        {warning && (
          <div className="mx-5 mt-4 flex items-start gap-2 p-3 border border-cbs-gold-600 bg-cbs-gold-50 rounded-sm">
            <AlertTriangle size={16} className="text-cbs-gold-700 shrink-0 mt-0.5" />
            <p className="text-xs text-cbs-gold-700">{warning}</p>
          </div>
        )}

        {/* Transaction details */}
        <div className="px-5 py-4 space-y-2">
          {fields.map((field, i) => (
            <div
              key={i}
              className={`flex items-center justify-between py-2 border-b border-cbs-steel-100 last:border-0 ${
                field.isCritical ? 'bg-cbs-crimson-50 -mx-2 px-2 rounded-sm' : ''
              }`}
            >
              <span className="text-xs text-cbs-steel-600 font-medium">{field.label}</span>
              <span className={`text-xs font-semibold ${
                field.isAmount ? 'cbs-tabular text-cbs-ink' :
                field.isCritical ? 'text-cbs-crimson-700' :
                'text-cbs-ink'
              }`}>
                {field.isAmount && typeof field.value === 'number'
                  ? formatCurrency(field.value, currency)
                  : field.value}
              </span>
            </div>
          ))}
        </div>

        {/* Additional content */}
        {children && <div className="px-5 pb-4">{children}</div>}

        {/* Confirmation checkbox + actions */}
        <div className="px-5 py-4 border-t border-cbs-steel-200 bg-cbs-mist rounded-b-lg space-y-3">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={isSubmitting}
              className="mt-0.5 accent-cbs-navy-700"
            />
            <span className="text-xs text-cbs-steel-700">
              I have verified all transaction details and confirm this operation.
            </span>
          </label>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={!confirmed || isSubmitting}
              className="cbs-btn cbs-btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  <CheckCircle size={14} />
                  Confirm &amp; Submit
                </>
              )}
            </button>
            {!isSubmitting && (
              <button
                type="button"
                onClick={onCancel}
                className="cbs-btn cbs-btn-secondary"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
