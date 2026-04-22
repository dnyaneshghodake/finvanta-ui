/**
 * CBS CIF Lookup — reusable customer search + snapshot component.
 * @file src/components/cbs/CifLookup.tsx
 *
 * Used across 12+ CBS screens: account opening, transfers, FD booking,
 * loan application, KYC verification, freeze/unfreeze, statement
 * inquiry, beneficiary management, workflow approval, etc.
 *
 * UX flow:
 *   1. Operator enters CIF ID or customer number
 *   2. Clicks search button (or presses Enter)
 *   3. Component fetches GET /customers/{id}
 *   4. If found + ACTIVE → renders snapshot panel, calls onCustomerFound
 *   5. If not found or inactive → shows inline error
 *
 * The consuming screen receives the full customer object via
 * onCustomerFound and populates its own form fields.
 */
'use client';

import { useState, useCallback, useRef, useId, useEffect } from 'react';
import { Search } from 'lucide-react';
import { apiClient } from '@/services/api/apiClient';
import { Badge } from '@/components/atoms';
import { maskPan, maskAadhaar } from './primitives';

/* ── Customer Shape ─────────────────────────────────────────────
 * Subset of the full CustomerDetail that CIF lookup returns.
 * Matches the Spring CustomerResponse per API_REFERENCE.md §3.
 * Consuming screens can cast to this or use individual fields. */
export interface CifCustomer {
  id: number;
  customerNumber: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  customerType?: string;
  status: string;
  kycStatus: string;
  branchCode?: string;
  /* KYC / OVD */
  pan?: string;
  aadhaar?: string;
  ckycNumber?: string;
  /* Contact */
  mobile?: string;
  email?: string;
  /* Personal */
  dob?: string;
  gender?: string;
  nationality?: string;
  residentStatus?: string;
  fatherOrSpouseName?: string;
  maritalStatus?: string;
  /* Occupation */
  occupation?: string;
  annualIncomeRange?: string;
  sourceOfFunds?: string;
  /* Risk */
  riskCategory?: string;
  pepFlag?: boolean;
  fatcaCountry?: string;
  /* Address */
  permanentAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    district?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
  correspondenceAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    district?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
  /** Legacy single address fallback. */
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
}

export interface CifLookupProps {
  /** Pre-filled CIF ID (e.g. from URL param ?customerId=). */
  defaultValue?: string;
  /** Called when a valid ACTIVE customer is fetched. */
  onCustomerFound: (customer: CifCustomer) => void;
  /** Called when the customer is cleared (new search or error). */
  onCustomerCleared?: () => void;
  /** Whether to require ACTIVE status. Default: true. */
  requireActive?: boolean;
  /** Whether to show the snapshot panel. Default: true. */
  showSnapshot?: boolean;
  /** Label override. Default: "Customer ID (CIF)". */
  label?: string;
  /** Additional CSS class for the wrapper. */
  className?: string;
}

export function CifLookup({
  defaultValue = '',
  onCustomerFound,
  onCustomerCleared,
  requireActive = true,
  showSnapshot = true,
  label = 'Customer ID (CIF)',
  className,
}: CifLookupProps) {
  const reactId = useId();
  const inputId = `cif-lookup-${reactId}`;
  const errorId = `${inputId}-error`;
  const [cifId, setCifId] = useState(defaultValue);
  const [customer, setCustomer] = useState<CifCustomer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Tracks whether the initial auto-fetch for defaultValue has fired. */
  const autoFetchedRef = useRef(false);

  const fetchCustomer = useCallback(async () => {
    const id = cifId.trim();
    if (!id) {
      setError('Enter a CIF ID');
      return;
    }
    setLoading(true);
    setError(null);
    setCustomer(null);
    onCustomerCleared?.();
    try {
      const res = await apiClient.get<{
        status: string;
        data?: CifCustomer;
      }>(`/customers/${encodeURIComponent(id)}`);

      if (res.data?.status !== 'SUCCESS' || !res.data?.data) {
        setError('Customer not found');
        return;
      }
      const c = res.data.data;
      if (requireActive && c.status !== 'ACTIVE') {
        setError(`Customer status is ${c.status} — must be ACTIVE`);
        return;
      }
      setCustomer(c);
      onCustomerFound(c);
    } catch {
      setError('Failed to fetch customer');
    } finally {
      setLoading(false);
    }
  }, [cifId, requireActive, onCustomerFound, onCustomerCleared]);

  /* ── Auto-fetch when defaultValue is pre-filled ──────────────
   * Restores the UX for URL-driven navigation (e.g. clicking
   * "Open Account" from a customer detail page with ?customerId=).
   * Fires once on mount; the ref guard prevents re-fetching on
   * subsequent renders or StrictMode double-invocations. */
  useEffect(() => {
    if (defaultValue && !autoFetchedRef.current) {
      autoFetchedRef.current = true;
      fetchCustomer();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        fetchCustomer();
      }
    },
    [fetchCustomer],
  );

  return (
    <div className={className}>
      {/* ── Search Input ──────────────────────────────────── */}
      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className="cbs-field-label">
          {label}<span className="text-cbs-crimson-700 ml-0.5" aria-hidden="true">*</span>
        </label>
        <div className="flex gap-1.5">
          <input
            ref={inputRef}
            id={inputId}
            value={cifId}
            onChange={(e) => setCifId(e.target.value)}
            onKeyDown={handleKeyDown}
            className="cbs-input cbs-tabular flex-1"
            inputMode="numeric"
            placeholder="e.g. 1001"
            aria-describedby={error ? errorId : undefined}
            aria-invalid={!!error}
          />
          <button
            type="button"
            onClick={fetchCustomer}
            disabled={loading}
            className="cbs-btn cbs-btn-secondary h-[34px] px-3 shrink-0"
            aria-label="Fetch customer"
          >
            {loading
              ? <span className="text-xs">Loading…</span>
              : <Search size={14} strokeWidth={1.75} />}
          </button>
        </div>
        {error && (
          <p id={errorId} className="text-xs text-cbs-crimson-700" role="alert">
            {error}
          </p>
        )}
      </div>

      {/* ── Customer Snapshot ─────────────────────────────── */}
      {showSnapshot && customer && (
        <div className="cbs-surface mt-3">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold text-cbs-ink">
              {customer.firstName} {customer.lastName}
            </span>
            <div className="flex items-center gap-2">
              <Badge variant={customer.kycStatus === 'VERIFIED' ? 'success' : 'warning'}>
                KYC: {customer.kycStatus}
              </Badge>
              <Badge variant={customer.riskCategory === 'HIGH' ? 'danger' : 'default'}>
                Risk: {customer.riskCategory || 'LOW'}
              </Badge>
            </div>
          </div>
          <div className="cbs-surface-body flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <span className="text-cbs-steel-600">
              CIF: <span className="text-cbs-ink font-medium cbs-tabular">{customer.customerNumber}</span>
            </span>
            {customer.mobile && (
              <span className="text-cbs-steel-600">
                Mobile: <span className="text-cbs-ink cbs-tabular">{customer.mobile}</span>
              </span>
            )}
            {customer.email && (
              <span className="text-cbs-steel-600">
                Email: <span className="text-cbs-ink">{customer.email}</span>
              </span>
            )}
            {customer.pan && (
              <span className="text-cbs-steel-600">
                PAN: <span className="text-cbs-ink cbs-tabular">{customer.pan.includes('*') ? customer.pan : maskPan(customer.pan)}</span>
              </span>
            )}
            {customer.aadhaar && (
              <span className="text-cbs-steel-600">
                Aadhaar: <span className="text-cbs-ink cbs-tabular">{customer.aadhaar.includes('*') ? customer.aadhaar : maskAadhaar(customer.aadhaar)}</span>
              </span>
            )}
            {customer.branchCode && (
              <span className="text-cbs-steel-600">
                Branch: <span className="text-cbs-ink cbs-tabular">{customer.branchCode}</span>
              </span>
            )}
            {customer.pepFlag && (
              <span className="text-cbs-crimson-700 font-semibold">⚠ PEP</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
