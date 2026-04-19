'use client';

/**
 * FINVANTA CBS — KYC Verification (Phase 3.4).
 *
 * CHECKER action: verifies a customer's KYC documents.
 * Calls POST /api/v1/customers/{id}/verify-kyc via BFF proxy.
 *
 * The checker reviews the PII details submitted by the maker and
 * either approves or rejects the KYC. This is a dual-authorisation
 * action per RBI Master Direction on IT Governance 2023.
 *
 * On approval, the customer's kycStatus changes to VERIFIED and
 * the CIF becomes eligible for account opening.
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/services/api/apiClient';
import {
  StatusRibbon, KeyValue, maskPan, maskAadhaar,
  CorrelationRefBadge, Breadcrumb,
} from '@/components/cbs';
import { Button, Spinner } from '@/components/atoms';

interface CustomerDetail {
  id: number;
  customerNumber: string;
  firstName: string;
  lastName: string;
  dob?: string;
  pan?: string;
  aadhaar?: string;
  mobile?: string;
  email?: string;
  customerType: string;
  kycStatus: string;
  status: string;
  branchCode?: string;
}

export default function KycVerificationPage() {
  const router = useRouter();
  const search = useSearchParams();
  const customerId = search.get('id');

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId) { setLoading(false); return; }
    let cancelled = false;
    apiClient.get<{ status: string; data?: CustomerDetail }>(`/customers/${customerId}`)
      .then((res) => {
        if (cancelled) return;
        if (res.data?.status === 'SUCCESS' && res.data?.data) {
          setCustomer(res.data.data);
        } else {
          setError('Customer not found');
        }
      })
      .catch(() => { if (!cancelled) setError('Failed to load customer'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [customerId]);

  const handleVerify = async (action: 'approve' | 'reject') => {
    if (!customer) return;
    if (action === 'reject' && !remarks.trim()) {
      setError('Rejection remarks are mandatory per RBI compliance.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiClient.post(`/customers/${customer.id}/verify-kyc`, {
        action,
        remarks: remarks.trim() || undefined,
      });
      const corr = res.headers?.['x-correlation-id'] as string | undefined;
      setCorrelationId(corr || null);
      if (res.data?.status === 'SUCCESS') {
        setSuccess(action === 'approve'
          ? `KYC verified for ${customer.customerNumber}. CIF is now eligible for account opening.`
          : `KYC rejected for ${customer.customerNumber}.`
        );
        // Refresh customer data
        setCustomer((prev) => prev ? { ...prev, kycStatus: action === 'approve' ? 'VERIFIED' : 'REJECTED' } : prev);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'KYC verification failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" message="Loading customer for KYC verification..." />
      </div>
    );
  }

  if (!customerId || !customer) {
    return (
      <div className="cbs-surface text-center py-10">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-cbs-ink">No Customer Selected</h3>
          <p className="text-xs text-cbs-steel-600">
            Navigate to a customer record and click &quot;Verify KYC&quot; to begin.
          </p>
          <Link href="/customers">
            <Button size="sm">Go to Customer Search</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isAlreadyVerified = customer.kycStatus === 'VERIFIED';

  return (
    <div className="space-y-4">
      <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Customers', href: '/customers' }, { label: 'KYC Verification' }]} />
      <div>
        <h1 className="text-xl font-semibold text-cbs-ink">KYC Verification</h1>
        <p className="text-xs text-cbs-steel-600 mt-0.5">
          Checker action — review and verify customer KYC documents.
          Rejection requires mandatory remarks per RBI compliance.
        </p>
      </div>

      {/* Status Messages */}
      <div aria-live="polite" aria-atomic="true">
        {error && (
          <div role="alert" className="cbs-alert cbs-alert-error">
            <div className="font-semibold text-sm">Verification failed</div>
            <div className="mt-1 text-sm">{error}</div>
            {correlationId && (
              <div className="mt-1 text-xs cbs-tabular">Ref: {correlationId}</div>
            )}
          </div>
        )}
      </div>

      {success && (
        <div className="border border-cbs-olive-600 bg-cbs-olive-50 text-cbs-olive-700 p-3 text-sm">
          <div className="font-semibold">KYC verification complete</div>
          <div>{success}</div>
          <div className="flex items-center gap-2 mt-2">
            {correlationId && <CorrelationRefBadge value={correlationId} />}
            <Link href={`/customers/${customer.id}`} className="cbs-link text-xs">
              View customer →
            </Link>
          </div>
        </div>
      )}

      {/* Customer Summary */}
      <section className="cbs-surface">
        <div className="cbs-surface-header">
          <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
            Customer Summary
          </span>
          <StatusRibbon status={
            customer.kycStatus === 'VERIFIED' ? 'APPROVED' :
            customer.kycStatus === 'REJECTED' ? 'REJECTED' : 'PENDING_VERIFICATION'
          } />
        </div>
        <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-4 gap-4">
          <KeyValue label="CIF Number">
            <span className="cbs-tabular font-semibold">{customer.customerNumber}</span>
          </KeyValue>
          <KeyValue label="Name">
            <span className="font-medium">{customer.firstName} {customer.lastName}</span>
          </KeyValue>
          <KeyValue label="DOB">
            <span className="cbs-tabular">{customer.dob || '—'}</span>
          </KeyValue>
          <KeyValue label="Type">
            <span>{customer.customerType}</span>
          </KeyValue>
        </div>
      </section>

      {/* KYC Documents for Review */}
      <section className="cbs-surface">
        <div className="cbs-surface-header">
          <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
            KYC Documents — Review
          </span>
        </div>
        <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-3 gap-4">
          <KeyValue label="PAN">
            <span className="cbs-tabular font-semibold text-cbs-ink">
              {customer.pan ? maskPan(customer.pan) : '—'}
            </span>
          </KeyValue>
          <KeyValue label="Aadhaar">
            <span className="cbs-tabular font-semibold text-cbs-ink">
              {customer.aadhaar ? maskAadhaar(customer.aadhaar) : '—'}
            </span>
          </KeyValue>
          <KeyValue label="Mobile">
            <span className="cbs-tabular font-semibold text-cbs-ink">
              {customer.mobile || '—'}
            </span>
          </KeyValue>
        </div>
      </section>

      {/* Verification Action */}
      {!isAlreadyVerified && !success && (
        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
              Verification Decision
            </span>
          </div>
          <div className="cbs-surface-body space-y-3">
            <div>
              <label className="cbs-field-label block mb-1">
                Remarks {' '}
                <span className="text-cbs-crimson-700">(mandatory for rejection)</span>
              </label>
              <textarea
                className="cbs-textarea"
                placeholder="Enter verification remarks..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end border-t border-cbs-steel-200 pt-3">
              <Button
                variant="danger"
                size="md"
                isLoading={submitting}
                onClick={() => handleVerify('reject')}
              >
                Reject KYC
              </Button>
              <Button
                variant="success"
                size="md"
                isLoading={submitting}
                onClick={() => handleVerify('approve')}
              >
                Approve KYC
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}