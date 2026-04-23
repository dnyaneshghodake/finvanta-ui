'use client';

/**
 * FINVANTA CBS — Book Fixed Deposit (Phase 5.2).
 *
 * MAKER action: books a new FD via POST /api/v1/fixed-deposits/book.
 *
 * Prerequisites:
 *   - Customer CIF must be ACTIVE with verified KYC
 *   - Linked CASA account for interest credit
 *   - Minimum deposit amount as per product master
 *
 * The FD enters PENDING_APPROVAL until checker authorises.
 * Interest rate is determined server-side by the product + tenure slab.
 * UI does NOT compute interest — that is TransactionEngine's job.
 *
 * CBS two-step financial-safety flow (DESIGN_SYSTEM §14b + §16b):
 *   1. CAPTURE — operator fills the form; Zod validates shape.
 *   2. CONFIRM — `TransactionConfirmDialog` renders a read-only
 *      summary with an explicit "I confirm" checkbox. The idempotency
 *      key is minted once on first Confirm click and re-used for any
 *      transient-retry attempts. On server-side validation rejection
 *      (INSUFFICIENT_FUNDS, PRODUCT_INACTIVE, etc.) the key is cleared
 *      so the corrected request is evaluated fresh; on network error
 *      the key is preserved so the backend idempotency cache can dedupe.
 *   3. POSTED — router navigates to the FD list on success.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { depositService } from '@/services/api/depositService';
import {
  AmountInr,
  AccountNo,
  Breadcrumb,
  TransactionConfirmDialog,
} from '@/components/cbs';
import { Button } from '@/components/atoms';
import { useAuthStore } from '@/store/authStore';
import Link from 'next/link';

const fdSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  linkedAccountNumber: z.string().min(6, 'Linked CASA account is required'),
  depositAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount')
    .refine((v) => Number(v) >= 1000, 'Minimum FD amount is INR 1,000'),
  tenureMonths: z.string().regex(/^\d+$/, 'Enter tenure in months')
    .refine((v) => Number(v) >= 1 && Number(v) <= 120, 'Tenure must be 1-120 months'),
  autoRenew: z.boolean(),
  nomineeName: z.string().optional(),
});

type FdForm = z.infer<typeof fdSchema>;

interface ErrorState {
  message: string;
  correlationId?: string;
  errorCode?: string;
}

/**
 * Shallow structural equality for FdForm. Used to detect whether the
 * operator edited any field between the first confirm click and a
 * subsequent retry — if yes, the idempotency key is invalidated so
 * the new data is evaluated fresh rather than replayed from cache.
 */
function fdFormEquals(a: FdForm, b: FdForm): boolean {
  return (
    a.customerId === b.customerId &&
    a.linkedAccountNumber === b.linkedAccountNumber &&
    a.depositAmount === b.depositAmount &&
    a.tenureMonths === b.tenureMonths &&
    a.autoRenew === b.autoRenew &&
    (a.nomineeName || '') === (b.nomineeName || '')
  );
}

export default function BookFdPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [error, setError] = useState<ErrorState | null>(null);

  // CBS: mint a stable idempotency key on the first confirm click.
  // A network-level retry must reuse the same key so the backend
  // de-duplicates via its Redis + DB idempotency cache.
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  // CBS two-step confirmation: capture → confirm dialog → post
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingData, setPendingData] = useState<FdForm | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FdForm>({
    resolver: zodResolver(fdSchema),
    defaultValues: {
      customerId: '', linkedAccountNumber: '', depositAmount: '',
      tenureMonths: '', autoRenew: false, nomineeName: '',
    },
  });

  // Step 1: Form validation passes → show confirm dialog.
  // If the operator edited any field since the last attempt, invalidate
  // the idempotency key — otherwise a stale key paired with different
  // data would cause the backend's idempotency cache to replay the
  // original response instead of evaluating the corrected request.
  const onFormValid = (data: FdForm) => {
    setError(null);
    if (pendingData && !fdFormEquals(pendingData, data)) {
      setIdempotencyKey(null);
    }
    setPendingData(data);
    setShowConfirm(true);
  };

  // Step 2: Operator confirms in dialog → post to backend.
  // `depositService.bookFd` never throws — it always returns an
  // ApiResponse envelope with `correlationId` populated from the
  // BFF's `x-correlation-id` header (for both server validation
  // rejections and AppError-wrapped HTTP failures).
  const onConfirmPost = async () => {
    if (!pendingData) return;
    const key = idempotencyKey ?? depositService.mintKey();
    if (!idempotencyKey) setIdempotencyKey(key);
    const res = await depositService.bookFd(
      {
        customerId: Number(pendingData.customerId),
        branchId: user?.branchId || 1,
        linkedAccountNumber: pendingData.linkedAccountNumber.toUpperCase(),
        principalAmount: Number(pendingData.depositAmount),
        tenureDays: Number(pendingData.tenureMonths) * 30, // server recalculates exact
        interestPayoutMode: 'MATURITY',
        autoRenewalMode: pendingData.autoRenew ? 'YES' : 'NO',
        nomineeName: pendingData.nomineeName || undefined,
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
        message: res.error?.message || 'FD booking could not be processed',
        errorCode: res.error?.code,
        correlationId: res.correlationId,
      });
      return;
    }
    setShowConfirm(false);
    reset();
    setPendingData(null);
    setIdempotencyKey(null);
    router.push('/deposits');
  };

  return (
    <div className="space-y-4">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Fixed Deposits', href: '/deposits' },
        { label: 'Book FD' },
      ]} />

      <div>
        <h1 className="text-lg font-semibold text-cbs-ink">Book Fixed Deposit</h1>
        <p className="text-xs text-cbs-steel-600 mt-0.5">
          Maker action — book a new FD. Interest rate is determined by
          the product master based on tenure slab. UI does not compute interest.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="border border-cbs-crimson-600 bg-cbs-crimson-50 text-cbs-crimson-700 p-3 text-sm"
        >
          <div className="font-semibold">FD booking failed</div>
          <div>{error.message}</div>
          {error.correlationId && (
            <div className="mt-1 text-xs cbs-tabular">Ref: {error.correlationId}</div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit(onFormValid)} className="space-y-4">
        {/* Customer & Account */}
        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
              Customer & Linked Account
            </span>
          </div>
          <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="cbs-field-label block mb-1">Customer ID (CIF) *</label>
              <input className="cbs-input cbs-tabular" inputMode="numeric" {...register('customerId')} />
              {errors.customerId && <p className="text-xs text-cbs-crimson-700 mt-1">{errors.customerId.message}</p>}
            </div>
            <AccountNo
              label="Linked CASA Account *"
              hint="Interest credit account"
              {...register('linkedAccountNumber')}
              error={errors.linkedAccountNumber?.message}
            />
          </div>
        </section>

        {/* Deposit Details */}
        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
              Deposit Details
            </span>
          </div>
          <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-3 gap-4">
            <AmountInr
              label="Deposit Amount *"
              hint="Minimum INR 1,000"
              {...register('depositAmount')}
              error={errors.depositAmount?.message}
            />
            <div>
              <label className="cbs-field-label block mb-1">Tenure (Months) *</label>
              <input
                className="cbs-input cbs-tabular"
                inputMode="numeric"
                placeholder="e.g. 12"
                {...register('tenureMonths')}
              />
              {errors.tenureMonths && <p className="text-xs text-cbs-crimson-700 mt-1">{errors.tenureMonths.message}</p>}
            </div>
            <div>
              <label className="cbs-field-label block mb-1">Auto-Renew</label>
              <label className="flex items-center gap-2 mt-2 text-sm text-cbs-ink">
                <input type="checkbox" className="rounded-sm border-cbs-steel-300" {...register('autoRenew')} />
                Renew on maturity
              </label>
            </div>
            <div>
              <label className="cbs-field-label block mb-1">Nominee</label>
              <input className="cbs-input" placeholder="Optional" {...register('nomineeName')} />
            </div>
          </div>
        </section>

        {/* Interest Rate Notice */}
        <div className="border border-cbs-gold-600 bg-cbs-gold-50 text-cbs-gold-700 p-3 text-xs">
          <span className="font-semibold">Note:</span> Interest rate will be determined
          by the product master based on the deposit amount and tenure slab.
          The rate is applied server-side — the UI does not compute interest.
        </div>

        {/* Submit — two-step: clicking this shows the Confirm dialog;
            the actual financial post happens from inside the dialog. */}
        <div className="flex gap-2 justify-end border-t border-cbs-steel-200 pt-3">
          <Link href="/deposits" className="cbs-btn cbs-btn-secondary">Cancel</Link>
          <Button type="submit" isLoading={isSubmitting}>Review &amp; Confirm</Button>
        </div>
      </form>

      {/* CBS two-step confirmation dialog (Step 2) */}
      {pendingData && (
        <TransactionConfirmDialog
          isOpen={showConfirm}
          onCancel={() => setShowConfirm(false)}
          onConfirm={onConfirmPost}
          transactionType="Fixed Deposit Booking"
          amount={Number(pendingData.depositAmount)}
          fields={[
            { label: 'Customer ID (CIF)', value: pendingData.customerId },
            { label: 'Linked CASA', value: pendingData.linkedAccountNumber.toUpperCase() },
            { label: 'Principal Amount', value: Number(pendingData.depositAmount), isAmount: true },
            { label: 'Tenure', value: `${pendingData.tenureMonths} month(s)` },
            { label: 'Auto-Renew', value: pendingData.autoRenew ? 'Yes' : 'No' },
            ...(pendingData.nomineeName ? [{ label: 'Nominee', value: pendingData.nomineeName }] : []),
          ]}
          warning="Interest rate is determined server-side by the product + tenure slab. The displayed amount is principal only; maturity amount appears after approval."
        />
      )}
    </div>
  );
}