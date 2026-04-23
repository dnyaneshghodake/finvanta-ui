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

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-cbs-ink">Loan Disbursement</h1>
          <p className="text-xs text-cbs-steel-600 mt-0.5">
            Checker action — disburse an approved loan. Credits borrower CASA,
            debits loan GL via TransactionEngine double-entry.
          </p>
        </div>
        {posted && (
          <button type="button" className="cbs-btn cbs-btn-secondary" onClick={onReset}>
            New disbursement
          </button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="border border-cbs-crimson-600 bg-cbs-crimson-50 text-cbs-crimson-700 p-3 text-sm"
        >
          <div className="font-semibold">Disbursement failed</div>
          <div>{error.message}</div>
          {error.correlationId && (
            <div className="mt-1 text-xs cbs-tabular">Ref: {error.correlationId}</div>
          )}
        </div>
      )}

      {!posted && (
        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
              Disbursement Details
            </span>
          </div>
          <form
            onSubmit={handleSubmit(onFormValid)}
            className="cbs-surface-body space-y-4"
            noValidate
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <AccountNo
                label="Loan Account *"
                {...register('loanAccount')}
                error={errors.loanAccount?.message}
              />
              <AmountInr
                label="Disbursement Amount *"
                hint="Tranche amount; server validates against approved limit"
                {...register('amount')}
                error={errors.amount?.message}
              />
              <CbsTextarea
                label="Remarks"
                maxLength={140}
                placeholder="Optional"
                {...register('remarks')}
                error={errors.remarks?.message}
              />
            </div>
            <div className="text-xs text-cbs-steel-600 border-t border-cbs-steel-100 pt-3">
              By clicking Review &amp; Confirm you will see a read-only summary
              of this disbursement. The actual financial posting happens only
              after you explicitly confirm in the next dialog. A stable
              idempotency key protects against retries.
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t border-cbs-steel-100">
              <Link href="/loans" className="cbs-btn cbs-btn-secondary">Cancel</Link>
              <Button type="submit" variant="success" isLoading={isSubmitting}>
                Review &amp; Confirm
              </Button>
            </div>
          </form>
        </section>
      )}

      {/* CBS two-step confirmation dialog (Step 2) */}
      {pendingData && (
        <TransactionConfirmDialog
          isOpen={showConfirm}
          onCancel={() => setShowConfirm(false)}
          onConfirm={onConfirmPost}
          transactionType="Loan Disbursement"
          amount={Number(pendingData.amount)}
          fields={[
            { label: 'Loan Account', value: pendingData.loanAccount },
            { label: 'Disbursement Amount', value: Number(pendingData.amount), isAmount: true },
            ...(pendingData.remarks ? [{ label: 'Remarks', value: pendingData.remarks }] : []),
          ]}
          warning="This will credit the borrower's linked CASA and debit the loan GL via TransactionEngine. Irreversible once posted — use Reversal workflow to correct."
        />
      )}

      {/* POSTED confirmation block */}
      {posted && (
        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
              Disbursement posted
            </span>
          </div>
          <div className="cbs-surface-body space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <KeyValue label="Transaction ref">
                <span className="cbs-tabular">{posted.transactionRef}</span>
              </KeyValue>
              <KeyValue label="Posted at">
                <span className="cbs-tabular">
                  {posted.postedAt ? formatCbsTimestamp(posted.postedAt) : '--'}
                </span>
              </KeyValue>
              <KeyValue label="Loan Account">{posted.accountNumber}</KeyValue>
              <KeyValue label="Amount">
                <AmountDisplay amount={posted.amount} sign="credit" />
              </KeyValue>
            </div>
            <div className="flex items-center gap-2">
              {posted.auditHashPrefix && <AuditHashChip hashPrefix={posted.auditHashPrefix} />}
              {posted.correlationId && <CorrelationRefBadge value={posted.correlationId} />}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}