'use client';

/**
 * FINVANTA CBS — Product Setup (Admin).
 *
 * CBS products define the terms for CASA, FD, loan, and other
 * account types (interest rates, charges, limits, GL mapping).
 */

import Link from 'next/link';
import { Breadcrumb } from '@/components/cbs';
import { AdminPageGuard } from '@/components/atoms';

export default function ProductSetupPage() {
  return (
    <AdminPageGuard roles={['ADMIN_HO']}>
      <div className="space-y-4">
        <Breadcrumb items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Administration' },
          { label: 'Product Setup' },
        ]} />

        <div>
          <h1 className="text-xl font-semibold text-cbs-ink">Product Setup</h1>
          <p className="text-xs text-cbs-steel-600 mt-0.5">
            Define CASA, FD, loan, and other product types with interest
            rates, charges, limits, and GL mapping.
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
              The React Product Setup screen ships with the next release
              once the backend exposes <code>/v1/admin/products/**</code> as
              a REST surface.
            </p>
            <div className="pt-2">
              <Link href="/legacy/admin/products" className="cbs-btn cbs-btn-secondary">
                Open legacy product setup
              </Link>
            </div>
          </div>
        </section>
      </div>
    </AdminPageGuard>
  );
}
