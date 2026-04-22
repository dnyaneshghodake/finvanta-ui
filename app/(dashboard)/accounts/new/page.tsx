'use client';

/**
 * FINVANTA CBS — Account Opening (Tier-1 Enterprise Blueprint).
 * @file app/(dashboard)/accounts/new/page.tsx
 *
 * MAKER action: opens a CASA account per RBI KYC/AML guidelines.
 * Calls POST /v1/accounts/open via BFF proxy.
 *
 * Per Tier-1 CBS Account Opening Blueprint:
 *   - Sectioned form (accordion, not a single scroll)
 *   - 2-column max layout for regulated forms
 *   - Right-side risk/summary panel (lg:col-span-4)
 *   - Sticky footer with role-gated actions
 *   - Day-status aware (postings blocked when day not open)
 *   - Maker-Checker workflow (PENDING_APPROVAL on submit)
 *
 * Prerequisites:
 *   - Customer CIF must exist and be ACTIVE
 *   - Customer KYC must be VERIFIED
 *   - Operator must have MAKER role
 *   - Business day must be DAY_OPEN
 */

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronRight, Search } from 'lucide-react';
import clsx from 'clsx';
import { accountService } from '@/services/api/accountService';
import { apiClient } from '@/services/api/apiClient';
import {
  AmountInr, Pan, Aadhaar, ValueDate,
  Breadcrumb, CbsSelect,
} from '@/components/cbs';
import { Button, Checkbox, Badge } from '@/components/atoms';
import { FormField } from '@/components/molecules/FormField';
import { useAuthStore } from '@/store/authStore';
import { useDayStatus } from '@/contexts/DayStatusContext';
import Link from 'next/link';

/* ── Zod Schema ─────────────────────────────────────────────────
 * Validates all sections. Optional fields allow DRAFT saves. */
const accountSchema = z.object({
  // §1 Product Selection
  customerId: z.string().min(1, 'Customer ID is required'),
  accountType: z.enum(['SAVINGS', 'CURRENT', 'CURRENT_OD', 'SAVINGS_NRI', 'SAVINGS_MINOR', 'SAVINGS_JOINT', 'SAVINGS_PMJDY', 'SALARY']),
  currencyCode: z.string().min(1, 'Currency is required'),
  // §3 KYC & Regulatory
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN format').optional().or(z.literal('')),
  aadhaarNumber: z.string().regex(/^\d{12}$/, 'Aadhaar must be 12 digits').optional().or(z.literal('')),
  kycStatus: z.string().optional(),
  pepFlag: z.string().optional(),
  // §4 Personal Details
  fullName: z.string().min(1, 'Full name is required'),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  fatherSpouseName: z.string().optional(),
  nationality: z.string().optional(),
  // §5 Contact Details
  mobileNumber: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile').optional().or(z.literal('')),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  // §6 Address
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pinCode: z.string().regex(/^\d{6}$/, 'PIN must be 6 digits').optional().or(z.literal('')),
  // §7 Occupation & Financial Profile
  occupation: z.string().optional(),
  annualIncome: z.string().optional(),
  sourceOfFunds: z.string().optional(),
  // §8 Nominee
  nomineeName: z.string().optional(),
  nomineeRelationship: z.string().optional(),
  // §9 FATCA
  usTaxResident: z.string().optional(),
  // §10 Account Configuration
  chequeBookRequired: z.boolean().optional(),
  debitCardRequired: z.boolean().optional(),
  smsAlerts: z.boolean().optional(),
  // §11 Initial Deposit
  initialDeposit: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount').optional().or(z.literal('')),
  // §14 Declarations
  dueDiligenceConfirmed: z.boolean().optional(),
  documentsVerified: z.boolean().optional(),
  customerConsentObtained: z.boolean().optional(),
});

type AccountForm = z.infer<typeof accountSchema>;

/* ── Collapsible Section ────────────────────────────────────────
 * Accordion-style wrapper. Uses CbsFieldset visual pattern with
 * a clickable legend bar. */
function Section({ id, title, isOpen, onToggle, children }: {
  id: string; title: string; isOpen: boolean;
  onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <fieldset className="cbs-fieldset overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="cbs-fieldset-legend flex items-center gap-2 w-full text-left cursor-pointer hover:bg-cbs-steel-50 transition-colors"
        aria-expanded={isOpen}
        aria-controls={`section-${id}`}
      >
        <ChevronRight
          size={14} strokeWidth={2}
          className={clsx('text-cbs-steel-400 transition-transform duration-150 shrink-0', isOpen && 'rotate-90')}
          aria-hidden="true"
        />
        <span className="flex-1">{title}</span>
      </button>
      {isOpen && (
        <div id={`section-${id}`} className="cbs-fieldset-body">
          {children}
        </div>
      )}
    </fieldset>
  );
}

export default function AccountOpeningPage() {
  const router = useRouter();
  const search = useSearchParams();
  const prefilledCustomerId = search.get('customerId') || '';
  const user = useAuthStore((s) => s.user);
  const { isPostingAllowed, blockReason } = useDayStatus();

  const [error, setError] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(['product', 'personal']),
  );

  /* ── CIF Lookup State ──────────────────────────────────────
   * Per Tier-1 CBS convention: operator enters CIF ID, system
   * fetches customer master and auto-populates 13+ fields.
   * PAN/Aadhaar are read-only (immutable after CIF creation). */
  const [cifCustomer, setCifCustomer] = useState<{
    id: number; customerNumber: string; firstName: string; lastName: string;
    status: string; kycStatus: string; pan?: string; aadhaar?: string;
    mobile?: string; email?: string; dob?: string; gender?: string;
    nationality?: string; fatherOrSpouseName?: string;
    occupation?: string; annualIncomeRange?: string; sourceOfFunds?: string;
    riskCategory?: string; pepFlag?: boolean; fatcaCountry?: string;
    permanentAddress?: { line1?: string; line2?: string; city?: string; state?: string; pincode?: string };
    address?: { street?: string; city?: string; state?: string; pincode?: string };
  } | null>(null);
  const [cifLoading, setCifLoading] = useState(false);
  const [cifError, setCifError] = useState<string | null>(null);

  const toggle = (id: string) => setOpenSections((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      customerId: prefilledCustomerId, accountType: 'SAVINGS', currencyCode: 'INR',
      fullName: '', nomineeName: '', initialDeposit: '',
      chequeBookRequired: false, debitCardRequired: false, smsAlerts: true,
      dueDiligenceConfirmed: false, documentsVerified: false, customerConsentObtained: false,
    },
  });

  /* ── CIF Lookup & Auto-Populate ──────────────────────────────
   * Fetches GET /customers/{id} and populates 13 form fields.
   * PAN/Aadhaar come masked from backend — stored as-is for display.
   * KYC status mapped: VERIFIED→FULL_KYC, PENDING→MIN_KYC. */
  const fetchCif = useCallback(async () => {
    const cifId = getValues('customerId')?.trim();
    if (!cifId) return;
    setCifLoading(true);
    setCifError(null);
    setCifCustomer(null);
    try {
      const res = await apiClient.get<{ status: string; data?: Record<string, unknown> }>(`/customers/${cifId}`);
      if (res.data?.status !== 'SUCCESS' || !res.data?.data) {
        setCifError('Customer not found');
        return;
      }
      const c = res.data.data as Record<string, unknown>;
      if (c.status !== 'ACTIVE') {
        setCifError(`Customer status is ${String(c.status)} — must be ACTIVE`);
        return;
      }
      // Store customer for snapshot + risk panel
      setCifCustomer(c as typeof cifCustomer);
      // Auto-populate form fields from CIF
      const fn = String(c.firstName || '');
      const ln = String(c.lastName || '');
      setValue('fullName', [fn, ln].filter(Boolean).join(' '), { shouldValidate: true });
      if (c.pan) setValue('panNumber', String(c.pan));
      if (c.aadhaar) setValue('aadhaarNumber', String(c.aadhaar));
      if (c.mobile) setValue('mobileNumber', String(c.mobile));
      if (c.email) setValue('email', String(c.email));
      if (c.dob) setValue('dateOfBirth', String(c.dob));
      if (c.gender) setValue('gender', String(c.gender));
      if (c.nationality) setValue('nationality', String(c.nationality));
      if (c.fatherOrSpouseName) setValue('fatherSpouseName', String(c.fatherOrSpouseName));
      if (c.occupation) setValue('occupation', String(c.occupation));
      if (c.annualIncomeRange) setValue('annualIncome', String(c.annualIncomeRange));
      if (c.sourceOfFunds) setValue('sourceOfFunds', String(c.sourceOfFunds));
      if (c.pepFlag) setValue('pepFlag', 'YES');
      if (c.fatcaCountry && c.fatcaCountry !== 'IN') setValue('usTaxResident', 'YES');
      // KYC status mapping
      const kyc = String(c.kycStatus || '');
      if (kyc === 'VERIFIED' || kyc === 'APPROVED') setValue('kycStatus', 'FULL_KYC');
      else if (kyc === 'PENDING') setValue('kycStatus', 'MIN_KYC');
      // Address — prefer permanentAddress, fallback to legacy address
      const addr = (c.permanentAddress || c.address) as Record<string, string> | undefined;
      if (addr) {
        setValue('addressLine1', addr.line1 || addr.street || '');
        if (addr.line2) setValue('addressLine2', addr.line2);
        if (addr.city) setValue('city', addr.city);
        if (addr.state) setValue('state', addr.state);
        if (addr.pincode) setValue('pinCode', addr.pincode);
      }
      // Expand sections that got populated
      setOpenSections(new Set(['product', 'kyc', 'personal', 'contact', 'address', 'occupation']));
    } catch {
      setCifError('Failed to fetch customer');
    } finally {
      setCifLoading(false);
    }
  }, [getValues, setValue]);

  const onSubmit = async (data: AccountForm) => {
    setError(null);
    try {
      /* Per API_REFERENCE.md §4: POST /accounts/open creates account
       * in PENDING_ACTIVATION status. Checker activates via
       * POST /accounts/{accountNumber}/activate. The workflow engine
       * (§15) routes the approval to the checker queue automatically. */
      const result = await accountService.createAccount({
        customerId: Number(data.customerId),
        branchId: user?.branchId || 1,
        accountType: data.accountType,
        productCode: data.accountType,
        nomineeName: data.nomineeName || undefined,
        nomineeRelationship: data.nomineeRelationship || undefined,
        initialDeposit: data.initialDeposit ? Number(data.initialDeposit) : undefined,
      });
      if (result.success && result.data) {
        router.push(`/accounts/${result.data.accountNumber}`);
      } else {
        setError(result.error?.message || result.message || 'Account opening failed');
        setCorrelationId(result.correlationId || null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Account opening failed');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Page Header ──────────────────────────────────────── */}
      <div className="shrink-0 space-y-2 mb-4">
        <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Accounts', href: '/accounts' }, { label: 'Open New Account' }]} />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-cbs-ink">Open New Account</h1>
            <p className="text-xs text-cbs-steel-600 mt-0.5">CASA account opening — maker action. Account enters pending approval until checker authorises.</p>
          </div>
          {user?.branchCode && (
            <div className="text-right hidden sm:block">
              <div className="cbs-field-label">Branch</div>
              <div className="text-sm font-semibold text-cbs-ink cbs-tabular">{user.branchCode}{user.branchName ? ` — ${user.branchName}` : ''}</div>
            </div>
          )}
        </div>
        {!isPostingAllowed && <div className="cbs-alert cbs-alert-warning"><span className="font-semibold">Posting Blocked:</span> {blockReason}</div>}
        {error && (
          <div className="cbs-alert cbs-alert-error">
            <div className="font-semibold">Account opening failed</div>
            <div>{error}</div>
            {correlationId && <div className="mt-1 text-xs cbs-tabular">Ref: {correlationId}</div>}
          </div>
        )}
      </div>

      {/* ── Customer Snapshot (visible after CIF fetch) ────── */}
      {cifCustomer && (
        <div className="shrink-0 cbs-surface mb-4">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold text-cbs-ink">{cifCustomer.firstName} {cifCustomer.lastName}</span>
            <div className="flex items-center gap-2">
              <Badge variant={cifCustomer.kycStatus === 'VERIFIED' ? 'success' : 'warning'}>
                KYC: {cifCustomer.kycStatus}
              </Badge>
              <Badge variant={cifCustomer.riskCategory === 'HIGH' ? 'danger' : 'default'}>
                Risk: {cifCustomer.riskCategory || 'LOW'}
              </Badge>
            </div>
          </div>
          <div className="cbs-surface-body flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <span className="text-cbs-steel-600">CIF: <span className="text-cbs-ink font-medium cbs-tabular">{cifCustomer.customerNumber}</span></span>
            {cifCustomer.mobile && <span className="text-cbs-steel-600">Mobile: <span className="text-cbs-ink cbs-tabular">{cifCustomer.mobile}</span></span>}
            {cifCustomer.email && <span className="text-cbs-steel-600">Email: <span className="text-cbs-ink">{cifCustomer.email}</span></span>}
            {cifCustomer.pan && <span className="text-cbs-steel-600">PAN: <span className="text-cbs-ink cbs-tabular">{cifCustomer.pan}</span></span>}
            {cifCustomer.pepFlag && <span className="text-cbs-crimson-700 font-semibold">⚠ PEP</span>}
          </div>
        </div>
      )}

      {/* ── Form: 8+4 Grid ─────────────────────────────────── */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* ── Left: Sectioned Form (8 cols) ────────────── */}
            <div className="lg:col-span-8 space-y-3">
              {/* §1 Product Selection + CIF Lookup */}
              <Section id="product" title="Product Selection" isOpen={openSections.has('product')} onToggle={() => toggle('product')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Customer ID (CIF)" required htmlFor="customerId" error={errors.customerId?.message || cifError || undefined}>
                    <div className="flex gap-1.5">
                      <input id="customerId" className="cbs-input cbs-tabular flex-1" inputMode="numeric" placeholder="e.g. 1001" {...register('customerId')} />
                      <button type="button" onClick={fetchCif} disabled={cifLoading} className="cbs-btn cbs-btn-secondary h-[34px] px-3 shrink-0" aria-label="Fetch customer">
                        {cifLoading ? <span className="text-xs">Loading…</span> : <Search size={14} strokeWidth={1.75} />}
                      </button>
                    </div>
                  </FormField>
                  <CbsSelect label="Account Type" options={[
                    { value: 'SAVINGS', label: 'Savings (SB)' }, { value: 'CURRENT', label: 'Current (CA)' },
                    { value: 'SAVINGS_NRI', label: 'NRI Savings' }, { value: 'SALARY', label: 'Salary' },
                  ]} {...register('accountType')} />
                  <CbsSelect label="Currency" options={[{ value: 'INR', label: 'INR — Indian Rupee' }]} {...register('currencyCode')} />
                  <AmountInr label="Initial Deposit" hint="Optional. Min balance per product." {...register('initialDeposit')} error={errors.initialDeposit?.message} />
                </div>
              </Section>
              {/* §3 KYC */}
              <Section id="kyc" title="KYC & Regulatory" isOpen={openSections.has('kyc')} onToggle={() => toggle('kyc')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Pan label="PAN" {...register('panNumber')} error={errors.panNumber?.message} />
                  <Aadhaar label="Aadhaar" hint="Masked in display." {...register('aadhaarNumber')} error={errors.aadhaarNumber?.message} />
                  <CbsSelect label="KYC Status" options={[{ value: '', label: '— Select —' }, { value: 'FULL_KYC', label: 'Full KYC' }, { value: 'MIN_KYC', label: 'Min KYC' }]} {...register('kycStatus')} />
                  <CbsSelect label="PEP" options={[{ value: '', label: '— Select —' }, { value: 'NO', label: 'No' }, { value: 'YES', label: 'Yes' }]} {...register('pepFlag')} />
                </div>
              </Section>
              {/* §4 Personal */}
              <Section id="personal" title="Personal Details" isOpen={openSections.has('personal')} onToggle={() => toggle('personal')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Full Name" required htmlFor="fullName" error={errors.fullName?.message}>
                    <input id="fullName" className="cbs-input" placeholder="As per PAN" {...register('fullName')} />
                  </FormField>
                  <ValueDate label="Date of Birth" {...register('dateOfBirth')} />
                  <CbsSelect label="Gender" options={[{ value: '', label: '— Select —' }, { value: 'MALE', label: 'Male' }, { value: 'FEMALE', label: 'Female' }]} {...register('gender')} />
                  <FormField label="Father / Spouse" htmlFor="fatherSpouseName">
                    <input id="fatherSpouseName" className="cbs-input" {...register('fatherSpouseName')} />
                  </FormField>
                </div>
              </Section>
              {/* §5 Contact */}
              <Section id="contact" title="Contact Details" isOpen={openSections.has('contact')} onToggle={() => toggle('contact')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Mobile" htmlFor="mobileNumber" error={errors.mobileNumber?.message}>
                    <input id="mobileNumber" className="cbs-input cbs-tabular" inputMode="tel" maxLength={10} placeholder="9876543210" {...register('mobileNumber')} />
                  </FormField>
                  <FormField label="Email" htmlFor="email" error={errors.email?.message}>
                    <input id="email" className="cbs-input" type="email" {...register('email')} />
                  </FormField>
                </div>
              </Section>
              {/* §6 Address */}
              <Section id="address" title="Address" isOpen={openSections.has('address')} onToggle={() => toggle('address')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Address Line 1" htmlFor="al1"><input id="al1" className="cbs-input" {...register('addressLine1')} /></FormField>
                  <FormField label="Address Line 2" htmlFor="al2"><input id="al2" className="cbs-input" {...register('addressLine2')} /></FormField>
                  <FormField label="City" htmlFor="city"><input id="city" className="cbs-input" {...register('city')} /></FormField>
                  <FormField label="State" htmlFor="state"><input id="state" className="cbs-input" {...register('state')} /></FormField>
                  <FormField label="PIN Code" htmlFor="pinCode" error={errors.pinCode?.message}>
                    <input id="pinCode" className="cbs-input cbs-tabular" inputMode="numeric" maxLength={6} {...register('pinCode')} />
                  </FormField>
                </div>
              </Section>
              {/* §7 Occupation */}
              <Section id="occupation" title="Occupation & Financial Profile" isOpen={openSections.has('occupation')} onToggle={() => toggle('occupation')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <CbsSelect label="Occupation" options={[{ value: '', label: '— Select —' }, { value: 'SALARIED', label: 'Salaried' }, { value: 'BUSINESS', label: 'Business' }, { value: 'RETIRED', label: 'Retired' }]} {...register('occupation')} />
                  <CbsSelect label="Annual Income" options={[{ value: '', label: '— Select —' }, { value: 'BELOW_1L', label: 'Below ₹1L' }, { value: '1L_5L', label: '₹1–5L' }, { value: '5L_10L', label: '₹5–10L' }]} {...register('annualIncome')} />
                  <CbsSelect label="Source of Funds" options={[{ value: '', label: '— Select —' }, { value: 'SALARY', label: 'Salary' }, { value: 'BUSINESS', label: 'Business' }]} {...register('sourceOfFunds')} />
                </div>
              </Section>
              {/* §8 Nominee */}
              <Section id="nominee" title="Nominee Details" isOpen={openSections.has('nominee')} onToggle={() => toggle('nominee')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Nominee Name" htmlFor="nomineeName"><input id="nomineeName" className="cbs-input" {...register('nomineeName')} /></FormField>
                  <CbsSelect label="Relationship" options={[{ value: '', label: '— Select —' }, { value: 'SPOUSE', label: 'Spouse' }, { value: 'FATHER', label: 'Father' }, { value: 'MOTHER', label: 'Mother' }]} {...register('nomineeRelationship')} />
                </div>
              </Section>
              {/* §9 FATCA */}
              <Section id="fatca" title="FATCA / CRS" isOpen={openSections.has('fatca')} onToggle={() => toggle('fatca')}>
                <CbsSelect label="US Tax Resident" options={[{ value: '', label: '— Select —' }, { value: 'NO', label: 'No' }, { value: 'YES', label: 'Yes' }]} {...register('usTaxResident')} />
              </Section>
              {/* §10 Config */}
              <Section id="config" title="Account Configuration" isOpen={openSections.has('config')} onToggle={() => toggle('config')}>
                <div className="space-y-3">
                  <Checkbox label="Cheque Book Required" {...register('chequeBookRequired')} />
                  <Checkbox label="Debit Card Required" {...register('debitCardRequired')} />
                  <Checkbox label="SMS Alerts" {...register('smsAlerts')} />
                </div>
              </Section>
              {/* §14 Declarations */}
              <Section id="declarations" title="Declarations & Consent" isOpen={openSections.has('declarations')} onToggle={() => toggle('declarations')}>
                <div className="space-y-3">
                  <Checkbox label="I confirm customer due diligence has been completed" {...register('dueDiligenceConfirmed')} />
                  <Checkbox label="Documents have been verified physically" {...register('documentsVerified')} />
                  <Checkbox label="Customer consent has been obtained" {...register('customerConsentObtained')} />
                </div>
              </Section>
            </div>

            {/* ── Right: Risk Panel (4 cols) ──────────────── */}
            <div className="lg:col-span-4">
              <div className="cbs-surface sticky top-0">
                <div className="cbs-surface-header">
                  <span className="cbs-field-label">Risk Assessment</span>
                  <Badge variant="default">Pending</Badge>
                </div>
                <div className="cbs-surface-body space-y-2 text-xs">
                  {!cifCustomer && <p className="text-cbs-steel-600">Fetch CIF to populate risk assessment.</p>}
                  <div className="border-t border-cbs-steel-100 pt-2 space-y-1.5">
                    <div className="flex justify-between"><span className="text-cbs-steel-600">KYC Status</span><span className={clsx('font-medium', cifCustomer?.kycStatus === 'VERIFIED' ? 'text-cbs-olive-700' : cifCustomer ? 'text-cbs-gold-700' : 'text-cbs-ink')}>{cifCustomer?.kycStatus || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-cbs-steel-600">PEP Flag</span><span className={clsx('font-medium', cifCustomer?.pepFlag ? 'text-cbs-crimson-700' : 'text-cbs-ink')}>{cifCustomer ? (cifCustomer.pepFlag ? 'Yes ⚠' : 'No') : '—'}</span></div>
                    <div className="flex justify-between"><span className="text-cbs-steel-600">Risk Category</span><span className={clsx('font-medium', cifCustomer?.riskCategory === 'HIGH' ? 'text-cbs-crimson-700' : cifCustomer?.riskCategory === 'MEDIUM' ? 'text-cbs-gold-700' : 'text-cbs-ink')}>{cifCustomer?.riskCategory || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-cbs-steel-600">Sanction Check</span><span className="text-cbs-ink font-medium">{cifCustomer ? 'Pending' : '—'}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Sticky Footer ──────────────────────────────── */}
        <div className="shrink-0 flex items-center justify-between gap-2 border-t border-cbs-steel-200 bg-cbs-paper pt-3 mt-4">
          <Link href="/accounts" className="cbs-btn cbs-btn-secondary">Cancel</Link>
          <div className="flex gap-2">
            <Button type="submit" isLoading={isSubmitting} disabled={!isPostingAllowed}>Submit for Approval</Button>
          </div>
        </div>
      </form>
    </div>
  );
}
