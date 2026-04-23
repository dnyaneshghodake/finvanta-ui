'use client';

/**
 * FINVANTA CBS — Charge Setup (Admin).
 *
 * Service charges, transaction fees, and penalty configurations
 * applied to products and account operations.
 */

import Link from 'next/link';
import { Breadcrumb } from '@/components/cbs';
import { AdminPageGuard } from '@/components/atoms';

export default function ChargeSetupPage() {
  return (
    <AdminPageGuard roles={['ADMIN_HO']}>
      <div className="space-y-4">
        <Breadcrumb items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Administration' },
          { label: 'Charge Setup' },
        ]} />

        <div>
          <h1 className="text-lg font-semibold text-cbs-ink">Charge Setup</h1>
          <p className="text-xs text-cbs-steel-600 mt-0.5">
            Service charges, transaction fees, and penalty configurations
            applied to products and account operations.
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
              The React Charge Setup screen ships with the next release
              once the backend exposes <code>/v1/admin/charges/**</code> as
              a REST surface.
            </p>
            <div className="pt-2">
              <Link href="/legacy/admin/charges" className="cbs-btn cbs-btn-secondary">
                Open legacy charge setup
              </Link>
            </div>
          </div>
        </section>
      </div>
    </AdminPageGuard>
  );
}
