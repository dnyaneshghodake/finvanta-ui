'use client';

/**
 * FINVANTA CBS - Fund Transfer (preview -> confirm).
 *
 * Tier-1 two-leg CBS transfer workflow, aligned with Finacle "Funds
 * Transfer" and Temenos T24 AC.FUNDS.TRANSFER. The UI never computes
 * fees, cutoffs, NPCI windows, or limit checks -- that is the sole
 * responsibility of Spring TransactionEngine.execute(). We simply:
 *
 *   1. Capture from / to / amount / narration / value date.
 *   2. Call `/api/cbs/accounts/transfer/preview` for a server-side
 *      informational dry-run (no ledger mutation).
 *   3. Show the operator what will happen, then require an explicit
 *      "Confirm" with a stable X-Idempotency-Key generated once at
 *      render of the confirm dialog. A transient network failure can
 *      safely retry -- the backend de-duplicates on the key.
 *   4. On success show the TransactionEngine's transactionRef and the
 *      SHA-256 audit-hash-prefix so the operator can trust the entry.
 */

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isAxiosError } from 'axios';
import { transferService, type TransferRequest, type TransferResponse } from '@/services/api/transferService';
import {
  AccountNo,
  AmountInr,
  AmountDisplay,
  ValueDate,
  AuditHashChip,
  CorrelationRefBadge,
  KeyValue,
  StatusRibbon,
} from '@/components/cbs';

const schema = z.object({
  fromAccountNumber: z
    .string()
    .regex(/^\d{10,20}$/, 'Enter a valid debit account number'),
  toAccountNumber: z
    .string()
    .regex(/^\d{10,20}$/, 'Enter a valid credit account number'),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount')
    .refine((v) => Number(v) > 0, 'Amount must be greater than zero'),
  narration: z.string().max(140, 'Narration is too long').optional(),
  valueDate: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

type Phase = 'capture' | 'preview' | 'posted';

interface ErrorState {
  message: string;
  correlationId?: string;
  errorCode?: string;
}

export default function TransfersPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
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
  const [preview, setPreview] = useState<TransferResponse | null>(null);
  const [posted, setPosted] = useState<TransferResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  // CBS: mint a stable idempotency key when the operator moves into
  // the confirm phase. A network-level retry must not double-post.
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  const current = watch();

  const toReq = (f: FormData): TransferRequest => ({
    fromAccountNumber: f.fromAccountNumber,
    toAccountNumber: f.toAccountNumber,
    amount: Number(f.amount),
    narration: f.narration || undefined,
    valueDate: f.valueDate || undefined,
  });

  const onPreview = async (data: FormData) => {
    setError(null);
    try {
      const res = await transferService.preview(toReq(data));
      if (!res.success || !res.data) {
        throw new Error(res.error?.message || 'Preview unavailable');
      }
      setPreview(res.data);
      setIdempotencyKey(transferService.mintKey());
      setPhase('preview');
    } catch (err) {
      handleError(err);
    }
  };

  const onConfirm = async () => {
    if (!preview || !idempotencyKey) return;
    setPending(true);
    setError(null);
    try {
      const res = await transferService.confirm(toReq(current), idempotencyKey);
      if (!res.success || !res.data) {
        throw new Error(res.error?.message || 'Transfer failed');
      }
      setPosted(res.data);
      setPhase('posted');
    } catch (err) {
      handleError(err);
    } finally {
      setPending(false);
    }
  };

  const handleError = (err: unknown) => {
    if (isAxiosError(err)) {
      setError({
        message: err.response?.data?.error?.message || err.message,
        correlationId:
          (err.response?.headers?.['x-correlation-id'] as string) ||
          err.response?.data?.correlationId,
        errorCode: err.response?.data?.error?.code || err.response?.data?.errorCode,
      });
      return;
    }
    setError({ message: err instanceof Error ? err.message : 'Unexpected error' });
  };

  const onReset = () => {
    setPhase('capture');
    setPreview(null);
    setPosted(null);
    setIdempotencyKey(null);
    setError(null);
    reset();
  };

  const disableConfirm = useMemo(() => pending || !idempotencyKey, [pending, idempotencyKey]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-cbs-ink">Fund Transfer</h1>
          <p className="text-xs text-cbs-steel-600">
            Intra-bank internal transfer. Posting routes through the
            TransactionEngine with idempotency and hash-chain audit.
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
            <div className="mt-1 text-xs font-mono">Ref: {error.correlationId}</div>
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
          <form onSubmit={handleSubmit(onPreview)} className="cbs-surface-body grid md:grid-cols-2 gap-4">
            <AccountNo
              label="Debit account"
              {...register('fromAccountNumber')}
              error={errors.fromAccountNumber?.message}
            />
            <AccountNo
              label="Credit account"
              {...register('toAccountNumber')}
              error={errors.toAccountNumber?.message}
            />
            <AmountInr label="Amount" {...register('amount')} error={errors.amount?.message} />
            <ValueDate
              label="Value date"
              hint="Defaults to today if left blank."
              {...register('valueDate')}
            />
            <div className="md:col-span-2">
              <label htmlFor="narration" className="cbs-field-label block mb-1">
                Narration
              </label>
              <input
                id="narration"
                type="text"
                maxLength={140}
                className="cbs-input"
                {...register('narration')}
              />
              {errors.narration && (
                <div className="mt-1 text-xs text-cbs-crimson-700">
                  {errors.narration.message}
                </div>
              )}
            </div>
            <div className="md:col-span-2 flex gap-2 justify-end pt-2 border-t border-cbs-steel-100">
              <button type="submit" disabled={isSubmitting} className="cbs-btn cbs-btn-primary">
                {isSubmitting ? 'Previewing...' : 'Preview'}
              </button>
            </div>
          </form>
        </section>
      )}

      {phase === 'preview' && preview && (
        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <div className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
              Preview -- please verify before confirm
            </div>
            <StatusRibbon status="PENDING_APPROVAL" />
          </div>
          <div className="cbs-surface-body grid md:grid-cols-2 gap-4">
            <KeyValue label="Debit account">{current.fromAccountNumber}</KeyValue>
            <KeyValue label="Credit account">{current.toAccountNumber}</KeyValue>
            <KeyValue label="Amount">
              <AmountDisplay amount={current.amount} sign="debit" />
            </KeyValue>
            <KeyValue label="Value date">{current.valueDate || 'Today'}</KeyValue>
            <div className="md:col-span-2">
              <KeyValue label="Narration">{current.narration || <em className="text-cbs-steel-600">(none)</em>}</KeyValue>
            </div>
            <div className="md:col-span-2 text-xs text-cbs-steel-600 border-t border-cbs-steel-100 pt-3">
              By clicking Confirm you authorise the TransactionEngine to post a
              double-entry journal into the general ledger. A stable idempotency
              key protects against retries. This action is maker-checker gated
              when the amount exceeds your role limit.
            </div>
            <div className="md:col-span-2 flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setPhase('capture')}
                className="cbs-btn cbs-btn-secondary"
              >
                Back
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={disableConfirm}
                className="cbs-btn cbs-btn-primary"
              >
                {pending ? 'Posting...' : 'Confirm transfer'}
              </button>
            </div>
          </div>
        </section>
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
                  {posted.postedAt ? new Date(posted.postedAt).toISOString().replace('T', ' ').slice(0, 19) : '--'}
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
