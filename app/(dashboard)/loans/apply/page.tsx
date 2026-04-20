'use client';

/**
 * FINVANTA CBS — Loan Application (Phase 6.2).
 *
 * MAKER action: submits a loan application via POST /api/v1/loan-applications.
 * The application enters the LOS (Loan Origination System) pipeline:
 *   SUBMITTED → VERIFIED → APPROVED → ACCOUNT_CREATED → DISBURSED
 *
 * Eligibility, credit scoring, and limit checks are server-side.
 * The UI captures application data only.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient } from '@/services/api/apiClient';
import { AmountInr, Breadcrumb } from '@/components/cbs';
import { Button } from '@/components/atoms';
import Link from 'next/link';

const loanSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  loanType: z.enum(['TERM_LOAN', 'HOME_LOAN', 'VEHICLE_LOAN', 'PERSONAL_LOAN', 'GOLD_LOAN']),
  requestedAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount')
    .refine((v) => Number(v) >= 10000, 'Minimum loan amount is INR 10,000'),
  tenureMonths: z.string().regex(/^\d+$/, 'Enter tenure in months')
    .refine((v) => Number(v) >= 6 && Number(v) <= 360, 'Tenure must be 6-360 months'),
  purpose: z.string().min(3, 'Purpose is required').max(200),
  collateralDescription: z.string().optional(),
});

type LoanForm = z.infer<typeof loanSchema>;

export default function LoanApplicationPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoanForm>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      customerId: '', loanType: 'PERSONAL_LOAN', requestedAmount: '',
      tenureMonths: '', purpose: '', collateralDescription: '',
    },
  });

  const onSubmit = async (data: LoanForm) => {
    setError(null);
    try {
      // Map form fields → Spring REST_API_COMPLETE_CATALOGUE §Loan
      // Application Module field names. Spring expects `productType`
      // (not `loanType`), `collateralReference` (not `collateralDescription`),
      // and requires `branchId` + `interestRate`.
      const res = await apiClient.post('/loan-applications', {
        customerId: Number(data.customerId),
        branchId: 1, // TODO: read from session user's branch
        productType: data.loanType,
        requestedAmount: Number(data.requestedAmount),
        interestRate: 0, // Server determines actual rate from product master
        tenureMonths: Number(data.tenureMonths),
        purpose: data.purpose,
        collateralReference: data.collateralDescription || undefined,
      });
      const corr = res.headers?.['x-correlation-id'] as string | undefined;
      setCorrelationId(corr || null);
      if (res.data?.status === 'SUCCESS') {
        router.push('/loans');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Loan application failed');
    }
  };

  return (
    <div className="space-y-4">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Loans', href: '/loans' },
        { label: 'New Application' },
      ]} />

      <div>
        <h1 className="text-xl font-semibold text-cbs-ink">Loan Application</h1>
        <p className="text-xs text-cbs-steel-600 mt-0.5">
          Maker action — submit a new loan application into the LOS pipeline.
          Eligibility and credit scoring are performed server-side.
        </p>
      </div>

      {error && (
        <div className="border border-cbs-crimson-600 bg-cbs-crimson-50 text-cbs-crimson-700 p-3 text-sm">
          <div className="font-semibold">Application failed</div>
          <div>{error}</div>
          {correlationId && <div className="mt-1 text-xs cbs-tabular">Ref: {correlationId}</div>}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Applicant & Product</span>
          </div>
          <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="cbs-field-label block mb-1">Customer ID (CIF) *</label>
              <input className="cbs-input cbs-tabular" inputMode="numeric" {...register('customerId')} />
              {errors.customerId && <p className="text-xs text-cbs-crimson-700 mt-1">{errors.customerId.message}</p>}
            </div>
            <div>
              <label className="cbs-field-label block mb-1">Loan Type *</label>
              <select className="cbs-input" {...register('loanType')}>
                <option value="PERSONAL_LOAN">Personal Loan</option>
                <option value="HOME_LOAN">Home Loan</option>
                <option value="VEHICLE_LOAN">Vehicle Loan</option>
                <option value="GOLD_LOAN">Gold Loan</option>
                <option value="TERM_LOAN">Term Loan</option>
              </select>
            </div>
          </div>
        </section>

        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Loan Details</span>
          </div>
          <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-3 gap-4">
            <AmountInr label="Requested Amount *" hint="Minimum INR 10,000" {...register('requestedAmount')} error={errors.requestedAmount?.message} />
            <div>
              <label className="cbs-field-label block mb-1">Tenure (Months) *</label>
              <input className="cbs-input cbs-tabular" inputMode="numeric" placeholder="e.g. 60" {...register('tenureMonths')} />
              {errors.tenureMonths && <p className="text-xs text-cbs-crimson-700 mt-1">{errors.tenureMonths.message}</p>}
            </div>
            <div className="md:col-span-3">
              <label className="cbs-field-label block mb-1">Purpose *</label>
              <input className="cbs-input" placeholder="e.g. Home purchase, Vehicle purchase" {...register('purpose')} />
              {errors.purpose && <p className="text-xs text-cbs-crimson-700 mt-1">{errors.purpose.message}</p>}
            </div>
            <div className="md:col-span-3">
              <label className="cbs-field-label block mb-1">Collateral Description</label>
              <input className="cbs-input" placeholder="Optional — describe security offered" {...register('collateralDescription')} />
            </div>
          </div>
        </section>

        <div className="border border-cbs-gold-600 bg-cbs-gold-50 text-cbs-gold-700 p-3 text-xs">
          <span className="font-semibold">Note:</span> Interest rate, EMI, and eligibility
          will be determined by the credit engine. The UI does not compute loan terms.
        </div>

        <div className="flex gap-2 justify-end border-t border-cbs-steel-200 pt-3">
          <Link href="/loans" className="cbs-btn cbs-btn-secondary">Cancel</Link>
          <Button type="submit" isLoading={isSubmitting}>Submit Application</Button>
        </div>
      </form>
    </div>
  );
}