'use client';

/**
 * Quick Operations Widget — role-gated, no API fetch.
 * @file src/components/dashboard/QuickOpsWidget.tsx
 *
 * Zero-trust: each operation button checks permissions before
 * rendering. The backend independently enforces the same rules.
 */

import Link from 'next/link';
import { isMaker, hasPermission } from '@/security/roleGuard';
import { Button } from '@/components/atoms';
import {
  ArrowLeftRight, Landmark, UserPlus, Banknote, CreditCard,
  ClipboardCheck,
} from 'lucide-react';

function QuickOp({ href, icon, label, primary }: {
  href: string; icon: React.ReactNode; label: string; primary?: boolean;
}) {
  return (
    <Link href={href}>
      <Button fullWidth variant={primary ? 'primary' : 'secondary'} size="sm" icon={icon}>
        {label}
      </Button>
    </Link>
  );
}

export function QuickOpsWidget() {
  return (
    <section className="cbs-surface">
      <div className="cbs-surface-header">
        <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
          Quick Operations
        </span>
      </div>
      <div className="cbs-surface-body grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {(hasPermission('TXN_CREATE') || isMaker()) && (
          <QuickOp href="/transfers" icon={<ArrowLeftRight size={15} />} label="Transfer" primary />
        )}
        <QuickOp href="/accounts" icon={<Landmark size={15} />} label="Account Inquiry" />
        {isMaker() && (
          <>
            <QuickOp href="/customers/new" icon={<UserPlus size={15} />} label="New Customer" />
            <QuickOp href="/deposits/new" icon={<Banknote size={15} />} label="Book FD" />
            <QuickOp href="/loans/apply" icon={<CreditCard size={15} />} label="Loan Application" />
          </>
        )}
        <QuickOp href="/workflow" icon={<ClipboardCheck size={15} />} label="Workflow Queue" />
      </div>
    </section>
  );
}
