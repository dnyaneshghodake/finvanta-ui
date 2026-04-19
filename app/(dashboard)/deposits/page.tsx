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
import { StatusRibbon, AmountDisplay } from '@/components/cbs';
import { Button, Spinner } from '@/components/atoms';

interface FdRecord {
  id: number;
  fdNumber: string;
  customerName?: string;
  principal: number;
  interestRate: number;
  tenureMonths: number;
  openDate: string;
  maturityDate: string;
  maturityAmount: number;
  lienMarked: boolean;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-cbs-ink">Fixed Deposits</h1>
          <p className="text-xs text-cbs-steel-600 mt-0.5">
            Active fixed deposit portfolio for current branch.
          </p>
        </div>
        <Link href="/deposits/new" className="cbs-btn cbs-btn-primary">
          + Book FD
        </Link>
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
                  <th className="text-right">Principal</th>
                  <th className="text-right">Rate %</th>
                  <th>Tenure</th>
                  <th>Maturity Date</th>
                  <th className="text-right">Maturity Amt</th>
                  <th>Lien</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {deposits.map((fd) => (
                  <tr key={fd.id}>
                    <td className="cbs-tabular font-semibold text-cbs-navy-700">{fd.fdNumber}</td>
                    <td className="text-cbs-ink">{fd.customerName || '—'}</td>
                    <td className="cbs-amount">{fd.principal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="cbs-amount">{fd.interestRate.toFixed(2)}</td>
                    <td className="cbs-tabular">{fd.tenureMonths} months</td>
                    <td className="cbs-tabular">{fd.maturityDate}</td>
                    <td className="cbs-amount">{fd.maturityAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td>
                      {fd.lienMarked ? (
                        <span className="cbs-ribbon text-cbs-crimson-700 bg-cbs-crimson-50 border-cbs-crimson-600">LIEN</span>
                      ) : (
                        <span className="text-xs text-cbs-steel-500">—</span>
                      )}
                    </td>
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