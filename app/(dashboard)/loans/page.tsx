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
import { StatusRibbon, Breadcrumb } from '@/components/cbs';
import { Spinner } from '@/components/atoms';
import { formatCbsDate } from '@/utils/formatters';

interface LoanRecord {
  id: number;
  accountNumber: string;
  customerName?: string;
  customerNumber?: string;
  productCode: string;
  sanctionedAmount: number;
  disbursedAmount: number;
  outstandingPrincipal: number;
  interestRate: number;
  emiAmount: number;
  tenureMonths?: number;
  sanctionDate?: string;
  disbursementDate?: string;
  nextDueDate?: string;
  overdueAmount: number;
  /** Days past due — drives NPA classification. */
  dpd?: number;
  /** RBI NPA classification: STANDARD, SMA-0, SMA-1, SMA-2, SUB_STANDARD, DOUBTFUL, LOSS. */
  npaClassification?: string;
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

  const NPA_TONE: Record<string, string> = {
    STANDARD: 'text-cbs-olive-700 bg-cbs-olive-50 border-cbs-olive-600',
    'SMA-0': 'text-cbs-gold-700 bg-cbs-gold-50 border-cbs-gold-600',
    'SMA-1': 'text-cbs-gold-700 bg-cbs-gold-50 border-cbs-gold-600',
    'SMA-2': 'text-cbs-crimson-700 bg-cbs-crimson-50 border-cbs-crimson-600',
    SUB_STANDARD: 'text-cbs-crimson-700 bg-cbs-crimson-50 border-cbs-crimson-600',
    DOUBTFUL: 'text-cbs-crimson-700 bg-cbs-crimson-50 border-cbs-crimson-600',
    LOSS: 'text-white bg-cbs-crimson-700 border-cbs-crimson-700',
  };

  return (
    <div className="space-y-4">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Loans' },
      ]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-cbs-ink">Loan Portfolio</h1>
          <p className="text-xs text-cbs-steel-600 mt-0.5">
            Active loan accounts for current branch.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/loans/disburse" className="cbs-btn cbs-btn-secondary">Disbursement</Link>
          <Link href="/loans/repay" className="cbs-btn cbs-btn-secondary">Repayment</Link>
          <Link href="/loans/apply" className="cbs-btn cbs-btn-primary">+ New Application</Link>
        </div>
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
                  <th className="text-right">Sanctioned</th>
                  <th className="text-right">Disbursed</th>
                  <th className="text-right">Outstanding</th>
                  <th className="text-right">Rate %</th>
                  <th className="text-right">EMI</th>
                  <th>Tenure</th>
                  <th>Next Due</th>
                  <th className="text-right">Overdue</th>
                  <th>DPD</th>
                  <th>NPA Class</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((l) => (
                  <tr key={l.id}>
                    <td className="cbs-tabular font-semibold text-cbs-navy-700">{l.accountNumber}</td>
                    <td className="text-cbs-ink">
                      {l.customerName || '—'}
                      {l.customerNumber && (
                        <div className="text-[10px] text-cbs-steel-500 cbs-tabular">{l.customerNumber}</div>
                      )}
                    </td>
                    <td className="cbs-tabular text-cbs-steel-600">{l.productCode}</td>
                    <td className="cbs-amount">{l.sanctionedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="cbs-amount">{l.disbursedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="cbs-amount">{l.outstandingPrincipal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="cbs-amount">{l.interestRate.toFixed(2)}</td>
                    <td className="cbs-amount">{l.emiAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="cbs-tabular">{l.tenureMonths ? `${l.tenureMonths}M` : '—'}</td>
                    <td className="cbs-tabular">{l.nextDueDate ? formatCbsDate(l.nextDueDate) : '—'}</td>
                    <td className={`cbs-amount ${l.overdueAmount > 0 ? 'cbs-amount-debit' : ''}`}>
                      {l.overdueAmount > 0 ? l.overdueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                    </td>
                    <td className={`cbs-tabular text-xs ${(l.dpd ?? 0) > 0 ? 'font-semibold text-cbs-crimson-700' : 'text-cbs-steel-500'}`}>
                      {l.dpd != null ? l.dpd : '—'}
                    </td>
                    <td>
                      {l.npaClassification ? (
                        <span className={`cbs-ribbon ${NPA_TONE[l.npaClassification] || 'text-cbs-steel-700 bg-cbs-mist border-cbs-steel-300'}`}>
                          {l.npaClassification.replace(/_/g, ' ')}
                        </span>
                      ) : (
                        <span className="text-xs text-cbs-steel-500">—</span>
                      )}
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