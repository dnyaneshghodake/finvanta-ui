'use client';

/**
 * FINVANTA CBS — GL Chart of Accounts (Admin).
 *
 * The GL setup is a foundational step in bank onboarding. The full
 * GL CRUD requires the Spring Admin API which is not yet migrated
 * to REST — the legacy bridge is linked for management operations.
 */

import Link from 'next/link';
import { Breadcrumb } from '@/components/cbs';
import { AdminPageGuard } from '@/components/atoms';

export default function GlChartPage() {
  return (
    <AdminPageGuard roles={['ADMIN_HO']}>
      <div className="space-y-4">
        <Breadcrumb items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Administration' },
          { label: 'GL Chart of Accounts' },
        ]} />

        <div>
          <h1 className="text-lg font-semibold text-cbs-ink">GL Chart of Accounts</h1>
          <p className="text-xs text-cbs-steel-600 mt-0.5">
            General Ledger account hierarchy. Defines the bank&apos;s
            accounting structure for all financial postings.
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
              The React GL Chart of Accounts screen ships with the next
              release once the backend exposes <code>/v1/admin/gl/**</code> as
              a REST surface.
            </p>
            <div className="pt-2">
              <Link href="/legacy/admin/gl" className="cbs-btn cbs-btn-secondary">
                Open legacy GL setup
              </Link>
            </div>
          </div>
        </section>
      </div>
    </AdminPageGuard>
  );
}
