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
  TransactionConfirmDialog,
} from '@/components/cbs';
import { useCbsKeyboard } from '@/hooks/useCbsKeyboard';
import { formatCbsTimestamp } from '@/utils/formatters';

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
});

type FormData = z.infer<typeof schema>;

type Phase = 'capture' | 'posted';

interface ErrorState {
  message: string;
  correlationId?: string;
  errorCode?: string;
}

/**
 * Shallow structural equality for the transfer form. Used to detect
 * whether the operator edited any field between the first confirm
 * click and a subsequent retry — if yes, the idempotency key is
 * invalidated so the new data is evaluated fresh rather than replayed
 * from the backend's idempotency cache (DESIGN_SYSTEM §16b).
 */
function formEquals(a: FormData, b: FormData): boolean {
  return (
    a.fromAccountNumber === b.fromAccountNumber &&
    a.toAccountNumber === b.toAccountNumber &&
    a.amount === b.amount &&
    (a.narration || '') === (b.narration || '')
  );
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
  });

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
  // `transferService.confirm` never throws — it always returns an
  // ApiResponse envelope with `correlationId` populated from the
  // BFF's `x-correlation-id` header (for both server validation
  // rejections and AppError-wrapped HTTP failures).
  const onConfirmPost = async () => {
    if (!pendingData) return;
    const key = idempotencyKey ?? transferService.mintKey();
    if (!idempotencyKey) setIdempotencyKey(key);
    const res = await transferService.confirm(toReq(pendingData), key);
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
        message: res.error?.message || 'Transfer could not be processed',
        errorCode: res.error?.code,
        correlationId: res.correlationId,
      });
      return;
    }
    setShowConfirm(false);
    setIdempotencyKey(null);
    setPosted(res.data);
    setPhase('posted');
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
            <div className="mt-2"><CorrelationRefBadge value={error.correlationId} /></div>
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
              {/* Value-date input intentionally omitted: Spring
                  `/v1/accounts/transfer` posts on the server's
                  businessDate and ignores any client-supplied date.
                  Surfacing an input here would mislead the operator
                  per RBI §8.2 display-integrity guidance. */}
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
