'use client';

/**
 * Read-only status card for the operator's till.
 *
 * Renders the till's lifecycle state (PENDING_OPEN / OPEN /
 * PENDING_CLOSE / CLOSED / SUSPENDED), opening + current balance,
 * timestamps, and (when applicable) the counted balance + variance
 * captured at close-request time.
 *
 * Pure presentational — no store reads or actions. Composed under
 * `app/teller/till/page.tsx` above the close form.
 *
 * @file src/components/teller/TillStatusCard.tsx
 */
import type { TellerTill, TillStatus } from '@/types/teller.types';
import { formatCurrency, formatCbsTimestamp } from '@/utils/formatters';

function statusBadgeClass(status: TillStatus): string {
  switch (status) {
    case 'OPEN':
      return 'cbs-ribbon text-cbs-emerald-700 bg-cbs-emerald-50';
    case 'PENDING_OPEN':
    case 'PENDING_CLOSE':
      return 'cbs-ribbon text-cbs-gold-700 bg-cbs-gold-50';
    case 'CLOSED':
      return 'cbs-ribbon text-cbs-steel-700 bg-cbs-steel-100';
    case 'SUSPENDED':
      return 'cbs-ribbon text-cbs-crimson-700 bg-cbs-crimson-50';
    default:
      return 'cbs-ribbon';
  }
}

function statusLabel(status: TillStatus): string {
  switch (status) {
    case 'PENDING_OPEN':
      return 'Pending Supervisor Approval (Open)';
    case 'OPEN':
      return 'Open';
    case 'PENDING_CLOSE':
      return 'Pending Supervisor Approval (Close)';
    case 'CLOSED':
      return 'Closed';
    case 'SUSPENDED':
      return 'Suspended';
    default:
      return status;
  }
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
  /** When true, render with `cbs-tabular` for monospaced numerics. */
  numeric?: boolean;
}

function Field({ label, children, numeric }: FieldProps) {
  return (
    <div>
      <div className="cbs-field-label">{label}</div>
      <div className={`text-sm text-cbs-ink ${numeric ? 'cbs-tabular' : ''}`}>
        {children}
      </div>
    </div>
  );
}

export function TillStatusCard({ till }: { till: TellerTill }) {
  const showCloseDetails =
    till.status === 'PENDING_CLOSE' || till.status === 'CLOSED';

  return (
    <section className="cbs-surface" aria-labelledby="till-status-heading">
      <div className="cbs-surface-header">
        <div
          id="till-status-heading"
          className="text-sm font-semibold tracking-wide uppercase text-cbs-steel-700"
        >
          Till Status
        </div>
        <span className={statusBadgeClass(till.status)}>
          {statusLabel(till.status)}
        </span>
      </div>
      <div className="cbs-surface-body">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Teller ID">{till.tellerUserId}</Field>
          <Field label="Branch">
            {till.branchName
              ? `${till.branchName} (${till.branchCode})`
              : till.branchCode}
          </Field>
          <Field label="Business Date">{till.businessDate}</Field>
          <Field label="Opened At">
            {till.openedAt ? formatCbsTimestamp(till.openedAt) : '—'}
          </Field>
          <Field label="Opening Balance" numeric>
            {formatCurrency(till.openingBalance)}
          </Field>
          <Field label="Current Balance" numeric>
            {formatCurrency(till.currentBalance)}
          </Field>
          {till.tillCashLimit !== null && (
            <Field label="Till Cash Limit" numeric>
              {formatCurrency(till.tillCashLimit)}
            </Field>
          )}
          {till.openedBySupervisor && (
            <Field label="Opened By Supervisor">
              {till.openedBySupervisor}
            </Field>
          )}

          {showCloseDetails && (
            <>
              <Field label="Counted Balance" numeric>
                {till.countedBalance !== null
                  ? formatCurrency(till.countedBalance)
                  : '—'}
              </Field>
              <Field label="Variance" numeric>
                {till.varianceAmount !== null ? (
                  <span
                    className={
                      till.varianceAmount === 0
                        ? 'text-cbs-emerald-700'
                        : 'text-cbs-crimson-700'
                    }
                  >
                    {till.varianceAmount >= 0 ? '+' : ''}
                    {formatCurrency(till.varianceAmount)}
                    {till.varianceAmount === 0 ? ' (balanced)' : ''}
                  </span>
                ) : (
                  '—'
                )}
              </Field>
              {till.closedAt && (
                <Field label="Closed At">
                  {formatCbsTimestamp(till.closedAt)}
                </Field>
              )}
              {till.closedBySupervisor && (
                <Field label="Closed By Supervisor">
                  {till.closedBySupervisor}
                </Field>
              )}
            </>
          )}

          {till.remarks && (
            <div className="sm:col-span-2">
              <Field label="Remarks">{till.remarks}</Field>
            </div>
          )}
        </dl>
      </div>
    </section>
  );
}
