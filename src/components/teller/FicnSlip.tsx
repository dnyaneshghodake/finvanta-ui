'use client';

/**
 * FICN Customer Acknowledgement Slip.
 *
 * Rendered when a cash deposit is rejected with HTTP 422 +
 * `CBS-TELLER-008`. Per RBI Master Direction on Counterfeit Notes
 * the bank MUST issue the depositor a printed acknowledgement
 * carrying the permanent register reference, the impounded
 * denomination breakdown, and (when applicable) a "FIR mandatory"
 * marker. The slip is the customer's only proof that the bank took
 * physical custody of the impounded notes.
 *
 * Pure presentational. Backed by a real `counterfeit_note_register`
 * row committed in a REQUIRES_NEW sub-transaction on the server side
 * — the slip is never speculative; if the operator sees it, the
 * register row already exists. The originating deposit transaction
 * is rolled back, so the customer's account balance is UNCHANGED.
 *
 * @file src/components/teller/FicnSlip.tsx
 */
import type { FicnAcknowledgement } from '@/types/teller.types';
import { DENOMINATION_LABEL, DENOMINATION_ORDER } from '@/utils/denominations';
import { formatCbsDate, formatCbsTimestamp, formatCurrency } from '@/utils/formatters';

interface FicnSlipProps {
  slip: FicnAcknowledgement;
  /** Server-supplied human-readable summary (carried on the 422 envelope). */
  message: string;
}

/**
 * Sort the impounded lines by canonical denomination order (highest
 * face value first) so the slip is operator-readable regardless of
 * the order the server returned them in.
 */
function sortImpounded(lines: FicnAcknowledgement['impoundedDenominations']) {
  const order = new Map(DENOMINATION_ORDER.map((d, i) => [d, i]));
  return [...lines].sort(
    (a, b) => (order.get(a.denomination) ?? 99) - (order.get(b.denomination) ?? 99),
  );
}

export function FicnSlip({ slip, message }: FicnSlipProps) {
  const impounded = sortImpounded(slip.impoundedDenominations);
  const hasDepositorInfo =
    slip.depositorName ||
    slip.depositorIdType ||
    slip.depositorIdNumber ||
    slip.depositorMobile;

  return (
    <section className="cbs-surface" aria-labelledby="ficn-slip-heading" role="alert">
      {/* Print-only header — RBI requires bank identification on the
          customer slip. Visibility toggled by the print stylesheet
          (`cbs-print-header`). */}
      <div className="cbs-print-header" style={{ display: 'none' }}>
        <div className="cbs-print-header-bank">FINVANTA — FICN Acknowledgement Slip</div>
        <div className="cbs-print-header-branch">
          {slip.branchName ? `${slip.branchName} (${slip.branchCode})` : slip.branchCode}
        </div>
      </div>

      <div
        className="cbs-surface-header"
        style={{ background: 'var(--color-cbs-crimson-50)' }}
      >
        <div
          id="ficn-slip-heading"
          className="text-sm font-semibold tracking-wide uppercase"
          style={{ color: 'var(--color-cbs-crimson-700)' }}
        >
          FICN — Counterfeit Notes Impounded
        </div>
        <span className="cbs-ribbon text-cbs-crimson-700 bg-cbs-crimson-50">
          Deposit Rejected
        </span>
      </div>

      <div className="cbs-surface-body space-y-4">
        {/* Server-supplied summary — quoted verbatim to the customer. */}
        <p className="text-sm text-cbs-ink">{message}</p>

        {/* FIR-mandatory marker — printed prominently per RBI Master
            Direction on Counterfeit Notes. firRequired is set
            server-side when total counterfeit count >= 5 across the
            transaction. Do NOT recompute on the client. */}
        {slip.firRequired && (
          <div className="cbs-alert cbs-alert-error">
            <div className="font-semibold text-sm uppercase tracking-wider">
              FIR Mandatory
            </div>
            <div className="mt-1 text-sm">
              Total counterfeit count is at or above the RBI threshold
              (5 notes per transaction). The branch MUST file a First
              Information Report with the local police station before
              EOD and remit the impounded notes to the currency chest.
            </div>
          </div>
        )}

        {/* Permanent register reference — the customer's primary
            evidence. Backed by a REQUIRES_NEW sub-transaction so the
            register row survives the deposit rollback. */}
        <div>
          <div className="cbs-field-label">FICN Register Reference</div>
          <div
            className="cbs-tabular text-base font-semibold text-cbs-ink mt-1"
            data-testid="ficn-register-ref"
          >
            {slip.registerRef}
          </div>
          <div className="text-xs text-cbs-steel-600 mt-1">
            Quote this reference in any follow-up correspondence with
            the bank or police authorities.
          </div>
        </div>

        {/* Detection metadata. */}
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="cbs-field-label">Detection Date</dt>
            <dd className="text-sm text-cbs-ink mt-1">{formatCbsDate(slip.detectionDate)}</dd>
          </div>
          <div>
            <dt className="cbs-field-label">Detection Time</dt>
            <dd className="text-sm text-cbs-ink cbs-tabular mt-1">
              {formatCbsTimestamp(slip.detectionTimestamp)}
            </dd>
          </div>
          <div>
            <dt className="cbs-field-label">Detected By (Teller)</dt>
            <dd className="text-sm text-cbs-ink mt-1">{slip.detectedByTeller}</dd>
          </div>
          <div>
            <dt className="cbs-field-label">Branch</dt>
            <dd className="text-sm text-cbs-ink mt-1">
              {slip.branchName
                ? `${slip.branchName} (${slip.branchCode})`
                : slip.branchCode}
            </dd>
          </div>
          <div>
            <dt className="cbs-field-label">Originating Transaction Ref</dt>
            <dd className="text-sm text-cbs-ink cbs-tabular mt-1">
              {slip.originatingTxnRef}
            </dd>
          </div>
          <div>
            <dt className="cbs-field-label">Chest Dispatch Status</dt>
            <dd className="mt-1">
              <span
                className={
                  slip.chestDispatchStatus === 'PENDING'
                    ? 'cbs-ribbon text-cbs-gold-700 bg-cbs-gold-50'
                    : slip.chestDispatchStatus === 'DISPATCHED'
                      ? 'cbs-ribbon text-cbs-navy-700 bg-cbs-navy-50'
                      : 'cbs-ribbon text-cbs-olive-700 bg-cbs-olive-50'
                }
              >
                {slip.chestDispatchStatus}
              </span>
            </dd>
          </div>
        </dl>

        {/* Depositor identification block — only rendered when at
            least one field is populated. PMLA/KYC fields stay
            optional so the slip is still issuable when the customer
            walks out (the bank can backfill from the deposit form). */}
        {hasDepositorInfo && (
          <fieldset className="cbs-fieldset">
            <legend className="cbs-fieldset-legend">Depositor Details</legend>
            <div className="cbs-fieldset-body">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {slip.depositorName && (
                  <div>
                    <dt className="cbs-field-label">Name</dt>
                    <dd className="text-sm text-cbs-ink mt-1">{slip.depositorName}</dd>
                  </div>
                )}
                {slip.depositorIdType && (
                  <div>
                    <dt className="cbs-field-label">ID Type</dt>
                    <dd className="text-sm text-cbs-ink mt-1">{slip.depositorIdType}</dd>
                  </div>
                )}
                {slip.depositorIdNumber && (
                  <div>
                    <dt className="cbs-field-label">ID Number</dt>
                    <dd className="text-sm text-cbs-ink cbs-tabular mt-1">
                      {slip.depositorIdNumber}
                    </dd>
                  </div>
                )}
                {slip.depositorMobile && (
                  <div>
                    <dt className="cbs-field-label">Mobile</dt>
                    <dd className="text-sm text-cbs-ink cbs-tabular mt-1">
                      {slip.depositorMobile}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </fieldset>
        )}

        {/* Impounded denominations — RBI requires the slip to itemise
            counterfeit count and total face value per denomination. */}
        <fieldset className="cbs-fieldset">
          <legend className="cbs-fieldset-legend">Impounded Notes</legend>
          <div className="cbs-fieldset-body">
            <table
              className="w-full border-collapse text-sm"
              aria-label="Impounded counterfeit denominations"
            >
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-cbs-steel-600 border-b border-cbs-steel-100">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Denomination
                  </th>
                  <th scope="col" className="py-2 px-3 font-medium text-right">
                    Counterfeit Count
                  </th>
                  <th scope="col" className="py-2 pl-3 font-medium text-right">
                    Total Face Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {impounded.map((line) => (
                  <tr key={line.denomination} className="border-b border-cbs-steel-50">
                    <th scope="row" className="py-2 pr-3 font-normal text-cbs-ink">
                      {DENOMINATION_LABEL[line.denomination] ?? line.denomination}
                    </th>
                    <td className="py-2 px-3 cbs-tabular text-right text-cbs-ink">
                      {line.counterfeitCount}
                    </td>
                    <td className="py-2 pl-3 cbs-tabular text-right text-cbs-ink">
                      {formatCurrency(line.totalFaceValue)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <th
                    scope="row"
                    className="py-2 pr-3 text-sm font-semibold uppercase tracking-wider text-cbs-steel-700"
                  >
                    Total Face Value
                  </th>
                  <td className="py-2 px-3" />
                  <td className="py-2 pl-3 cbs-tabular text-right text-cbs-ink font-semibold">
                    {formatCurrency(slip.totalFaceValue)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </fieldset>

        {slip.remarks && (
          <div>
            <div className="cbs-field-label">Remarks</div>
            <div className="text-sm text-cbs-ink mt-1">{slip.remarks}</div>
          </div>
        )}

        {/* Print-only signature block — depositor + cashier
            acknowledgements per RBI customer-slip convention. */}
        <div className="cbs-print-signature" style={{ display: 'none' }}>
          <div className="cbs-print-signature-line">Depositor Signature</div>
          <div className="cbs-print-signature-line">Cashier / Teller</div>
        </div>

        <div className="cbs-no-print flex justify-end">
          <button
            type="button"
            className="cbs-btn cbs-btn-secondary text-sm cbs-print-keep"
            onClick={() => {
              if (typeof window !== 'undefined') window.print();
            }}
          >
            Print Slip
          </button>
        </div>
      </div>
    </section>
  );
}
