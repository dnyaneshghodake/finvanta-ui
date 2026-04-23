'use client';

/**
 * FINVANTA CBS — Day Open / Close (Admin).
 *
 * The day-open ceremony initialises the business date, runs BOD
 * batch jobs (interest accrual, standing instructions), and unlocks
 * teller operations. Day-close runs EOD batches and locks postings.
 */

import Link from 'next/link';
import { Breadcrumb } from '@/components/cbs';
import { AdminPageGuard } from '@/components/atoms';

export default function DayOpenClosePage() {
  return (
    <AdminPageGuard>
      <div className="space-y-4">
        <Breadcrumb items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Administration' },
          { label: 'Day Open / Close' },
        ]} />

        <div>
          <h1 className="text-lg font-semibold text-cbs-ink">Day Open / Close</h1>
          <p className="text-xs text-cbs-steel-600 mt-0.5">
            Business day ceremony — initialises the CBS business date,
            runs BOD/EOD batch jobs, and controls teller posting windows.
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
              The React Day Open/Close screen ships with the next release
              once the backend exposes <code>/v1/admin/day/**</code> as a
              REST surface with BOD/EOD batch orchestration.
            </p>
            <div className="pt-2">
              <Link href="/legacy/admin/day" className="cbs-btn cbs-btn-secondary">
                Open legacy day ceremony
              </Link>
            </div>
          </div>
        </section>
      </div>
    </AdminPageGuard>
  );
}
