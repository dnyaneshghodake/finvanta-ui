'use client';

/**
 * FINVANTA CBS — Beneficiary Management.
 *
 * The payee book (beneficiary register) allows operators to maintain
 * pre-approved transfer recipients. Beneficiary management is not
 * yet migrated from the JSP stack — the legacy bridge is linked.
 */

import Link from 'next/link';
import { Breadcrumb } from '@/components/cbs';

export default function BeneficiariesPage() {
  return (
    <div className="space-y-4">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Beneficiaries' },
      ]} />

      <div>
        <h1 className="text-xl font-semibold text-cbs-ink">Beneficiary Management</h1>
        <p className="text-xs text-cbs-steel-600 mt-0.5">
          Maintain pre-approved transfer recipients (payee book).
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
            The React beneficiary management screen ships with the next
            release once the backend exposes <code>/v1/beneficiaries/**</code> as
            a REST surface.
          </p>
          <div className="pt-2">
            <Link href="/legacy/beneficiaries" className="cbs-btn cbs-btn-secondary">
              Open legacy beneficiary register
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
