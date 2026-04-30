'use client';

/**
 * Cash Deposit Receipt panel — POSTED outcome.
 *
 * Rendered by `app/teller/cash-deposit/page.tsx` after a successful
 * deposit (HTTP 200, `kind === 'POSTED'`). Shows the customer-facing
 * confirmation: voucher number, posted amount, balances, denomination
 * breakdown (server-computed `totalValue`), and CTR/PMLA marker when
 * the deposit crossed the ₹50,000 reporting threshold.
 *
 * Pure presentational. The contract guarantees `pendingApproval ===
 * false` on every reachable POSTED path under the current engine
 * config (see TELLER_API_CONTRACT.md §B4). Defensive scaffolding for
 * the forward-compat case is rendered as a warning panel — the rest
 * of the receipt is suppressed because voucherNumber would be null
 * and balances would be unchanged.
 *
 * @file src/components/teller/CashDepositReceipt.tsx
 */
import type { CashDepositReceipt as Receipt } from '@/types/teller.types';
import { DENOMINATION_LABEL, DENOMINATION_ORDER } from '@/utils/denominations';
import { formatCbsTimestamp, formatCurrency } from '@/utils/formatters';

interface CashDepositReceiptProps {
  receipt: Receipt;
}

/**
 * Sort denomination lines by canonical order (highest face value
 * first, COIN_BUCKET last) regardless of the order the server
 * returned them in.
 */
function sortDenominations(lines: Receipt['denominations']) {
  const order = new Map(DENOMINATION_ORDER.map((d, i) => [d, i]));
  return [...lines].sort(
    (a, b) => (order.get(a.denomination) ?? 99) - (order.get(b.denomination) ?? 99),
  );
}

export function CashDepositReceipt({ receipt }: CashDepositReceiptProps) {
  // B4 forward-compat: structurally unreachable on the current engine
  // config (CASH_DEPOSIT is not in ALWAYS_REQUIRE_APPROVAL and the
  // amount-based approval gate doesn't fire on cash postings — see
  // TELLER_API_CONTRACT.md §"Maker-checker model"). If the field ever
  // flips to true, voucherNumber/balances/denominations are not yet
  // valid, so we suppress the receipt body and render a maker-checker
  // pending notice instead. The UI gates on pendingApproval === false
  // per the contract.
  if (receipt.pendingApproval) {
    return (
      <section
        className="cbs-surface"
        aria-labelledby="cash-deposit-pending-heading"
      >
        <div className="cbs-surface-header">
          <div
            id="cash-deposit-pending-heading"
            className="text-sm font-semibold tracking-wide uppercase text-cbs-steel-700"
          >
            Cash Deposit
          </div>
          <span className="cbs-ribbon text-cbs-violet-700 bg-cbs-violet-50">
            Pending Approval
          </span>
        </div>
        <div className="cbs-surface-body space-y-3">
          <div className="cbs-alert cbs-alert-warning">
            <div className="font-semibold text-sm">
              Awaiting checker approval
            </div>
            <div className="mt-1 text-sm">
              The deposit has been queued for supervisor approval. The
              ledger and till balance are UNCHANGED until the checker
              approves. Voucher number will be allocated on approval.
            </div>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <dt className="cbs-field-label">Transaction Reference</dt>
              <dd className="text-sm text-cbs-ink cbs-tabular mt-1">
                {receipt.transactionRef}
              </dd>
            </div>
            <div>
              <dt className="cbs-field-label">Account</dt>
              <dd className="text-sm text-cbs-ink cbs-tabular mt-1">
                {receipt.accountNumber}
              </dd>
            </div>
            <div>
              <dt className="cbs-field-label">Amount</dt>
              <dd className="text-sm text-cbs-ink cbs-tabular mt-1">
                {formatCurrency(receipt.amount)}
              </dd>
            </div>
          </dl>
        </div>
      </section>
    );
  }

  const denominations = sortDenominations(receipt.denominations);

  return (
    <section className="cbs-surface" aria-labelledby="cash-deposit-receipt-heading">
      {/* Print-only header — bank/branch banner per Tier-1 receipt
          convention. Branch context is rendered by the host page if
          present; this block keeps the receipt self-contained when
          printed standalone. */}
      <div className="cbs-print-header" style={{ display: 'none' }}>
        <div className="cbs-print-header-bank">FINVANTA — Cash Deposit Receipt</div>
        <div className="cbs-print-header-branch">
          {receipt.tellerUserId
            ? `Teller: ${receipt.tellerUserId}`
            : 'Counter Receipt'}
        </div>
      </div>

      <div className="cbs-surface-header">
        <div
          id="cash-deposit-receipt-heading"
          className="text-sm font-semibold tracking-wide uppercase text-cbs-steel-700"
        >
          Cash Deposit Receipt
        </div>
        <div className="flex items-center gap-2">
          {receipt.ctrTriggered && (
            <span
              className="cbs-ribbon text-cbs-gold-700 bg-cbs-gold-50"
              title="Cash Transaction Reporting threshold (PMLA Rule 9) — reportable"
            >
              CTR Reportable
            </span>
          )}
          <span className="cbs-ribbon text-cbs-olive-700 bg-cbs-olive-50">
            Posted
          </span>
        </div>
      </div>

      <div className="cbs-surface-body space-y-4">
        {/* Headline figures — voucher + amount + post timestamp. */}
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="cbs-field-label">Voucher Number</dt>
            <dd
              className="text-base font-semibold text-cbs-ink cbs-tabular mt-1"
              data-testid="cash-deposit-voucher-number"
            >
              {receipt.voucherNumber ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="cbs-field-label">Transaction Reference</dt>
            <dd className="text-sm text-cbs-ink cbs-tabular mt-1">
              {receipt.transactionRef}
            </dd>
          </div>
          <div>
            <dt className="cbs-field-label">Account</dt>
            <dd className="text-sm text-cbs-ink cbs-tabular mt-1">
              {receipt.accountNumber}
            </dd>
          </div>
          <div>
            <dt className="cbs-field-label">Amount Deposited</dt>
            <dd className="text-base font-semibold text-cbs-ink cbs-tabular mt-1">
              {formatCurrency(receipt.amount)}
            </dd>
          </div>
          {receipt.balanceBefore !== null && (
            <div>
              <dt className="cbs-field-label">Balance Before</dt>
              <dd className="text-sm text-cbs-ink cbs-tabular mt-1">
                {formatCurrency(receipt.balanceBefore)}
              </dd>
            </div>
          )}
          {receipt.balanceAfter !== null && (
            <div>
              <dt className="cbs-field-label">Balance After</dt>
              <dd className="text-sm text-cbs-ink cbs-tabular mt-1">
                {formatCurrency(receipt.balanceAfter)}
              </dd>
            </div>
          )}
          {receipt.postingDate && (
            <div>
              <dt className="cbs-field-label">Posted At</dt>
              <dd className="text-sm text-cbs-ink cbs-tabular mt-1">
                {formatCbsTimestamp(receipt.postingDate)}
              </dd>
            </div>
          )}
          {receipt.valueDate && (
            <div>
              <dt className="cbs-field-label">Value Date</dt>
              <dd className="text-sm text-cbs-ink cbs-tabular mt-1">
                {receipt.valueDate}
              </dd>
            </div>
          )}
          {receipt.tillBalanceAfter !== null && (
            <div>
              <dt className="cbs-field-label">Till Balance After</dt>
              <dd className="text-sm text-cbs-ink cbs-tabular mt-1">
                {formatCurrency(receipt.tillBalanceAfter)}
              </dd>
            </div>
          )}
          {receipt.tellerUserId && (
            <div>
              <dt className="cbs-field-label">Teller</dt>
              <dd className="text-sm text-cbs-ink mt-1">{receipt.tellerUserId}</dd>
            </div>
          )}
        </dl>

        {receipt.narration && (
          <div>
            <div className="cbs-field-label">Narration</div>
            <div className="text-sm text-cbs-ink mt-1">{receipt.narration}</div>
          </div>
        )}

        {/* CTR/PMLA notice — printed prominently when amount ≥ ₹50,000.
            The ledger flag (ctrTriggered) is server-authoritative; the
            client never re-derives this. Server reports to FIU-IND. */}
        {receipt.ctrTriggered && (
          <div className="cbs-alert cbs-alert-warning">
            <div className="font-semibold text-sm">
              Cash Transaction Report (CTR) — Reportable
            </div>
            <div className="mt-1 text-sm">
              This deposit meets the PMLA Rule 9 threshold (≥ ₹50,000).
              The branch must ensure customer KYC (PAN or Form 60/61)
              is on file. The transaction will be included in the
              monthly CTR submission to FIU-IND.
            </div>
          </div>
        )}

        {/* Denomination breakdown — server-computed totalValue per
            line. The contract guarantees these match the posted
            amount; the receipt prints them verbatim for the customer
            and for the cash-counter audit trail. */}
        {denominations.length > 0 && (
          <fieldset className="cbs-fieldset">
            <legend className="cbs-fieldset-legend">Denomination Breakdown</legend>
            <div className="cbs-fieldset-body">
              <table
                className="w-full border-collapse text-sm"
                aria-label="Posted denomination breakdown"
              >
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-cbs-steel-600 border-b border-cbs-steel-100">
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Denomination
                    </th>
                    <th scope="col" className="py-2 px-3 font-medium text-right">
                      Unit Count
                    </th>
                    <th scope="col" className="py-2 pl-3 font-medium text-right">
                      Line Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {denominations.map((line) => (
                    <tr key={line.denomination} className="border-b border-cbs-steel-50">
                      <th scope="row" className="py-2 pr-3 font-normal text-cbs-ink">
                        {DENOMINATION_LABEL[line.denomination] ?? line.denomination}
                      </th>
                      <td className="py-2 px-3 cbs-tabular text-right text-cbs-ink">
                        {line.unitCount}
                      </td>
                      <td className="py-2 pl-3 cbs-tabular text-right text-cbs-ink">
                        {formatCurrency(line.totalValue)}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <th
                      scope="row"
                      className="py-2 pr-3 text-sm font-semibold uppercase tracking-wider text-cbs-steel-700"
                    >
                      Total
                    </th>
                    <td className="py-2 px-3" />
                    <td className="py-2 pl-3 cbs-tabular text-right text-cbs-ink font-semibold">
                      {formatCurrency(receipt.amount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </fieldset>
        )}

        {/* Print-only signature block — depositor + cashier
            acknowledgements per Tier-1 receipt convention. */}
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
            Print Receipt
          </button>
        </div>
      </div>
    </section>
  );
}
