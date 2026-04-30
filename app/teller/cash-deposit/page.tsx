'use client';

/**
 * FINVANTA CBS — Cash Deposit screen.
 *
 * Operator (TELLER / MAKER / ADMIN) posts customer cash deposits with
 * a denomination breakdown. The page is a thin container around three
 * presentational components:
 *
 *   - `CashDepositReceipt` — POSTED outcome (HTTP 200); printed
 *     customer receipt with voucher number, balances, denomination
 *     breakdown, and CTR/PMLA marker when amount ≥ ₹50,000.
 *   - `FicnSlip` — FICN outcome (HTTP 422 + CBS-TELLER-008); RBI
 *     customer slip with permanent register reference, impounded
 *     denominations, and FIR-mandatory marker when count ≥ 5.
 *   - `CashDepositForm` — capture form. Locks itself when
 *     `lastDeposit` is non-null (the receipt or slip is rendered
 *     above) and offers a "Start new deposit" affordance that
 *     regenerates the idempotency key.
 *
 * Pre-flight: the page first fetches the operator's till. If no till
 * is open today (CBS-TELLER-001), the operator is routed to the
 * `/teller/till` open-till form — there is no point capturing a
 * deposit when the server will reject the post for lack of an open
 * till anyway. This mirrors the EOD pre-flight gate philosophy on
 * the till lifecycle.
 *
 * NOTE: this page renders standalone (no shared sidebar/header). Once
 * the authenticated dashboard shell path is wired in, register a
 * sidebar nav item pointing here and remove this notice.
 *
 * @file app/teller/cash-deposit/page.tsx
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { useTellerStore } from '@/store/tellerStore';
import { CashDepositForm } from '@/components/teller/CashDepositForm';
import { CashDepositReceipt } from '@/components/teller/CashDepositReceipt';
import { FicnSlip } from '@/components/teller/FicnSlip';

export default function CashDepositPage() {
  const myTill = useTellerStore((s) => s.myTill);
  const isLoading = useTellerStore((s) => s.isLoading);
  const error = useTellerStore((s) => s.error);
  const noTillOpen = useTellerStore((s) => s.noTillOpen);
  const lastDeposit = useTellerStore((s) => s.lastDeposit);
  const fetchMyTill = useTellerStore((s) => s.fetchMyTill);

  useEffect(() => {
    void fetchMyTill();
  }, [fetchMyTill]);

  // Initial-fetch loading state — distinguish from per-action loading
  // (which keeps myTill/noTillOpen populated).
  if (isLoading && !myTill && !noTillOpen) {
    return (
      <main id="cbs-main" className="min-h-screen bg-cbs-mist p-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-semibold text-cbs-ink mb-4">Cash Deposit</h1>
          <div className="cbs-skeleton cbs-skeleton-card" style={{ height: 200 }} />
        </div>
      </main>
    );
  }

  return (
    <main id="cbs-main" className="min-h-screen bg-cbs-mist p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-cbs-ink">Cash Deposit</h1>
          <p className="text-sm text-cbs-steel-600 mt-1">
            Post a customer cash deposit with denomination breakdown.
          </p>
        </header>

        {/* Generic load failure (network / 5xx) — distinct from
            CBS-TELLER-001 "no till open today" which routes to the
            open-till form rather than an error banner. */}
        {error && !noTillOpen && !myTill && (
          <div role="alert" className="cbs-alert cbs-alert-error">
            <div className="font-semibold text-sm">Could not load till</div>
            <div className="mt-1 text-sm">{error}</div>
            <button
              type="button"
              className="cbs-btn cbs-btn-secondary mt-3 text-xs"
              onClick={() => void fetchMyTill()}
            >
              Retry
            </button>
          </div>
        )}

        {/* Pre-flight: no till open today. Cash deposits will be
            rejected server-side, so route the operator to /teller/till
            instead of letting them fill out the form for nothing. */}
        {noTillOpen && (
          <div role="alert" className="cbs-alert cbs-alert-warning">
            <div className="font-semibold text-sm">No till open for today</div>
            <div className="mt-1 text-sm">
              You must open your till for the current business day before
              posting any cash transactions.
            </div>
            <Link
              href="/teller/till"
              className="cbs-btn cbs-btn-primary mt-3 text-xs uppercase tracking-wider"
            >
              Open Till
            </Link>
          </div>
        )}

        {/* Till is open (or pending — the server will reject deposits
            on PENDING_OPEN with CBS-TELLER-002, which surfaces as a
            depositError on the form, but we still render the form so
            the operator can see what's queued up). */}
        {myTill && (
          <>
            {/* Outcome panel — receipt or FICN slip — rendered ABOVE
                the form so the operator's eye lands on the result
                first. The form locks itself when `lastDeposit` is
                non-null and shows a "Start new deposit" affordance. */}
            {lastDeposit?.kind === 'POSTED' && (
              <CashDepositReceipt receipt={lastDeposit.receipt} />
            )}
            {lastDeposit?.kind === 'FICN' && (
              <FicnSlip slip={lastDeposit.slip} message={lastDeposit.message} />
            )}

            <CashDepositForm />
          </>
        )}
      </div>
    </main>
  );
}
