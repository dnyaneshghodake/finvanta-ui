'use client';

/**
 * FINVANTA CBS — Till management screen.
 *
 * Operator (TELLER / MAKER / ADMIN) opens their till for the business
 * day, monitors balance, and requests close at end-of-day with a
 * physical cash count. Close transitions the till to PENDING_CLOSE
 * with a computed variance — a CHECKER must approve to terminate at
 * CLOSED (per RBI dual-control on cash counter EOD).
 *
 * Three states:
 *   1. Loading — initial fetch in flight.
 *   2. NoTill  — server said CBS-TELLER-001; render OpenTillForm.
 *   3. HasTill — render status card + (when status=OPEN) CloseTillForm.
 *
 * Idempotency: till lifecycle endpoints don't carry an idempotency key
 * today (they are not cash-posting per docs/TELLER_API_CONTRACT.md).
 * The submit button is disabled while a request is in flight to avoid
 * double-click double-submits at the UI level.
 *
 * NOTE: this page renders standalone (no shared sidebar/header). Once
 * the authenticated dashboard shell path is wired in, register a
 * sidebar nav item pointing here and remove this notice.
 *
 * @file app/teller/till/page.tsx
 */

import { useEffect } from 'react';
import { useTellerStore } from '@/store/tellerStore';
import { OpenTillForm } from '@/components/teller/OpenTillForm';
import { CloseTillForm } from '@/components/teller/CloseTillForm';
import { TillStatusCard } from '@/components/teller/TillStatusCard';

export default function TillPage() {
  const myTill = useTellerStore((s) => s.myTill);
  const isLoading = useTellerStore((s) => s.isLoading);
  const error = useTellerStore((s) => s.error);
  const noTillOpen = useTellerStore((s) => s.noTillOpen);
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
          <h1 className="text-2xl font-semibold text-cbs-ink mb-4">Till</h1>
          <div className="cbs-skeleton cbs-skeleton-card" style={{ height: 200 }} />
        </div>
      </main>
    );
  }

  return (
    <main id="cbs-main" className="min-h-screen bg-cbs-mist p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-cbs-ink">Till</h1>
          <p className="text-sm text-cbs-steel-600 mt-1">
            Manage your cash counter for the business day.
          </p>
        </header>

        {/* Generic load failure (network / 5xx) — distinct from
            CBS-TELLER-001 "no till open today" which renders the
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

        {!myTill && noTillOpen && <OpenTillForm />}

        {myTill && (
          <>
            <TillStatusCard till={myTill} />
            {myTill.status === 'OPEN' && <CloseTillForm till={myTill} />}
          </>
        )}
      </div>
    </main>
  );
}
