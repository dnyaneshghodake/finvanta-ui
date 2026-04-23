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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import {
  loanService,
  type RepaymentResponse,
  type RepaymentType,
} from '@/services/api/loanService';
import {
  AccountNo,
  AmountInr,
  AmountDisplay,
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
  repaymentType: z.enum(['EMI', 'PREPAYMENT']),
});

type FormData = z.infer<typeof schema>;

interface ErrorState {
  message: string;
  correlationId?: string;
  errorCode?: string;
}

/**
 * Shallow structural equality for the repayment form. Used to detect
 * whether the operator edited any field between the first confirm
 * click and a subsequent retry — if yes, the idempotency key is
 * invalidated so the new data is evaluated fresh rather than replayed
 * from the backend's idempotency cache.
 */
function formEquals(a: FormData, b: FormData): boolean {
  return (
    a.loanAccount === b.loanAccount &&
    a.amount === b.amount &&
    a.repaymentType === b.repaymentType
  );
}

export default function LoanRepaymentPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { loanAccount: '', amount: '', repaymentType: 'EMI' },
  });

  const [posted, setPosted] = useState<RepaymentResponse | null>(null);
  const [postedType, setPostedType] = useState<RepaymentType>('EMI');
  const [error, setError] = useState<ErrorState | null>(null);
  // CBS: mint a stable idempotency key on the first confirm click.
  // A network-level retry must reuse the same key so the backend
  // de-duplicates via its Redis + DB idempotency cache.
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingData, setPendingData] = useState<FormData | null>(null);

  // Step 1: Form validation passes → show confirm dialog.
  // If the operator edited any field since the last attempt, invalidate
  // the idempotency key — otherwise a stale key paired with different
  // data would cause the backend's idempotency cache to replay the
  // original response instead of evaluating the corrected request.
  const onFormValid = (data: FormData) => {
    setError(null);
    if (pendingData && !formEquals(pendingData, data)) {
      setIdempotencyKey(null);
    }
    setPendingData(data);
    setShowConfirm(true);
  };

  // Step 2: Operator confirms in dialog → post to backend.
  // `loanService.repay` never throws — it always returns an
  // ApiResponse envelope with `correlationId` populated from the
  // BFF's `x-correlation-id` header (for both server validation
  // rejections and AppError-wrapped HTTP failures).
  const onConfirmPost = async () => {
    if (!pendingData) return;
    const key = idempotencyKey ?? loanService.mintKey();
    if (!idempotencyKey) setIdempotencyKey(key);
    const res = await loanService.repay(
      {
        accountNumber: pendingData.loanAccount,
        amount: Number(pendingData.amount),
        type: pendingData.repaymentType,
      },
      key,
    );
    if (!res.success || !res.data) {
      // Per DESIGN_SYSTEM §16b: a 4xx response means the server
      // definitively rejected the request before posting, so clear
      // the key and let the operator's corrected retry be evaluated
      // fresh. A 5xx or network error (statusCode 0 / >=500) means
      // the server MAY have processed — preserve the key so a retry
      // de-duplicates via the backend's idempotency cache.
      const status = res.error?.statusCode ?? 0;
      const safeToClearKey = status >= 400 && status < 500;
      if (safeToClearKey) setIdempotencyKey(null);
      setShowConfirm(false);
      setError({
        message: res.error?.message || 'Repayment could not be processed',
        errorCode: res.error?.code,
        correlationId: res.correlationId,
      });
      return;
    }
    setShowConfirm(false);
    setPosted(res.data);
    setPostedType(pendingData.repaymentType);
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
        { label: 'Repayment' },
      ]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-cbs-ink">Loan Repayment</h1>
          <p className="text-xs text-cbs-steel-600 mt-0.5">
            Maker action — post EMI or prepayment. Principal/interest split
            is computed server-side by the loan engine.
          </p>
        </div>
        {posted && (
          <button type="button" className="cbs-btn cbs-btn-secondary" onClick={onReset}>
            New repayment
          </button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="border border-cbs-crimson-600 bg-cbs-crimson-50 text-cbs-crimson-700 p-3 text-sm"
        >
          <div className="font-semibold">Repayment failed</div>
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
              Repayment Details
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
              <div>
                <label className="cbs-field-label block mb-1" htmlFor="repaymentType">
                  Repayment Type *
                </label>
                <select
                  id="repaymentType"
                  className="cbs-input"
                  {...register('repaymentType')}
                >
                  <option value="EMI">EMI (Regular)</option>
                  <option value="PREPAYMENT">Prepayment (Part/Full)</option>
                </select>
                {errors.repaymentType && (
                  <p className="text-xs text-cbs-crimson-700 mt-1">
                    {errors.repaymentType.message}
                  </p>
                )}
              </div>
              <AmountInr
                label="Amount *"
                {...register('amount')}
                error={errors.amount?.message}
              />
            </div>

            <div className="border border-cbs-gold-600 bg-cbs-gold-50 text-cbs-gold-700 p-3 text-xs">
              <span className="font-semibold">Note:</span> The split between principal
              and interest components is calculated server-side by the loan engine.
              Prepayment may attract charges as per product terms.
            </div>

            <div className="text-xs text-cbs-steel-600 border-t border-cbs-steel-100 pt-3">
              By clicking Review &amp; Confirm you will see a read-only summary
              of this repayment. The actual financial posting happens only
              after you explicitly confirm in the next dialog. A stable
              idempotency key protects against retries.
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-cbs-steel-100">
              <Link href="/loans" className="cbs-btn cbs-btn-secondary">Cancel</Link>
              <Button type="submit" isLoading={isSubmitting}>Review &amp; Confirm</Button>
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
          transactionType={
            pendingData.repaymentType === 'PREPAYMENT' ? 'Loan Prepayment' : 'Loan EMI Repayment'
          }
          amount={Number(pendingData.amount)}
          fields={[
            { label: 'Loan Account', value: pendingData.loanAccount },
            { label: 'Repayment Type', value: pendingData.repaymentType === 'PREPAYMENT' ? 'Prepayment (Part/Full)' : 'EMI (Regular)' },
            { label: 'Amount', value: Number(pendingData.amount), isAmount: true },
          ]}
          warning="Principal/interest split is computed server-side. Prepayment may attract charges per product terms."
        />
      )}

      {/* POSTED confirmation block */}
      {posted && (
        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
              Repayment posted
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
              <KeyValue label="Type">
                {postedType === 'PREPAYMENT' ? 'Prepayment' : 'EMI'}
              </KeyValue>
              <KeyValue label="Amount">
                <AmountDisplay amount={posted.amount} sign="debit" />
              </KeyValue>
              {posted.principalComponent !== undefined && (
                <KeyValue label="Principal">
                  <AmountDisplay amount={posted.principalComponent} sign="neutral" />
                </KeyValue>
              )}
              {posted.interestComponent !== undefined && (
                <KeyValue label="Interest">
                  <AmountDisplay amount={posted.interestComponent} sign="neutral" />
                </KeyValue>
              )}
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