'use client';

/**
 * FINVANTA CBS — Account Opening (Phase 4.1).
 *
 * MAKER action: opens a CASA (Savings/Current/Salary) account.
 * Calls POST /v1/accounts/open via BFF proxy.
 *
 * Prerequisites:
 *   - Customer CIF must exist and be ACTIVE
 *   - Customer KYC must be VERIFIED
 *   - Operator must have MAKER role
 *
 * The account enters PENDING_APPROVAL state and requires CHECKER
 * approval before activation. Product code determines the account
 * type, interest rate, minimum balance, and GL mapping.
 */

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient } from '@/services/api/apiClient';
import { AccountNo, AmountInr, ValueDate } from '@/components/cbs';
import { Button } from '@/components/atoms';
import Link from 'next/link';

const accountSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  accountType: z.enum(['SAVINGS', 'CURRENT', 'SALARY']),
  currencyCode: z.string().default('INR'),
  nomineeName: z.string().optional(),
  initialDeposit: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount').optional(),
});

type AccountForm = z.infer<typeof accountSchema>;

export default function AccountOpeningPage() {
  const router = useRouter();
  const search = useSearchParams();
  const prefilledCustomerId = search.get('customerId') || '';

  const [error, setError] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      customerId: prefilledCustomerId,
      accountType: 'SAVINGS',
      currencyCode: 'INR',
      nomineeName: '',
      initialDeposit: '',
    },
  });

  const onSubmit = async (data: AccountForm) => {
    setError(null);
    try {
      const res = await apiClient.post('/accounts/open', {
        customerId: Number(data.customerId),
        accountType: data.accountType,
        currencyCode: data.currencyCode,
        nomineeName: data.nomineeName || undefined,
        initialDeposit: data.initialDeposit ? Number(data.initialDeposit) : undefined,
      });
      const corr = res.headers?.['x-correlation-id'] as string | undefined;
      setCorrelationId(corr || null);
      if (res.data?.status === 'SUCCESS' && res.data?.data?.accountNumber) {
        router.push(`/accounts/${res.data.data.accountNumber}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Account opening failed');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-cbs-ink">Open New Account</h1>
        <p className="text-xs text-cbs-steel-600 mt-0.5">
          CASA account opening — maker action. Requires active CIF with
          verified KYC. Account enters pending approval until checker authorises.
        </p>
      </div>

      {error && (
        <div className="border border-cbs-crimson-600 bg-cbs-crimson-50 text-cbs-crimson-700 p-3 text-sm">
          <div className="font-semibold">Account opening failed</div>
          <div>{error}</div>
          {correlationId && <div className="mt-1 text-xs cbs-tabular">Ref: {correlationId}</div>}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Customer & Product */}
        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
              Customer & Product
            </span>
          </div>
          <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="cbs-field-label block mb-1">Customer ID (CIF) *</label>
              <input className="cbs-input cbs-tabular" inputMode="numeric" placeholder="e.g. 1" {...register('customerId')} />
              {errors.customerId && <p className="text-xs text-cbs-crimson-700 mt-1">{errors.customerId.message}</p>}
              {prefilledCustomerId && (
                <p className="text-[10px] text-cbs-olive-700 mt-0.5">Pre-filled from customer record</p>
              )}
            </div>
            <div>
              <label className="cbs-field-label block mb-1">Account Type *</label>
              <select className="cbs-input" {...register('accountType')}>
                <option value="SAVINGS">Savings Account (SB)</option>
                <option value="CURRENT">Current Account (CA)</option>
                <option value="SALARY">Salary Account</option>
              </select>
            </div>
            <div>
              <label className="cbs-field-label block mb-1">Currency</label>
              <select className="cbs-input cbs-tabular" {...register('currencyCode')}>
                <option value="INR">INR — Indian Rupee</option>
              </select>
            </div>
          </div>
        </section>

        {/* Account Details */}
        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
              Account Details
            </span>
          </div>
          <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="cbs-field-label block mb-1">Nominee Name</label>
              <input className="cbs-input" placeholder="Optional" {...register('nomineeName')} />
            </div>
            <AmountInr
              label="Initial Deposit"
              hint="Optional. Minimum balance as per product."
              {...register('initialDeposit')}
              error={errors.initialDeposit?.message}
            />
          </div>
        </section>

        {/* Submit */}
        <div className="flex gap-2 justify-end border-t border-cbs-steel-200 pt-3">
          <Link href="/accounts" className="cbs-btn cbs-btn-secondary">
            Cancel
          </Link>
          <Button type="submit" isLoading={isSubmitting}>
            Submit for Approval
          </Button>
        </div>
      </form>
    </div>
  );
}
