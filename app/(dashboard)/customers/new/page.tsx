'use client';

/**
 * FINVANTA CBS — New Customer (CIF Creation) — Phase 3.2.
 *
 * Creates a Customer Information File (CIF) via POST /api/v1/customers.
 * This is a MAKER action — the record enters PENDING_APPROVAL state
 * and requires CHECKER approval before the CIF is active.
 *
 * Fields: firstName, lastName, dob, pan, aadhaar, mobile, email,
 * customerType (INDIVIDUAL/CORPORATE), address.
 *
 * PII fields (PAN, Aadhaar, mobile, email) are encrypted at rest
 * by Spring's PiiEncryptionConverter using AES-256-GCM.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient } from '@/services/api/apiClient';
import { Pan, Aadhaar, ValueDate } from '@/components/cbs';
import { Button } from '@/components/atoms';

const cifSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  dob: z.string().min(1, 'Date of birth is required'),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN format'),
  aadhaar: z.string().regex(/^\d{12}$/, 'Aadhaar must be 12 digits'),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  customerType: z.enum(['INDIVIDUAL', 'CORPORATE']),
  address: z.object({
    street: z.string().min(1, 'Street is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  }),
});

type CifForm = z.infer<typeof cifSchema>;

export default function NewCustomerPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CifForm>({
    resolver: zodResolver(cifSchema),
    defaultValues: {
      firstName: '', lastName: '', dob: '', pan: '', aadhaar: '',
      mobile: '', email: '', customerType: 'INDIVIDUAL',
      address: { street: '', city: '', state: '', pincode: '' },
    },
  });

  const onSubmit = async (data: CifForm) => {
    setError(null);
    try {
      const res = await apiClient.post('/customers', {
        ...data,
        branchId: 1, // injected server-side from session
      });
      const corr = res.headers?.['x-correlation-id'] as string | undefined;
      setCorrelationId(corr || null);
      if (res.data?.status === 'SUCCESS' && res.data?.data?.id) {
        router.push(`/customers/${res.data.data.id}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create customer';
      setError(msg);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-cbs-ink">New Customer (CIF)</h1>
        <p className="text-xs text-cbs-steel-600 mt-0.5">
          Create a Customer Information File. This is a maker action —
          the CIF requires checker approval before activation.
        </p>
      </div>

      {error && (
        <div className="border border-cbs-crimson-600 bg-cbs-crimson-50 text-cbs-crimson-700 p-3 text-sm">
          <div className="font-semibold">CIF creation failed</div>
          <div>{error}</div>
          {correlationId && (
            <div className="mt-1 text-xs cbs-tabular">Ref: {correlationId}</div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Personal Details */}
        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
              Personal Details
            </span>
          </div>
          <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="cbs-field-label block mb-1">First Name *</label>
              <input className="cbs-input" {...register('firstName')} />
              {errors.firstName && <p className="text-xs text-cbs-crimson-700 mt-1">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="cbs-field-label block mb-1">Last Name *</label>
              <input className="cbs-input" {...register('lastName')} />
              {errors.lastName && <p className="text-xs text-cbs-crimson-700 mt-1">{errors.lastName.message}</p>}
            </div>
            <ValueDate label="Date of Birth *" {...register('dob')} error={errors.dob?.message} />
            <div>
              <label className="cbs-field-label block mb-1">Customer Type *</label>
              <select className="cbs-input" {...register('customerType')}>
                <option value="INDIVIDUAL">Individual</option>
                <option value="CORPORATE">Corporate</option>
              </select>
            </div>
          </div>
        </section>

        {/* KYC / PII Details */}
        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
              KYC Details (PII — Encrypted at Rest)
            </span>
          </div>
          <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-3 gap-4">
            <Pan label="PAN *" {...register('pan')} error={errors.pan?.message} />
            <Aadhaar label="Aadhaar *" {...register('aadhaar')} error={errors.aadhaar?.message} />
            <div>
              <label className="cbs-field-label block mb-1">Mobile *</label>
              <input className="cbs-input cbs-tabular" inputMode="numeric" maxLength={10} {...register('mobile')} />
              {errors.mobile && <p className="text-xs text-cbs-crimson-700 mt-1">{errors.mobile.message}</p>}
            </div>
            <div>
              <label className="cbs-field-label block mb-1">Email</label>
              <input className="cbs-input" type="email" {...register('email')} />
              {errors.email && <p className="text-xs text-cbs-crimson-700 mt-1">{errors.email.message}</p>}
            </div>
          </div>
        </section>

        {/* Address */}
        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
              Address
            </span>
          </div>
          <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <label className="cbs-field-label block mb-1">Street *</label>
              <input className="cbs-input" {...register('address.street')} />
              {errors.address?.street && <p className="text-xs text-cbs-crimson-700 mt-1">{errors.address.street.message}</p>}
            </div>
            <div>
              <label className="cbs-field-label block mb-1">City *</label>
              <input className="cbs-input" {...register('address.city')} />
              {errors.address?.city && <p className="text-xs text-cbs-crimson-700 mt-1">{errors.address.city.message}</p>}
            </div>
            <div>
              <label className="cbs-field-label block mb-1">State *</label>
              <input className="cbs-input" {...register('address.state')} />
              {errors.address?.state && <p className="text-xs text-cbs-crimson-700 mt-1">{errors.address.state.message}</p>}
            </div>
            <div>
              <label className="cbs-field-label block mb-1">Pincode *</label>
              <input className="cbs-input cbs-tabular" inputMode="numeric" maxLength={6} {...register('address.pincode')} />
              {errors.address?.pincode && <p className="text-xs text-cbs-crimson-700 mt-1">{errors.address.pincode.message}</p>}
            </div>
          </div>
        </section>

        {/* Submit */}
        <div className="flex gap-2 justify-end border-t border-cbs-steel-200 pt-3">
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Submit for Approval
          </Button>
        </div>
      </form>
    </div>
  );
}