'use client';

/**
 * FINVANTA CBS - Fund Transfer (capture -> confirm).
 *
 * Tier-1 two-leg CBS transfer workflow. The UI never computes
 * fees, cutoffs, NPCI windows, or limit checks -- that is the sole
 * responsibility of Spring `TransactionEngine.execute()`. We simply:
 *
 *   1. Capture from / to / amount / narration / value date.
 *   2. Require an explicit "Confirm" with a stable X-Idempotency-Key
 *      minted once on the first Confirm click. A transient network
 *      failure can safely retry -- the backend de-duplicates on the
 *      same key.
 *   3. On success show the TransactionEngine's transactionRef and
 *      the correlation id so the operator can trust the entry.
 *
 * Preview is deliberately omitted: Spring has no dry-run endpoint
 * and CBS preview semantics belong to `TransactionEngine` itself.
 * Surfacing a client-computed preview would risk drift from server
 * truth -- explicitly forbidden under RBI IT Governance 2023.
 */

import { useState, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isAxiosError } from 'axios';
import {
  transferService,
  type TransferRequest,
  type TransferResponse,
} from '@/services/api/transferService';
import {
  AccountNo,
  AmountInr,
  AmountDisplay,
  AuditHashChip,
  CorrelationRefBadge,
  KeyValue,
  StatusRibbon,
  CbsFieldset,
  CbsTextarea,
  Breadcrumb,
  CbsDatePicker,
  TransactionConfirmDialog,
} from '@/components/cbs';
import { useCbsKeyboard } from '@/hooks/useCbsKeyboard';
import { formatCurrency, formatCbsTimestamp } from '@/utils/formatters';

const ACCOUNT_NUMBER_RE = /^[A-Z0-9][A-Z0-9-]{5,24}$/;

const schema = z.object({
  fromAccountNumber: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(ACCOUNT_NUMBER_RE, 'Enter a valid debit account number')),
  toAccountNumber: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(ACCOUNT_NUMBER_RE, 'Enter a valid credit account number')),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount')
    .refine((v) => Number(v) > 0, 'Amount must be greater than zero'),
  narration: z.string().max(140, 'Narration is too long').optional(),
  valueDate: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

type Phase = 'capture' | 'posted';

interface ErrorState {
  message: string;
  correlationId?: string;
  errorCode?: string;
}

export default function TransfersPage() {
  const formRef = useRef<HTMLFormElement>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      fromAccountNumber: '',
      toAccountNumber: '',
      amount: '',
      narration: '',
      valueDate: '',
    },
  });

  const [phase, setPhase] = useState<Phase>('capture');
  const [posted, setPosted] = useState<TransferResponse | null>(null);
  const [error, setError] = useState<ErrorState | null>(null);
  // CBS: mint a stable idempotency key on the first confirm click.
  // A network-level retry must reuse the same key so the backend
  // de-duplicates via its Redis + DB idempotency cache.
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  // CBS two-step confirmation: capture → confirm dialog → post
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingData, setPendingData] = useState<FormData | null>(null);

  // CBS keyboard shortcuts: F8 = Submit/Post, F10 = Submit form (CBS convention)
  const shortcuts = useMemo(() => ({
    F8: () => {
      if (phase === 'capture') formRef.current?.requestSubmit();
    },
    F10: () => {
      if (phase === 'capture') formRef.current?.requestSubmit();
    },
  }), [phase]);
  useCbsKeyboard(shortcuts);

  const toReq = (f: FormData): TransferRequest => ({
    fromAccountNumber: f.fromAccountNumber.trim().toUpperCase(),
    toAccountNumber: f.toAccountNumber.trim().toUpperCase(),
    amount: Number(f.amount),
    narration: f.narration || undefined,
    valueDate: f.valueDate || undefined,
  });

  // Step 1: Form validation passes → show confirm dialog
  const onFormValid = (data: FormData) => {
    setError(null);
    setPendingData(data);
    setShowConfirm(true);
  };

  // Step 2: Operator confirms in dialog → post to backend
  const onConfirmPost = async () => {
    if (!pendingData) return;
    const key = idempotencyKey ?? transferService.mintKey();
    if (!idempotencyKey) setIdempotencyKey(key);
    try {
      const res = await transferService.confirm(toReq(pendingData), key);
      if (!res.success || !res.data) {
        // Server validation rejection (INSUFFICIENT_FUNDS, LIMIT_EXCEEDED,
        // ACCOUNT_FROZEN, etc.) — the server did NOT process the transfer,
        // so the idempotency key must be cleared. Reusing it on the next
        // attempt (after the operator corrects the input) would cause the
        // backend's idempotency cache to replay the cached rejection
        // instead of evaluating the corrected request.
        setIdempotencyKey(null);
        setShowConfirm(false);
        setError({
          message: res.error?.message || 'Transfer could not be processed',
          errorCode: res.error?.code,
        });
        return;
      }
      setShowConfirm(false);
      setPosted(res.data);
      setPhase('posted');
    } catch (err) {
      // Network-level error — the server MAY have processed the request.
      // Keep the idempotency key so a retry de-duplicates correctly.
      setShowConfirm(false);
      handleError(err);
    }
  };

  const handleError = (err: unknown) => {
    if (isAxiosError(err)) {
      setError({
        message: err.response?.data?.message || err.response?.data?.error?.message || err.message,
        correlationId:
          (err.response?.headers?.['x-correlation-id'] as string) ||
          err.response?.data?.correlationId,
        errorCode:
          err.response?.data?.errorCode || err.response?.data?.error?.code,
      });
      return;
    }
    setError({ message: err instanceof Error ? err.message : 'Unexpected error' });
  };

  const onReset = () => {
    setPhase('capture');
    setPosted(null);
    setIdempotencyKey(null);
    setShowConfirm(false);
    setPendingData(null);
    setError(null);
    reset();
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb — mandatory CBS navigation trail */}
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Transfers' },
      ]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-cbs-ink">Fund Transfer</h1>
          <p className="text-xs text-cbs-steel-600">
            Intra-bank internal transfer.
            {phase === 'capture' && <><span className="cbs-kbd ml-2">F8</span> Post</>}
          </p>
        </div>
        {phase !== 'capture' && (
          <button type="button" className="cbs-btn cbs-btn-secondary" onClick={onReset}>
            New transfer
          </button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="border border-cbs-crimson-600 bg-cbs-crimson-50 text-cbs-crimson-700 p-3 text-sm"
        >
          <div className="font-semibold">
            {error.errorCode === 'VERSION_CONFLICT'
              ? 'Record changed -- refresh and retry'
              : 'Transfer could not be processed'}
          </div>
          <div>{error.message}</div>
          {error.correlationId && (
            <div className="mt-1 text-xs cbs-tabular">Ref: {error.correlationId}</div>
          )}
        </div>
      )}

      {phase === 'capture' && (
        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <div className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
              Capture details
            </div>
          </div>
          <form
            ref={formRef}
            onSubmit={handleSubmit(onFormValid)}
            className="cbs-surface-body space-y-4"
          >
            <CbsFieldset legend="Debit Leg">
              <div className="grid md:grid-cols-2 gap-4">
                <AccountNo
                  label="Debit account"
                  {...register('fromAccountNumber')}
                  error={errors.fromAccountNumber?.message}
                />
              </div>
            </CbsFieldset>

            <CbsFieldset legend="Credit Leg">
              <div className="grid md:grid-cols-2 gap-4">
                <AccountNo
                  label="Credit account"
                  {...register('toAccountNumber')}
                  error={errors.toAccountNumber?.message}
                />
              </div>
            </CbsFieldset>

            <CbsFieldset legend="Transaction Details">
              <div className="grid md:grid-cols-2 gap-4">
                <AmountInr label="Amount" {...register('amount')} error={errors.amount?.message} />
                {(() => {
                  const r = register('valueDate');
                  return (
                    <CbsDatePicker
                      label="Value date"
                      hint="Defaults to today if left blank. Weekends and 2nd/4th Saturdays are greyed."
                      name={r.name}
                      onChange={r.onChange}
                      onBlur={r.onBlur}
                      ref={r.ref}
                    />
                  );
                })()}
                <div className="md:col-span-2">
                  <CbsTextarea
                    label="Narration"
                    maxLength={140}
                    placeholder="e.g. Rent payment — Apr 2026"
                    {...register('narration')}
                    error={errors.narration?.message}
                  />
                </div>
              </div>
            </CbsFieldset>

            <div className="text-xs text-cbs-steel-600 border-t border-cbs-steel-100 pt-3">
              By clicking Confirm you authorise the TransactionEngine to post a
              double-entry journal into the general ledger. A stable idempotency
              key protects against retries. This action is maker-checker gated
              when the amount exceeds your role limit.
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t border-cbs-steel-100">
              <button
                type="submit"
                disabled={isSubmitting}
                className="cbs-btn cbs-btn-primary"
              >
                {isSubmitting ? 'Validating...' : 'Review & Confirm'}
              </button>
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
          transactionType="Internal Transfer"
          amount={Number(pendingData.amount)}
          fields={[
            { label: 'Debit Account', value: pendingData.fromAccountNumber },
            { label: 'Credit Account', value: pendingData.toAccountNumber },
            { label: 'Amount', value: Number(pendingData.amount), isAmount: true },
            ...(pendingData.valueDate ? [{ label: 'Value Date', value: pendingData.valueDate }] : []),
            ...(pendingData.narration ? [{ label: 'Narration', value: pendingData.narration }] : []),
          ]}
        />
      )}

      {phase === 'posted' && posted && (
        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <div className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
              Transfer posted
            </div>
            <StatusRibbon status={posted.status || 'POSTED'} />
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
              <KeyValue label="Debit account">{posted.fromAccountNumber}</KeyValue>
              <KeyValue label="Credit account">{posted.toAccountNumber}</KeyValue>
              <KeyValue label="Amount">
                <AmountDisplay amount={posted.amount} sign="debit" />
              </KeyValue>
            </div>
            <div className="flex items-center gap-2">
              <AuditHashChip hashPrefix={posted.auditHashPrefix} />
              <CorrelationRefBadge value={posted.correlationId} />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
