'use client';

/**
 * FINVANTA CBS — Loan Repayment (Phase 6.4).
 *
 * MAKER action: posts a loan repayment (EMI / prepayment).
 * Calls POST /api/v1/loans/{accountNumber}/repayment.
 *
 * Repayment debits the borrower's CASA and credits the loan account.
 * The split between principal and interest is computed server-side.
 */

import { useState } from 'react';
import { apiClient } from '@/services/api/apiClient';
import { CorrelationRefBadge } from '@/components/cbs';
import { Button } from '@/components/atoms';
import Link from 'next/link';

export default function LoanRepaymentPage() {
  const [loanAccount, setLoanAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [repaymentType, setRepaymentType] = useState<'EMI' | 'PREPAYMENT'>('EMI');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleRepay = async () => {
    if (!loanAccount.trim()) { setError('Loan account is required'); return; }
    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) { setError('Valid repayment amount is required'); return; }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const endpoint = repaymentType === 'PREPAYMENT'
        ? `/loans/${loanAccount.trim().toUpperCase()}/prepayment`
        : `/loans/${loanAccount.trim().toUpperCase()}/repayment`;
      const res = await apiClient.post(endpoint, { amount: Number(amount) });
      const corr = res.headers?.['x-correlation-id'] as string | undefined;
      setCorrelationId(corr || null);
      if (res.data?.status === 'SUCCESS') {
        setSuccess(`${repaymentType === 'PREPAYMENT' ? 'Prepayment' : 'EMI repayment'} of INR ${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })} posted to ${loanAccount}.`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Repayment failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-cbs-ink">Loan Repayment</h1>
        <p className="text-xs text-cbs-steel-600 mt-0.5">
          Maker action — post EMI or prepayment. Principal/interest split
          is computed server-side by the loan engine.
        </p>
      </div>

      {error && (
        <div className="border border-cbs-crimson-600 bg-cbs-crimson-50 text-cbs-crimson-700 p-3 text-sm">
          <div className="font-semibold">Repayment failed</div>
          <div>{error}</div>
        </div>
      )}

      {success && (
        <div className="border border-cbs-olive-600 bg-cbs-olive-50 text-cbs-olive-700 p-3 text-sm">
          <div className="font-semibold">Repayment posted</div>
          <div>{success}</div>
          {correlationId && <div className="mt-2"><CorrelationRefBadge value={correlationId} /></div>}
        </div>
      )}

      {!success && (
        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Repayment Details</span>
          </div>
          <div className="cbs-surface-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="cbs-field-label block mb-1">Loan Account *</label>
                <input className="cbs-input cbs-tabular uppercase" placeholder="Loan account number" value={loanAccount} onChange={(e) => setLoanAccount(e.target.value)} />
              </div>
              <div>
                <label className="cbs-field-label block mb-1">Repayment Type *</label>
                <select className="cbs-input" value={repaymentType} onChange={(e) => setRepaymentType(e.target.value as 'EMI' | 'PREPAYMENT')}>
                  <option value="EMI">EMI (Regular)</option>
                  <option value="PREPAYMENT">Prepayment (Part/Full)</option>
                </select>
              </div>
              <div>
                <label className="cbs-field-label block mb-1">Amount *</label>
                <div className="flex cbs-input p-0 overflow-hidden">
                  <span className="inline-flex items-center px-3 bg-cbs-mist border-r border-cbs-steel-200 text-cbs-steel-700 text-xs font-semibold uppercase tracking-wider">INR</span>
                  <input className="flex-1 cbs-amount bg-transparent outline-none px-2 h-[32px]" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="border border-cbs-gold-600 bg-cbs-gold-50 text-cbs-gold-700 p-3 text-xs">
              <span className="font-semibold">Note:</span> The split between principal
              and interest components is calculated server-side by the loan engine.
              Prepayment may attract charges as per product terms.
            </div>

            <div className="flex gap-2 justify-end border-t border-cbs-steel-200 pt-3">
              <Link href="/loans" className="cbs-btn cbs-btn-secondary">Cancel</Link>
              <Button isLoading={submitting} onClick={handleRepay}>Post Repayment</Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}