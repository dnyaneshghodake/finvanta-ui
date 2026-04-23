'use client';

/**
 * FINVANTA CBS — Loan Disbursement (Phase 6.3).
 *
 * CHECKER action: disburses an approved loan.
 * Calls POST /api/v1/loans/{accountNumber}/disburse.
 *
 * Disbursement credits the borrower's linked CASA account and
 * debits the loan GL. The TransactionEngine handles the double-entry.
 */

import { useState } from 'react';
import { apiClient } from '@/services/api/apiClient';
import { AccountNo, AmountInr, CorrelationRefBadge, Breadcrumb } from '@/components/cbs';
import { Button } from '@/components/atoms';
import Link from 'next/link';

export default function LoanDisbursePage() {
  const [loanAccount, setLoanAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleDisburse = async () => {
    if (!loanAccount.trim()) { setError('Loan account number is required'); return; }
    if (!amount.trim() || isNaN(Number(amount))) { setError('Valid disbursement amount is required'); return; }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      // REST_API_COMPLETE_CATALOGUE §Loans:
      //   POST /{accountNumber}/disburse — full disbursement (empty body)
      //   POST /{accountNumber}/disburse-tranche — partial (body: { amount, narration })
      // If amount is provided, use tranche endpoint; otherwise full disburse.
      const acct = loanAccount.trim().toUpperCase();
      const hasAmount = amount.trim() && !isNaN(Number(amount)) && Number(amount) > 0;
      const endpoint = hasAmount
        ? `/loans/${acct}/disburse-tranche`
        : `/loans/${acct}/disburse`;
      const body = hasAmount
        ? { amount: Number(amount), narration: remarks.trim() || undefined }
        : {};
      const res = await apiClient.post(endpoint, body);
      const corr = res.headers?.['x-correlation-id'] as string | undefined;
      setCorrelationId(corr || null);
      if (res.data?.status === 'SUCCESS') {
        setSuccess(`Loan ${loanAccount} disbursed successfully. Amount credited to borrower's CASA.`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Disbursement failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Loans', href: '/loans' },
        { label: 'Disbursement' },
      ]} />

      <div>
        <h1 className="text-lg font-semibold text-cbs-ink">Loan Disbursement</h1>
        <p className="text-xs text-cbs-steel-600 mt-0.5">
          Checker action — disburse an approved loan. Credits borrower CASA,
          debits loan GL via TransactionEngine double-entry.
        </p>
      </div>

      {error && (
        <div className="border border-cbs-crimson-600 bg-cbs-crimson-50 text-cbs-crimson-700 p-3 text-sm">
          <div className="font-semibold">Disbursement failed</div>
          <div>{error}</div>
        </div>
      )}

      {success && (
        <div className="border border-cbs-olive-600 bg-cbs-olive-50 text-cbs-olive-700 p-3 text-sm">
          <div className="font-semibold">Disbursement successful</div>
          <div>{success}</div>
          {correlationId && <div className="mt-2"><CorrelationRefBadge value={correlationId} /></div>}
        </div>
      )}

      {!success && (
        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Disbursement Details</span>
          </div>
          <div className="cbs-surface-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="cbs-field-label block mb-1">Loan Account *</label>
                <input className="cbs-input cbs-tabular uppercase" placeholder="Loan account number" value={loanAccount} onChange={(e) => setLoanAccount(e.target.value)} />
              </div>
              <div>
                <label className="cbs-field-label block mb-1">Disbursement Amount *</label>
                <div className="flex cbs-input p-0 overflow-hidden">
                  <span className="inline-flex items-center px-3 bg-cbs-mist border-r border-cbs-steel-200 text-cbs-steel-700 text-xs font-semibold uppercase tracking-wider">INR</span>
                  <input className="flex-1 cbs-amount bg-transparent outline-none px-2 h-[32px]" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="cbs-field-label block mb-1">Remarks</label>
                <input className="cbs-input" placeholder="Optional" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 justify-end border-t border-cbs-steel-200 pt-3">
              <Link href="/loans" className="cbs-btn cbs-btn-secondary">Cancel</Link>
              <Button variant="success" isLoading={submitting} onClick={handleDisburse}>Disburse Loan</Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}