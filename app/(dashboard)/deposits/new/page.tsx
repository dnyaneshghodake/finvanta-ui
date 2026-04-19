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
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient } from '@/services/api/apiClient';
import { AmountInr, AccountNo, ValueDate, Breadcrumb } from '@/components/cbs';
import { Button } from '@/components/atoms';
import Link from 'next/link';

const fdSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  linkedAccountNumber: z.string().min(6, 'Linked CASA account is required'),
  depositAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount')
    .refine((v) => Number(v) >= 1000, 'Minimum FD amount is INR 1,000'),
  tenureMonths: z.string().regex(/^\d+$/, 'Enter tenure in months')
    .refine((v) => Number(v) >= 1 && Number(v) <= 120, 'Tenure must be 1-120 months'),
  autoRenew: z.boolean().default(false),
  nomineeName: z.string().optional(),
});

type FdForm = z.infer<typeof fdSchema>;

export default function BookFdPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FdForm>({
    resolver: zodResolver(fdSchema),
    defaultValues: {
      customerId: '', linkedAccountNumber: '', depositAmount: '',
      tenureMonths: '', autoRenew: false, nomineeName: '',
    },
  });

  const onSubmit = async (data: FdForm) => {
    setError(null);
    try {
      // Map form fields → Spring REST_API_COMPLETE_CATALOGUE §FD Module.
      // Spring expects `principalAmount` (not `depositAmount`),
      // `tenureDays` (not `tenureMonths`), `autoRenewalMode` (YES/NO),
      // and requires `branchId` + `interestRate`.
      const res = await apiClient.post('/fixed-deposits/book', {
        customerId: Number(data.customerId),
        branchId: 1, // TODO: read from session user's branch
        linkedAccountNumber: data.linkedAccountNumber.toUpperCase(),
        principalAmount: Number(data.depositAmount),
        interestRate: 0, // Server determines from product + tenure slab
        tenureDays: Number(data.tenureMonths) * 30, // Approximate; server recalculates exact
        interestPayoutMode: 'MATURITY',
        autoRenewalMode: data.autoRenew ? 'YES' : 'NO',
        nomineeName: data.nomineeName || undefined,
      });
      const corr = res.headers?.['x-correlation-id'] as string | undefined;
      setCorrelationId(corr || null);
      if (res.data?.status === 'SUCCESS') {
        router.push('/deposits');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'FD booking failed');
    }
  };

  return (
    <div className="space-y-4">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Fixed Deposits', href: '/deposits' },
        { label: 'Book FD' },
      ]} />

      <div>
        <h1 className="text-xl font-semibold text-cbs-ink">Book Fixed Deposit</h1>
        <p className="text-xs text-cbs-steel-600 mt-0.5">
          Maker action — book a new FD. Interest rate is determined by
          the product master based on tenure slab. UI does not compute interest.
        </p>
      </div>

      {error && (
        <div className="border border-cbs-crimson-600 bg-cbs-crimson-50 text-cbs-crimson-700 p-3 text-sm">
          <div className="font-semibold">FD booking failed</div>
          <div>{error}</div>
          {correlationId && <div className="mt-1 text-xs cbs-tabular">Ref: {correlationId}</div>}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

        {/* Submit */}
        <div className="flex gap-2 justify-end border-t border-cbs-steel-200 pt-3">
          <Link href="/deposits" className="cbs-btn cbs-btn-secondary">Cancel</Link>
          <Button type="submit" isLoading={isSubmitting}>Submit for Approval</Button>
        </div>
      </form>
    </div>
  );
}