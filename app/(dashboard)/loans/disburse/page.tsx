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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isAxiosError } from 'axios';
import Link from 'next/link';
import { loanService, type DisburseResponse } from '@/services/api/loanService';
import {
  AccountNo,
  AmountInr,
  AmountDisplay,
  CbsTextarea,
  CorrelationRefBadge,
  Breadcrumb,
  TransactionConfirmDialog,
  AuditHashChip,
  KeyValue,
} from '@/components/cbs';
import { Button } from '@/components/atoms';
import { formatCbsTimestamp } from '@/utils/formatters';

const ACCOUNT_NUMBER_RE = /^[A-Z0-9][A-Z0-9-]{5,24}$/;

const schema = z.object({
  loanAccount: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(ACCOUNT_NUMBER_RE, 'Enter a valid loan account number')),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount')
    .refine((v) => Number(v) > 0, 'Amount must be greater than zero'),
  remarks: z.string().max(140, 'Remarks are too long').optional(),
});

type FormData = z.infer<typeof schema>;

interface ErrorState {
  message: string;
  correlationId?: string;
  errorCode?: string;
}

export default function LoanDisbursePage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { loanAccount: '', amount: '', remarks: '' },
  });

  const [posted, setPosted] = useState<DisburseResponse | null>(null);
  const [error, setError] = useState<ErrorState | null>(null);
  // CBS: mint a stable idempotency key on the first confirm click.
  // A network-level retry must reuse the same key so the backend
  // de-duplicates via its Redis + DB idempotency cache.
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingData, setPendingData] = useState<FormData | null>(null);

  // Step 1: Form validation passes → show confirm dialog
  const onFormValid = (data: FormData) => {
    setError(null);
    setPendingData(data);
    setShowConfirm(true);
  };

  // Step 2: Operator confirms in dialog → post to backend
  const onConfirmPost = async () => {
    if (!pendingData) return;
    const key = idempotencyKey ?? loanService.mintKey();
    if (!idempotencyKey) setIdempotencyKey(key);
    try {
      const res = await loanService.disburse(
        {
          accountNumber: pendingData.loanAccount,
          amount: Number(pendingData.amount),
          narration: pendingData.remarks || undefined,
        },
        key,
      );
      if (!res.success || !res.data) {
        // Server validation rejection — clear the key so a corrected
        // retry is evaluated fresh, not replayed from idempotency cache.
        setIdempotencyKey(null);
        setShowConfirm(false);
        setError({
          message: res.error?.message || 'Disbursement could not be processed',
          errorCode: res.error?.code,
        });
        return;
      }
      setShowConfirm(false);
      setPosted(res.data);
    } catch (err: unknown) {
      // Network-level error — the server MAY have processed the request.
      // Keep the idempotency key so a retry de-duplicates correctly.
      setShowConfirm(false);
      if (isAxiosError(err)) {
        setError({
          message:
            err.response?.data?.message ||
            err.response?.data?.error?.message ||
            err.message,
          correlationId:
            (err.response?.headers?.['x-correlation-id'] as string) ||
            err.response?.data?.correlationId,
          errorCode:
            err.response?.data?.errorCode || err.response?.data?.error?.code,
        });
        return;
      }
      setError({
        message: err instanceof Error ? err.message : 'Disbursement failed',
      });
    }
  };

  const onReset = () => {
    setPosted(null);
    setError(null);
    setIdempotencyKey(null);
    setPendingData(null);
    reset();
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