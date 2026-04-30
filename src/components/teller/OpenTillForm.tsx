'use client';

/**
 * Form to open a till at start-of-day.
 *
 * Submits opening cash, optional till cash limit, and optional
 * remarks. Above the dual-control threshold the resulting till lands
 * in PENDING_OPEN (CHECKER must approve). The submit button is
 * disabled while the request is in flight to prevent double-submits.
 *
 * @file src/components/teller/OpenTillForm.tsx
 */
import { useState } from 'react';
import { useTellerStore } from '@/store/tellerStore';

export function OpenTillForm() {
  const openTill = useTellerStore((s) => s.openTill);
  const isLoading = useTellerStore((s) => s.isLoading);
  const [openingBalance, setOpeningBalance] = useState<string>('');
  const [tillCashLimit, setTillCashLimit] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const amount = Number(openingBalance);
    if (!Number.isFinite(amount) || amount < 0) {
      setSubmitError('Opening balance must be a non-negative number.');
      return;
    }
    const limit = tillCashLimit.trim() === '' ? null : Number(tillCashLimit);
    if (limit !== null && (!Number.isFinite(limit) || limit < 0)) {
      setSubmitError('Till cash limit must be a non-negative number, or empty.');
      return;
    }

    try {
      await openTill({
        openingBalance: amount,
        tillCashLimit: limit,
        remarks: remarks.trim() || undefined,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not open till');
    }
  };

  return (
    <form onSubmit={onSubmit} className="cbs-surface" noValidate>
      <div className="cbs-surface-header">
        <div className="text-sm font-semibold tracking-wide uppercase text-cbs-steel-700">
          Open Till for Today
        </div>
        <span className="cbs-ribbon text-cbs-violet-700 bg-cbs-violet-50">
          Start of Day
        </span>
      </div>
      <div className="cbs-surface-body space-y-4">
        <p className="text-sm text-cbs-steel-600">
          Enter the physical cash you are receiving at the start of the
          business day. Above the dual-control threshold a CHECKER must
          approve before the till transitions to OPEN.
        </p>

        {submitError && (
          <div role="alert" className="cbs-alert cbs-alert-error">
            <div className="text-sm">{submitError}</div>
          </div>
        )}

        <div>
          <label htmlFor="openingBalance" className="cbs-field-label block mb-1">
            Opening Balance (INR)
          </label>
          <input
            id="openingBalance"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            required
            autoFocus
            className="cbs-input cbs-tabular"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="tillCashLimit" className="cbs-field-label block mb-1">
            Till Cash Limit (optional)
          </label>
          <input
            id="tillCashLimit"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            className="cbs-input cbs-tabular"
            value={tillCashLimit}
            onChange={(e) => setTillCashLimit(e.target.value)}
            placeholder="Defaults to product configuration"
          />
        </div>

        <div>
          <label htmlFor="remarks" className="cbs-field-label block mb-1">
            Remarks (optional)
          </label>
          <input
            id="remarks"
            type="text"
            maxLength={500}
            className="cbs-input"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. Morning shift"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="cbs-btn cbs-btn-primary text-sm uppercase tracking-wider"
          style={{ height: 40 }}
        >
          {isLoading ? 'Opening…' : 'Open Till'}
        </button>
      </div>
    </form>
  );
}
