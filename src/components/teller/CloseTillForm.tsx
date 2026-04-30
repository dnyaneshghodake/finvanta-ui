'use client';

/**
 * Form to request till close at end-of-day.
 *
 * Operator counts physical cash and submits the total. Server
 * computes `varianceAmount = countedBalance - currentBalance` and
 * transitions the till to PENDING_CLOSE; CHECKER approves to CLOSED.
 *
 * UI shows a live variance preview as the operator types so a typo
 * is caught BEFORE submission. The preview is informational only —
 * the server is authoritative.
 *
 * @file src/components/teller/CloseTillForm.tsx
 */
import { useState } from 'react';
import { useTellerStore } from '@/store/tellerStore';
import type { TellerTill } from '@/types/teller.types';
import { formatCurrency } from '@/utils/formatters';

export function CloseTillForm({ till }: { till: TellerTill }) {
  const requestClose = useTellerStore((s) => s.requestClose);
  const isLoading = useTellerStore((s) => s.isLoading);
  const [counted, setCounted] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const variancePreview = (() => {
    if (counted.trim() === '') return null;
    const c = Number(counted);
    if (!Number.isFinite(c)) return null;
    return c - till.currentBalance;
  })();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const c = Number(counted);
    if (!Number.isFinite(c) || c < 0) {
      setSubmitError('Counted balance must be a non-negative number.');
      return;
    }
    try {
      await requestClose({
        countedBalance: c,
        remarks: remarks.trim() || undefined,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not request close');
    }
  };

  return (
    <form onSubmit={onSubmit} className="cbs-surface" noValidate>
      <div className="cbs-surface-header">
        <div className="text-sm font-semibold tracking-wide uppercase text-cbs-steel-700">
          Request Till Close
        </div>
        <span className="cbs-ribbon text-cbs-gold-700 bg-cbs-gold-50">
          End of Day
        </span>
      </div>
      <div className="cbs-surface-body space-y-4">
        <p className="text-sm text-cbs-steel-600">
          Count the physical cash in your drawer and enter the total.
          The system will compute variance against the current ledger
          balance ({formatCurrency(till.currentBalance)}). A CHECKER must
          approve before the till is permanently CLOSED.
        </p>

        {submitError && (
          <div role="alert" className="cbs-alert cbs-alert-error">
            <div className="text-sm">{submitError}</div>
          </div>
        )}

        <div>
          <label htmlFor="counted" className="cbs-field-label block mb-1">
            Counted Balance (INR)
          </label>
          <input
            id="counted"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            required
            autoFocus
            className="cbs-input cbs-tabular"
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
          />
          {variancePreview !== null && (
            <div
              className={`mt-1 text-xs cbs-tabular ${
                variancePreview === 0
                  ? 'text-cbs-emerald-700'
                  : 'text-cbs-crimson-700'
              }`}
            >
              Variance preview: {variancePreview >= 0 ? '+' : ''}
              {formatCurrency(variancePreview)}
              {variancePreview === 0 ? ' (balanced)' : ''}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="closeRemarks" className="cbs-field-label block mb-1">
            Remarks (optional)
          </label>
          <input
            id="closeRemarks"
            type="text"
            maxLength={500}
            className="cbs-input"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. Variance reconciled with petty-cash voucher"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="cbs-btn cbs-btn-primary text-sm uppercase tracking-wider"
          style={{ height: 40 }}
        >
          {isLoading ? 'Submitting…' : 'Request Close'}
        </button>
      </div>
    </form>
  );
}
