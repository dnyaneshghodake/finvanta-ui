'use client';

/**
 * FINVANTA CBS — Day Book Report.
 *
 * The day book is a chronological register of all transactions
 * posted during the current business day. It is the primary
 * reconciliation tool for branch operations.
 */

import Link from 'next/link';
import { Breadcrumb } from '@/components/cbs';

export default function DayBookPage() {
  return (
    <div className="space-y-4">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Reports' },
        { label: 'Day Book' },
      ]} />

      <div>
        <h1 className="text-lg font-semibold text-cbs-ink">Day Book</h1>
        <p className="text-xs text-cbs-steel-600 mt-0.5">
          Chronological register of all transactions posted during
          the current business day.
        </p>
      </div>

      <section className="cbs-surface">
        <div className="cbs-surface-header">
          <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
            Coming soon
          </span>
        </div>
        <div className="cbs-surface-body space-y-3 text-sm text-cbs-steel-700">
          <p>
            The React Day Book report ships with the next release once
            the backend exposes <code>/v1/reports/day-book</code> as a
            REST surface with paginated transaction listing.
          </p>
          <div className="pt-2">
            <Link href="/legacy/reports/day-book" className="cbs-btn cbs-btn-secondary">
              Open legacy day book
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
