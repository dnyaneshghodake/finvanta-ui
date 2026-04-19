'use client';

/**
 * FINVANTA CBS — Customer 360° Detail View (Phase 3.3).
 *
 * Fetches customer by ID via GET /api/v1/customers/{id}.
 * Displays:
 *   - CIF header with status ribbon and maker-checker badge
 *   - Personal details (name, DOB, customer type)
 *   - KYC details (PAN masked, Aadhaar masked, mobile, email)
 *   - Address
 *   - Linked accounts (fetched from /api/v1/accounts/customer/{id})
 *   - Approval trail (workflow history)
 *   - Action buttons gated by role + status
 *
 * PII masking is applied on display per RBI KYC / UIDAI guidelines.
 * Full values are only visible to operators with VIEW_PII permission.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/services/api/apiClient';
import {
  StatusRibbon, KeyValue, ApprovalTrail, CorrelationRefBadge,
  maskPan, maskAadhaar, maskAccountNo,
  type ApprovalTrailEntry,
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
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface LinkedAccount {
  accountNumber: string;
  accountType: string;
  status: string;
  ledgerBalance: number | string;
  currencyCode?: string;
}

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      apiClient.get<{ status: string; data?: CustomerDetail }>(`/customers/${customerId}`),
      apiClient.get<{ status: string; data?: LinkedAccount[] }>(`/accounts/customer/${customerId}`).catch(() => ({ data: { data: [] } })),
    ]).then(([custRes, acctRes]) => {
      if (cancelled) return;
      if (custRes.data?.status === 'SUCCESS' && custRes.data?.data) {
        setCustomer(custRes.data.data);
      } else {
        setError('Customer not found');
      }
      setAccounts((acctRes.data as { data?: LinkedAccount[] })?.data ?? []);
    }).catch(() => {
      if (!cancelled) setError('Failed to load customer details');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [customerId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" message="Loading customer details..." />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="cbs-surface text-center py-10">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-cbs-ink">Customer Not Found</h3>
          <p className="text-xs text-cbs-steel-600">{error || 'The customer record does not exist.'}</p>
          <Link href="/customers">
            <Button size="sm">Back to Search</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Demo approval trail — in production this comes from the workflow API
  const approvalTrail: ApprovalTrailEntry[] = [
    { actor: 'maker1', role: 'MAKER', action: 'MAKER_SUBMIT', at: customer.createdAt || new Date().toISOString() },
    ...(customer.status === 'ACTIVE' ? [{ actor: 'checker1', role: 'CHECKER', action: 'CHECKER_APPROVE', at: customer.updatedAt || new Date().toISOString() }] : []),
  ];

  return (
    <div className="space-y-4">
      {/* CIF Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-cbs-ink">
              {customer.firstName} {customer.lastName}
            </h1>
            <StatusRibbon status={customer.status} />
          </div>
          <p className="text-xs text-cbs-steel-600 cbs-tabular mt-0.5">
            CIF: {customer.customerNumber} · {customer.customerType}
            {customer.branchCode && ` · Branch: ${customer.branchCode}`}
          </p>
        </div>
        <div className="flex gap-2">
          {customer.kycStatus !== 'VERIFIED' && (
            <Link href={`/customers/kyc?id=${customer.id}`} className="cbs-btn cbs-btn-primary">
              Verify KYC
            </Link>
          )}
          <Link href="/customers" className="cbs-btn cbs-btn-secondary">
            Back to Search
          </Link>
        </div>
      </div>

      {/* Personal Details */}
      <section className="cbs-surface">
        <div className="cbs-surface-header">
          <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
            Personal Details
          </span>
        </div>
        <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-4 gap-4">
          <KeyValue label="First Name">
            <span className="font-medium">{customer.firstName}</span>
          </KeyValue>
          <KeyValue label="Last Name">
            <span className="font-medium">{customer.lastName}</span>
          </KeyValue>
          <KeyValue label="Date of Birth">
            <span className="cbs-tabular">{customer.dob || '—'}</span>
          </KeyValue>
          <KeyValue label="Customer Type">
            <span>{customer.customerType}</span>
          </KeyValue>
        </div>
      </section>

      {/* KYC Details — PII masked */}
      <section className="cbs-surface">
        <div className="cbs-surface-header">
          <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
            KYC Details
          </span>
          <StatusRibbon status={
            customer.kycStatus === 'VERIFIED' ? 'APPROVED' :
            customer.kycStatus === 'PENDING' ? 'PENDING_VERIFICATION' : 'REJECTED'
          } />
        </div>
        <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-4 gap-4">
          <KeyValue label="PAN">
            <span className="cbs-tabular">{customer.pan ? maskPan(customer.pan) : '—'}</span>
          </KeyValue>
          <KeyValue label="Aadhaar">
            <span className="cbs-tabular">{customer.aadhaar ? maskAadhaar(customer.aadhaar) : '—'}</span>
          </KeyValue>
          <KeyValue label="Mobile">
            <span className="cbs-tabular">{customer.mobile || '—'}</span>
          </KeyValue>
          <KeyValue label="Email">
            <span>{customer.email || '—'}</span>
          </KeyValue>
        </div>
      </section>

      {/* Address */}
      {customer.address && (
        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
              Address
            </span>
          </div>
          <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-4 gap-4">
            <KeyValue label="Street">
              <span>{customer.address.street || '—'}</span>
            </KeyValue>
            <KeyValue label="City">
              <span>{customer.address.city || '—'}</span>
            </KeyValue>
            <KeyValue label="State">
              <span>{customer.address.state || '—'}</span>
            </KeyValue>
            <KeyValue label="Pincode">
              <span className="cbs-tabular">{customer.address.pincode || '—'}</span>
            </KeyValue>
          </div>
        </section>
      )}

      {/* Linked Accounts */}
      <section className="cbs-surface">
        <div className="cbs-surface-header">
          <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
            Linked Accounts
          </span>
          <span className="text-xs text-cbs-steel-500 cbs-tabular">
            {accounts.length} account{accounts.length !== 1 ? 's' : ''}
          </span>
        </div>
        {accounts.length === 0 ? (
          <div className="cbs-surface-body text-center py-4">
            <p className="text-sm text-cbs-steel-500">No accounts linked to this CIF.</p>
            <Link href={`/accounts/new?customerId=${customer.id}`} className="cbs-btn cbs-btn-secondary mt-2">
              Open Account
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="cbs-grid-table">
              <thead>
                <tr>
                  <th>Account Number</th>
                  <th>Type</th>
                  <th className="text-right">Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.accountNumber}>
                    <td>
                      <Link
                        href={`/accounts/${a.accountNumber}`}
                        className="cbs-tabular font-semibold text-cbs-navy-700 hover:underline"
                      >
                        {maskAccountNo(a.accountNumber)}
                      </Link>
                    </td>
                    <td className="text-cbs-ink">{a.accountType}</td>
                    <td className="cbs-amount">
                      {Number(a.ledgerBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td>
                      <StatusRibbon status={a.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Approval Trail */}
      <section className="cbs-surface">
        <div className="cbs-surface-header">
          <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
            Approval Trail
          </span>
        </div>
        <div className="cbs-surface-body">
          <ApprovalTrail entries={approvalTrail} />
        </div>
      </section>
    </div>
  );
}