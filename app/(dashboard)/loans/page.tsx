'use client';

/**
 * FINVANTA CBS — Loan Inquiry (Phase 6.1).
 *
 * Lists active loans via GET /api/v1/loans/active.
 * Shows loan account, customer, product, disbursed amount, outstanding,
 * EMI, next due date, overdue status, and NPA classification.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/services/api/apiClient';
import { StatusRibbon } from '@/components/cbs';
import { Spinner } from '@/components/atoms';

interface LoanRecord {
  id: number;
  accountNumber: string;
  customerName?: string;
  productCode: string;
  disbursedAmount: number;
  outstandingPrincipal: number;
  interestRate: number;
  emiAmount: number;
  nextDueDate?: string;
  overdueAmount: number;
  status: string;
}

export default function LoanInquiryPage() {
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiClient.get<{ status: string; data?: LoanRecord[] }>('/loans/active')
      .then((res) => { if (!cancelled) setLoans(res.data?.data ?? []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-cbs-ink">Loan Portfolio</h1>
          <p className="text-xs text-cbs-steel-600 mt-0.5">
            Active loan accounts for current branch.
          </p>
        </div>
        <Link href="/loans/apply" className="cbs-btn cbs-btn-primary">+ New Application</Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Spinner size="md" message="Loading loans..." /></div>
      ) : loans.length === 0 ? (
        <div className="cbs-surface text-center py-8">
          <p className="text-sm text-cbs-steel-500">No active loans found.</p>
        </div>
      ) : (
        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Active Loans</span>
            <span className="text-xs text-cbs-steel-500 cbs-tabular">{loans.length} records</span>
          </div>
          <div className="overflow-x-auto">
            <table className="cbs-grid-table">
              <thead>
                <tr>
                  <th>Loan Account</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th className="text-right">Disbursed</th>
                  <th className="text-right">Outstanding</th>
                  <th className="text-right">Rate %</th>
                  <th className="text-right">EMI</th>
                  <th>Next Due</th>
                  <th className="text-right">Overdue</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((l) => (
                  <tr key={l.id}>
                    <td className="cbs-tabular font-semibold text-cbs-navy-700">{l.accountNumber}</td>
                    <td className="text-cbs-ink">{l.customerName || '—'}</td>
                    <td className="cbs-tabular text-cbs-steel-600">{l.productCode}</td>
                    <td className="cbs-amount">{l.disbursedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="cbs-amount">{l.outstandingPrincipal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="cbs-amount">{l.interestRate.toFixed(2)}</td>
                    <td className="cbs-amount">{l.emiAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="cbs-tabular">{l.nextDueDate || '—'}</td>
                    <td className={`cbs-amount ${l.overdueAmount > 0 ? 'cbs-amount-debit' : ''}`}>
                      {l.overdueAmount > 0 ? l.overdueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                    </td>
                    <td><StatusRibbon status={l.status} /></td>
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