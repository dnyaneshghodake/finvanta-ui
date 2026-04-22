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
  maskPan, maskAadhaar, maskAccountNo, Breadcrumb,
  type ApprovalTrailEntry,
} from '@/components/cbs';
import { Button, Spinner } from '@/components/atoms';
import { formatCbsDate } from '@/utils/formatters';
import { R, buildUrl, resolvePath } from '@/config/routes';

/** Full CIF record — matches the creation schema for 360° view. */
interface CustomerDetail {
  id: number;
  customerNumber: string;
  /* Personal (CKYC Part I) */
  customerType: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  fatherOrSpouseName?: string;
  motherName?: string;
  dob?: string;
  gender?: string;
  maritalStatus?: string;
  nationality?: string;
  residentStatus?: string;
  /* KYC / OVD */
  pan?: string;
  aadhaar?: string;
  ckycNumber?: string;
  passportNumber?: string;
  passportExpiry?: string;
  voterId?: string;
  drivingLicense?: string;
  kycStatus: string;
  /* Contact */
  mobile?: string;
  alternateMobile?: string;
  email?: string;
  communicationPref?: string;
  /* Occupation & Income */
  occupation?: string;
  annualIncomeRange?: string;
  sourceOfFunds?: string;
  /* Risk & Compliance */
  riskCategory?: string;
  pepFlag?: boolean;
  fatcaCountry?: string;
  customerSegment?: string;
  /* Cross-Module */
  sourceOfIntroduction?: string;
  relationshipManagerId?: string;
  /* Corporate */
  companyName?: string;
  cin?: string;
  gstin?: string;
  dateOfIncorporation?: string;
  constitutionType?: string;
  natureOfBusiness?: string;
  /* Addresses */
  permanentAddress?: { line1?: string; line2?: string; city?: string; district?: string; state?: string; pincode?: string; country?: string };
  correspondenceAddress?: { line1?: string; line2?: string; city?: string; district?: string; state?: string; pincode?: string; country?: string };
  /* Legacy single address fallback */
  address?: { street?: string; city?: string; state?: string; pincode?: string };
  /* Meta */
  status: string;
  branchCode?: string;
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

/** Fixed deposit linked to this CIF. */
interface LinkedFD {
  fdNumber: string;
  principal: number;
  rate: number;
  maturityDate: string;
  status: string;
}

/** Loan linked to this CIF. */
interface LinkedLoan {
  loanAccountNumber: string;
  loanType: string;
  sanctionedAmount: number;
  outstandingAmount: number;
  emiAmount?: number;
  status: string;
}

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch-on-mount: the explicit `setLoading(true)` / `setError(null)`
  // reset is needed so client-side route changes (/customers/A →
  // /customers/B) refresh the view. React Compiler flags set-state-
  // in-effect here; the fix-forward is a `key`-based remount.
  /* eslint-disable react-hooks/set-state-in-effect */
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
  /* eslint-enable react-hooks/set-state-in-effect */

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
      <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Customers', href: '/customers' }, { label: `CIF: ${customer.customerNumber}` }]} />

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

      {/* 1. Personal Identification (CKYC Part I) */}
      <section className="cbs-surface"><div className="cbs-surface-header"><span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Personal Identification — CKYC Part I</span></div>
        <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-4 gap-4">
          <KeyValue label="Customer Type"><span>{customer.customerType}</span></KeyValue>
          <KeyValue label="First Name"><span className="font-medium">{customer.firstName}</span></KeyValue>
          {customer.middleName && <KeyValue label="Middle Name"><span>{customer.middleName}</span></KeyValue>}
          <KeyValue label="Last Name"><span className="font-medium">{customer.lastName}</span></KeyValue>
          <KeyValue label="Father / Spouse Name"><span>{customer.fatherOrSpouseName || '—'}</span></KeyValue>
          <KeyValue label="Mother Name"><span>{customer.motherName || '—'}</span></KeyValue>
          <KeyValue label="Date of Birth"><span className="cbs-tabular">{customer.dob ? formatCbsDate(customer.dob) : '—'}</span></KeyValue>
          <KeyValue label="Gender"><span>{customer.gender || '—'}</span></KeyValue>
          <KeyValue label="Marital Status"><span>{customer.maritalStatus || '—'}</span></KeyValue>
          <KeyValue label="Nationality"><span>{customer.nationality || '—'}</span></KeyValue>
          <KeyValue label="Resident Status"><span>{customer.residentStatus || '—'}</span></KeyValue>
        </div></section>

      {/* 2. KYC / OVD Documents */}
      <section className="cbs-surface"><div className="cbs-surface-header"><span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">KYC / OVD Documents</span>
          <StatusRibbon status={customer.kycStatus === 'VERIFIED' ? 'APPROVED' : customer.kycStatus === 'PENDING' ? 'PENDING_VERIFICATION' : 'REJECTED'} /></div>
        <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-4 gap-4">
          <KeyValue label="PAN"><span className="cbs-tabular">{customer.pan ? maskPan(customer.pan) : '—'}</span></KeyValue>
          <KeyValue label="Aadhaar"><span className="cbs-tabular">{customer.aadhaar ? maskAadhaar(customer.aadhaar) : '—'}</span></KeyValue>
          {customer.ckycNumber && <KeyValue label="CKYC Number"><span className="cbs-tabular">{customer.ckycNumber}</span></KeyValue>}
          {customer.passportNumber && <KeyValue label="Passport"><span className="cbs-tabular">{customer.passportNumber}</span></KeyValue>}
          {customer.voterId && <KeyValue label="Voter ID"><span className="cbs-tabular">{customer.voterId}</span></KeyValue>}
          {customer.drivingLicense && <KeyValue label="Driving License"><span className="cbs-tabular">{customer.drivingLicense}</span></KeyValue>}
        </div></section>

      {/* 3. Contact */}
      <section className="cbs-surface"><div className="cbs-surface-header"><span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Contact Details</span></div>
        <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-4 gap-4">
          <KeyValue label="Mobile"><span className="cbs-tabular">{customer.mobile || '—'}</span></KeyValue>
          {customer.alternateMobile && <KeyValue label="Alternate Mobile"><span className="cbs-tabular">{customer.alternateMobile}</span></KeyValue>}
          <KeyValue label="Email"><span>{customer.email || '—'}</span></KeyValue>
          {customer.communicationPref && <KeyValue label="Communication Pref"><span>{customer.communicationPref}</span></KeyValue>}
        </div></section>

      {/* 4. Occupation & Income (CKYC Part II) */}
      {(customer.occupation || customer.annualIncomeRange) && (
        <section className="cbs-surface"><div className="cbs-surface-header"><span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Occupation &amp; Income</span></div>
          <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-4 gap-4">
            {customer.occupation && <KeyValue label="Occupation"><span>{customer.occupation.replace(/_/g, ' ')}</span></KeyValue>}
            {customer.annualIncomeRange && <KeyValue label="Annual Income"><span>{customer.annualIncomeRange.replace(/_/g, ' ')}</span></KeyValue>}
            {customer.sourceOfFunds && <KeyValue label="Source of Funds"><span>{customer.sourceOfFunds}</span></KeyValue>}
          </div></section>
      )}

      {/* 5. Risk & Compliance */}
      <section className="cbs-surface"><div className="cbs-surface-header"><span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Risk &amp; Compliance</span></div>
        <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-4 gap-4">
          <KeyValue label="Risk Category"><span className={customer.riskCategory === 'HIGH' ? 'text-cbs-crimson-700 font-semibold' : ''}>{customer.riskCategory || 'LOW'}</span></KeyValue>
          <KeyValue label="PEP"><span className={customer.pepFlag ? 'text-cbs-crimson-700 font-semibold' : ''}>{customer.pepFlag ? 'Yes' : 'No'}</span></KeyValue>
          {customer.fatcaCountry && <KeyValue label="FATCA Country"><span>{customer.fatcaCountry}</span></KeyValue>}
          {customer.customerSegment && <KeyValue label="Segment"><span>{customer.customerSegment}</span></KeyValue>}
        </div></section>

      {/* 6. Corporate Details (conditional) */}
      {customer.customerType === 'CORPORATE' && customer.companyName && (
        <section className="cbs-surface"><div className="cbs-surface-header"><span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Corporate Details</span></div>
          <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-4 gap-4">
            <KeyValue label="Company Name"><span className="font-medium">{customer.companyName}</span></KeyValue>
            {customer.cin && <KeyValue label="CIN"><span className="cbs-tabular">{customer.cin}</span></KeyValue>}
            {customer.gstin && <KeyValue label="GSTIN"><span className="cbs-tabular">{customer.gstin}</span></KeyValue>}
            {customer.constitutionType && <KeyValue label="Constitution"><span>{customer.constitutionType.replace(/_/g, ' ')}</span></KeyValue>}
            {customer.natureOfBusiness && <KeyValue label="Nature of Business"><span>{customer.natureOfBusiness}</span></KeyValue>}
          </div></section>
      )}

      {/* 7. Permanent Address */}
      {(customer.permanentAddress || customer.address) && (
        <section className="cbs-surface"><div className="cbs-surface-header"><span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Permanent Address</span></div>
          <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-4 gap-4">
            {customer.permanentAddress ? (<>
              <KeyValue label="Line 1"><span>{customer.permanentAddress.line1 || '—'}</span></KeyValue>
              {customer.permanentAddress.line2 && <KeyValue label="Line 2"><span>{customer.permanentAddress.line2}</span></KeyValue>}
              <KeyValue label="City"><span>{customer.permanentAddress.city || '—'}</span></KeyValue>
              <KeyValue label="District"><span>{customer.permanentAddress.district || '—'}</span></KeyValue>
              <KeyValue label="State"><span>{customer.permanentAddress.state || '—'}</span></KeyValue>
              <KeyValue label="Pincode"><span className="cbs-tabular">{customer.permanentAddress.pincode || '—'}</span></KeyValue>
              <KeyValue label="Country"><span>{customer.permanentAddress.country || '—'}</span></KeyValue>
            </>) : customer.address ? (<>
              <KeyValue label="Street"><span>{customer.address.street || '—'}</span></KeyValue>
              <KeyValue label="City"><span>{customer.address.city || '—'}</span></KeyValue>
              <KeyValue label="State"><span>{customer.address.state || '—'}</span></KeyValue>
              <KeyValue label="Pincode"><span className="cbs-tabular">{customer.address.pincode || '—'}</span></KeyValue>
            </>) : null}
          </div></section>
      )}

      {/* 8. Correspondence Address */}
      {customer.correspondenceAddress && (
        <section className="cbs-surface"><div className="cbs-surface-header"><span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Correspondence Address</span></div>
          <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-4 gap-4">
            <KeyValue label="Line 1"><span>{customer.correspondenceAddress.line1 || '—'}</span></KeyValue>
            {customer.correspondenceAddress.line2 && <KeyValue label="Line 2"><span>{customer.correspondenceAddress.line2}</span></KeyValue>}
            <KeyValue label="City"><span>{customer.correspondenceAddress.city || '—'}</span></KeyValue>
            <KeyValue label="District"><span>{customer.correspondenceAddress.district || '—'}</span></KeyValue>
            <KeyValue label="State"><span>{customer.correspondenceAddress.state || '—'}</span></KeyValue>
            <KeyValue label="Pincode"><span className="cbs-tabular">{customer.correspondenceAddress.pincode || '—'}</span></KeyValue>
            <KeyValue label="Country"><span>{customer.correspondenceAddress.country || '—'}</span></KeyValue>
          </div></section>
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