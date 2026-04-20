'use client';

/**
 * FINVANTA CBS — Fixed Deposit Inquiry (Phase 5.1).
 *
 * Lists active FDs via GET /api/v1/fixed-deposits/active.
 * Shows FD number, customer, principal, rate, tenure, maturity date,
 * maturity amount, lien status, and current status.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/services/api/apiClient';
import { StatusRibbon, AmountDisplay, Breadcrumb } from '@/components/cbs';
import { Button, Spinner } from '@/components/atoms';
import { formatCbsDate } from '@/utils/formatters';

interface FdRecord {
  id: number;
  fdNumber: string;
  customerName?: string;
  customerNumber?: string;
  principal: number;
  interestRate: number;
  tenureMonths: number;
  openDate: string;
  maturityDate: string;
  maturityAmount: number;
  /** Interest compounding frequency: QUARTERLY, MONTHLY, etc. */
  compoundingFrequency?: string;
  /** Linked CASA for interest credit / maturity proceeds. */
  linkedAccount?: string;
  currencyCode?: string;
  lienMarked: boolean;
  /** Lien amount when lienMarked is true. */
  lienAmount?: number;
  /** Auto-renewal flag per RBI deposit guidelines. */
  autoRenew?: boolean;
  status: string;
}

export default function FdInquiryPage() {
  const [deposits, setDeposits] = useState<FdRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiClient.get<{ status: string; data?: FdRecord[] }>('/fixed-deposits/active')
      .then((res) => {
        if (!cancelled) setDeposits(res.data?.data ?? []);
      })
      .catch(() => { /* empty list on error */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-4">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Fixed Deposits' },
      ]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-cbs-ink">Fixed Deposits</h1>
          <p className="text-xs text-cbs-steel-600 mt-0.5">
            Active fixed deposit portfolio for current branch.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/deposits/close" className="cbs-btn cbs-btn-secondary">Premature Close</Link>
          <Link href="/deposits/lien" className="cbs-btn cbs-btn-secondary">Lien Mgmt</Link>
          <Link href="/deposits/new" className="cbs-btn cbs-btn-primary">+ Book FD</Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner size="md" message="Loading fixed deposits..." />
        </div>
      ) : deposits.length === 0 ? (
        <div className="cbs-surface text-center py-8">
          <p className="text-sm text-cbs-steel-500">No active fixed deposits found.</p>
        </div>
      ) : (
        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
              Active Fixed Deposits
            </span>
            <span className="text-xs text-cbs-steel-500 cbs-tabular">
              {deposits.length} record{deposits.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="cbs-grid-table">
              <thead>
                <tr>
                  <th>FD Number</th>
                  <th>Customer</th>
                  <th>CCY</th>
                  <th className="text-right">Principal</th>
                  <th className="text-right">Rate %</th>
                  <th>Tenure</th>
                  <th>Open Date</th>
                  <th>Maturity Date</th>
                  <th className="text-right">Maturity Amt</th>
                  <th>Linked A/C</th>
                  <th>Lien</th>
                  <th>Renew</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {deposits.map((fd) => (
                  <tr key={fd.id}>
                    <td className="cbs-tabular font-semibold text-cbs-navy-700">{fd.fdNumber}</td>
                    <td className="text-cbs-ink">
                      {fd.customerName || '—'}
                      {fd.customerNumber && (
                        <div className="text-[10px] text-cbs-steel-500 cbs-tabular">{fd.customerNumber}</div>
                      )}
                    </td>
                    <td className="cbs-tabular text-cbs-steel-600">{fd.currencyCode || 'INR'}</td>
                    <td className="cbs-amount">{fd.principal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="cbs-amount">{fd.interestRate.toFixed(2)}</td>
                    <td className="cbs-tabular">{fd.tenureMonths} months</td>
                    <td className="cbs-tabular">{formatCbsDate(fd.openDate)}</td>
                    <td className="cbs-tabular">{formatCbsDate(fd.maturityDate)}</td>
                    <td className="cbs-amount">{fd.maturityAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="cbs-tabular text-cbs-steel-600">{fd.linkedAccount || '—'}</td>
                    <td>
                      {fd.lienMarked ? (
                        <span className="cbs-ribbon text-cbs-crimson-700 bg-cbs-crimson-50 border-cbs-crimson-600">LIEN</span>
                      ) : (
                        <span className="text-xs text-cbs-steel-500">—</span>
                      )}
                    </td>
                    <td className="text-xs text-cbs-steel-600">{fd.autoRenew ? 'Yes' : 'No'}</td>
                    <td><StatusRibbon status={fd.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}