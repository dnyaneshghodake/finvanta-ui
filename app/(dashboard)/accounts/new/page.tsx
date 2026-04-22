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
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { accountService } from '@/services/api/accountService';
import {
  AmountInr, Pan, Aadhaar, ValueDate,
  Breadcrumb, CbsSelect,
  CifLookup, type CifCustomer,
} from '@/components/cbs';
import { Button, Checkbox, Badge, RoleGate } from '@/components/atoms';
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
  // §14 Declarations — RBI CDD mandates: maker must confirm all three before submission
  dueDiligenceConfirmed: z.literal(true, { message: 'Due diligence confirmation is required' }),
  documentsVerified: z.literal(true, { message: 'Document verification confirmation is required' }),
  customerConsentObtained: z.literal(true, { message: 'Customer consent confirmation is required' }),
});

type AccountForm = z.infer<typeof accountSchema>;

/* ── Field → Section Mapping ─────────────────────────────────
 * Static map used to auto-expand accordion sections containing
 * validation errors on invalid submit. Declared outside the
 * component to avoid recreation on each render. */
const FIELD_SECTION_MAP: Record<string, string> = {
  customerId: 'product', accountType: 'product', currencyCode: 'product', initialDeposit: 'product',
  panNumber: 'kyc', aadhaarNumber: 'kyc', kycStatus: 'kyc', pepFlag: 'kyc',
  fullName: 'personal', dateOfBirth: 'personal', gender: 'personal', fatherSpouseName: 'personal', nationality: 'personal',
  mobileNumber: 'contact', email: 'contact',
  addressLine1: 'address', addressLine2: 'address', city: 'address', state: 'address', pinCode: 'address',
  occupation: 'occupation', annualIncome: 'occupation', sourceOfFunds: 'occupation',
  nomineeName: 'nominee', nomineeRelationship: 'nominee',
  usTaxResident: 'fatca',
  chequeBookRequired: 'config', debitCardRequired: 'config', smsAlerts: 'config',
  dueDiligenceConfirmed: 'declarations', documentsVerified: 'declarations', customerConsentObtained: 'declarations',
};

/* ── Collapsible Section ────────────────────────────────────────
 * Accordion-style wrapper. Uses CbsFieldset visual pattern with
 * a clickable legend bar. */
function Section({ id, title, isOpen, onToggle, children }: {
  id: string; title: string; isOpen: boolean;
  onToggle: () => void; children: React.ReactNode;
}) {
  const panelId = `section-${id}`;
  return (
    <fieldset className="cbs-fieldset overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="cbs-fieldset-legend flex items-center gap-2 w-full text-left cursor-pointer hover:bg-cbs-steel-50 transition-colors"
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <ChevronRight
          size={14} strokeWidth={2}
          className={clsx('text-cbs-steel-400 transition-transform duration-150 shrink-0', isOpen && 'rotate-90')}
          aria-hidden="true"
        />
        <span className="flex-1">{title}</span>
      </button>
      {/* Always render the panel div so aria-controls references a valid
       * DOM element (WCAG 1.3.1). Use hidden attribute when collapsed
       * to keep fields registered with react-hook-form. */}
      <div id={panelId} className="cbs-fieldset-body" hidden={!isOpen}>
        {children}
      </div>
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
   * Managed by the shared CifLookup component. The callback
   * receives the customer and auto-populates form fields. */
  const [cifCustomer, setCifCustomer] = useState<CifCustomer | null>(null);

  const toggle = (id: string) => setOpenSections((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      customerId: prefilledCustomerId, accountType: 'SAVINGS', currencyCode: 'INR',
      fullName: '', nomineeName: '', initialDeposit: '',
      chequeBookRequired: false, debitCardRequired: false, smsAlerts: true,
      dueDiligenceConfirmed: false as unknown as true,
      documentsVerified: false as unknown as true,
      customerConsentObtained: false as unknown as true,
    },
  });

  /* ── CIF Clear Handler ──────────────────────────────────────
   * Wrapped in useCallback to avoid recreating CifLookup's
   * fetchCustomer on every parent render (it's in the dep array). */
  const handleCustomerCleared = useCallback(() => {
    setCifCustomer(null);
    const cifFields = [
      'customerId', 'fullName', 'panNumber', 'aadhaarNumber', 'mobileNumber',
      'email', 'dateOfBirth', 'gender', 'nationality', 'fatherSpouseName',
      'occupation', 'annualIncome', 'sourceOfFunds', 'pepFlag', 'usTaxResident',
      'kycStatus', 'addressLine1', 'addressLine2', 'city', 'state', 'pinCode',
    ] as const;
    cifFields.forEach((f) => setValue(f, ''));
  }, [setValue]);

  /* Auto-expand sections containing validation errors so users can see them.
   * react-hook-form's onInvalid callback receives the FieldErrors object. */
  const expandErrorSections = useCallback((fieldErrors: FieldErrors<AccountForm>) => {
    const errorFields = Object.keys(fieldErrors);
    if (errorFields.length === 0) return;
    setOpenSections((prev) => {
      const next = new Set(prev);
      errorFields.forEach((field) => {
        const section = FIELD_SECTION_MAP[field];
        if (section) next.add(section);
      });
      return next;
    });
  }, []);

  /* ── CIF Auto-Populate ───────────────────────────────────────
   * Called by CifLookup when a valid customer is fetched.
   * Maps 13+ CIF fields to form fields via setValue. */
  const handleCustomerFound = useCallback((c: CifCustomer) => {
    setCifCustomer(c);
    setValue('customerId', String(c.id), { shouldValidate: true });
    setValue('fullName', [c.firstName, c.lastName].filter(Boolean).join(' '), { shouldValidate: true });
    // PAN/Aadhaar from CIF may be masked (e.g. "ABCD***34F", "**** **** 1234").
    // Only populate if the value is unmasked (raw), otherwise it will fail Zod regex.
    if (c.pan && /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(c.pan)) setValue('panNumber', c.pan);
    if (c.aadhaar && /^\d{12}$/.test(c.aadhaar)) setValue('aadhaarNumber', c.aadhaar);
    if (c.mobile) setValue('mobileNumber', c.mobile);
    if (c.email) setValue('email', c.email);
    if (c.dob) setValue('dateOfBirth', c.dob);
    if (c.gender) setValue('gender', c.gender);
    if (c.nationality) setValue('nationality', c.nationality);
    // Per CIF_API_CONTRACT v2.0 §3.4: prefer CERSAI separate fields, fall back to legacy combined field.
    const fatherOrSpouse = c.fatherName || c.spouseName || c.fatherOrSpouseName;
    if (fatherOrSpouse) setValue('fatherSpouseName', fatherOrSpouse);
    if (c.occupation) setValue('occupation', c.occupation);
    if (c.annualIncomeRange) setValue('annualIncome', c.annualIncomeRange);
    if (c.sourceOfFunds) setValue('sourceOfFunds', c.sourceOfFunds);
    if (c.pepFlag !== undefined && c.pepFlag !== null) setValue('pepFlag', c.pepFlag ? 'YES' : 'NO');
    if (c.fatcaCountry) setValue('usTaxResident', c.fatcaCountry !== 'IN' ? 'YES' : 'NO');
    // KYC mapping — per CIF_API_CONTRACT v2.0 §5: kycStatus is VERIFIED/PENDING/EXPIRED
    const kyc = c.kycStatus || '';
    if (kyc === 'VERIFIED') setValue('kycStatus', 'FULL_KYC');
    else if (kyc === 'PENDING' || kyc === 'EXPIRED') setValue('kycStatus', 'MIN_KYC');
    // Address — per CIF_API_CONTRACT v2.0 §3.9: use permanentAddress (nested object)
    const addr = c.permanentAddress;
    if (addr) {
      if (addr.line1) setValue('addressLine1', addr.line1);
      if (addr.line2) setValue('addressLine2', addr.line2);
      if (addr.city) setValue('city', addr.city);
      if (addr.state) setValue('state', addr.state);
      if (addr.pincode) setValue('pinCode', addr.pincode);
    }
    // Expand populated sections (merge, don't replace — preserves user-opened sections)
    setOpenSections((prev) => new Set([...prev, 'product', 'kyc', 'personal', 'contact', 'address', 'occupation']));
  }, [setValue]);

  const onSubmit = async (data: AccountForm) => {
    setError(null);
    setCorrelationId(null);
    try {
      /* Per ACCOUNT_OPENING_API_CONTRACT.md:
       * POST /accounts/open creates account in PENDING_ACTIVATION status.
       * Checker activates via POST /accounts/{accountNumber}/activate.
       * The workflow engine routes the approval to the checker queue.
       *
       * All 29 API fields are sent. The backend uses
       * @JsonIgnoreProperties(ignoreUnknown = true) so fields it doesn't
       * yet support are silently ignored — no breaking change. */
      const result = await accountService.createAccount({
        // §1 Product Selection
        customerId: Number(data.customerId),
        branchId: user?.branchId || 1,
        accountType: data.accountType,
        productCode: data.accountType,
        currencyCode: data.currencyCode || 'INR',
        initialDeposit: data.initialDeposit ? Number(data.initialDeposit.replace(/,/g, '')) : undefined,
        // §3 KYC & Regulatory
        panNumber: data.panNumber || undefined,
        aadhaarNumber: data.aadhaarNumber || undefined,
        kycStatus: data.kycStatus || undefined,
        pepFlag: data.pepFlag === 'YES' ? true : data.pepFlag === 'NO' ? false : undefined,
        // §4 Personal Details
        fullName: data.fullName || undefined,
        dateOfBirth: data.dateOfBirth || undefined,
        gender: data.gender || undefined,
        fatherSpouseName: data.fatherSpouseName || undefined,
        nationality: data.nationality || undefined,
        // §5 Contact Details
        mobileNumber: data.mobileNumber || undefined,
        email: data.email || undefined,
        // §6 Address
        addressLine1: data.addressLine1 || undefined,
        addressLine2: data.addressLine2 || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        pinCode: data.pinCode || undefined,
        // §7 Occupation & Financial Profile
        occupation: data.occupation || undefined,
        annualIncome: data.annualIncome || undefined,
        sourceOfFunds: data.sourceOfFunds || undefined,
        // §8 Nominee
        nomineeName: data.nomineeName || undefined,
        nomineeRelationship: data.nomineeRelationship || undefined,
        // §9 FATCA / CRS
        usTaxResident: data.usTaxResident === 'YES' ? true : data.usTaxResident === 'NO' ? false : undefined,
        // §10 Account Configuration
        chequeBookRequired: data.chequeBookRequired ?? false,
        debitCardRequired: data.debitCardRequired ?? false,
        smsAlerts: data.smsAlerts ?? true,
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

      {/* ── CIF Lookup (shared component) ────────────────── */}
      <CifLookup
        defaultValue={prefilledCustomerId}
        onCustomerFound={handleCustomerFound}
        onCustomerCleared={handleCustomerCleared}
        className="shrink-0 mb-4"
      />

      {/* ── Form: 8+4 Grid ─────────────────────────────────── */}
      <form onSubmit={handleSubmit(onSubmit, expandErrorSections)} className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* ── Left: Sectioned Form (8 cols) ────────────── */}
            <div className="lg:col-span-8 space-y-3">
              {/* §1 Product Selection (CIF is above the form via CifLookup) */}
              <Section id="product" title="Product Selection" isOpen={openSections.has('product')} onToggle={() => toggle('product')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* customerId is set by CifLookup → handleCustomerFound */}
                  <input type="hidden" {...register('customerId')} />
                  <CbsSelect label="Account Type" options={[
                    { value: 'SAVINGS', label: 'Savings (SB)' }, { value: 'CURRENT', label: 'Current (CA)' },
                    { value: 'CURRENT_OD', label: 'Current OD' }, { value: 'SAVINGS_NRI', label: 'NRI Savings' },
                    { value: 'SAVINGS_MINOR', label: 'Minor Savings' }, { value: 'SAVINGS_JOINT', label: 'Joint Savings' },
                    { value: 'SAVINGS_PMJDY', label: 'PMJDY Savings' }, { value: 'SALARY', label: 'Salary' },
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
                  <CbsSelect label="Gender" options={[{ value: '', label: '— Select —' }, { value: 'MALE', label: 'Male' }, { value: 'FEMALE', label: 'Female' }, { value: 'OTHER', label: 'Other' }]} {...register('gender')} />
                  <FormField label="Father / Spouse" htmlFor="fatherSpouseName">
                    <input id="fatherSpouseName" className="cbs-input" {...register('fatherSpouseName')} />
                  </FormField>
                  <CbsSelect label="Nationality" options={[{ value: '', label: '— Select —' }, { value: 'INDIAN', label: 'Indian' }, { value: 'NRI', label: 'NRI' }, { value: 'PIO', label: 'PIO' }, { value: 'OCI', label: 'OCI' }, { value: 'FOREIGN', label: 'Foreign' }]} {...register('nationality')} />
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
                  <CbsSelect label="Occupation" options={[
                    { value: '', label: '— Select —' }, { value: 'SALARIED_PRIVATE', label: 'Salaried (Private)' },
                    { value: 'SALARIED_GOVT', label: 'Salaried (Govt)' }, { value: 'SELF_EMPLOYED', label: 'Self Employed' },
                    { value: 'BUSINESS', label: 'Business' }, { value: 'PROFESSIONAL', label: 'Professional' },
                    { value: 'RETIRED', label: 'Retired' }, { value: 'HOUSEWIFE', label: 'Housewife' },
                    { value: 'STUDENT', label: 'Student' }, { value: 'AGRICULTURIST', label: 'Agriculturist' },
                    { value: 'OTHER', label: 'Other' },
                  ]} {...register('occupation')} />
                  <CbsSelect label="Annual Income" options={[
                    { value: '', label: '— Select —' }, { value: 'BELOW_1L', label: 'Below ₹1L' },
                    { value: '1L_TO_5L', label: '₹1–5L' }, { value: '5L_TO_10L', label: '₹5–10L' },
                    { value: '10L_TO_25L', label: '₹10–25L' }, { value: '25L_TO_1CR', label: '₹25L–1Cr' },
                    { value: 'ABOVE_1CR', label: 'Above ₹1Cr' },
                  ]} {...register('annualIncome')} />
                  <CbsSelect label="Source of Funds" options={[
                    { value: '', label: '— Select —' }, { value: 'SALARY', label: 'Salary' },
                    { value: 'BUSINESS', label: 'Business' }, { value: 'INVESTMENT', label: 'Investment' },
                    { value: 'AGRICULTURE', label: 'Agriculture' }, { value: 'PENSION', label: 'Pension' },
                    { value: 'OTHER', label: 'Other' },
                  ]} {...register('sourceOfFunds')} />
                </div>
              </Section>
              {/* §8 Nominee */}
              <Section id="nominee" title="Nominee Details" isOpen={openSections.has('nominee')} onToggle={() => toggle('nominee')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Nominee Name" htmlFor="nomineeName"><input id="nomineeName" className="cbs-input" {...register('nomineeName')} /></FormField>
                  <CbsSelect label="Relationship" options={[
                    { value: '', label: '— Select —' }, { value: 'SPOUSE', label: 'Spouse' },
                    { value: 'FATHER', label: 'Father' }, { value: 'MOTHER', label: 'Mother' },
                    { value: 'SON', label: 'Son' }, { value: 'DAUGHTER', label: 'Daughter' },
                    { value: 'SIBLING', label: 'Sibling' }, { value: 'OTHER', label: 'Other' },
                  ]} {...register('nomineeRelationship')} />
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
                  <Checkbox label="I confirm customer due diligence has been completed" {...register('dueDiligenceConfirmed')} error={errors.dueDiligenceConfirmed?.message} />
                  <Checkbox label="Documents have been verified physically" {...register('documentsVerified')} error={errors.documentsVerified?.message} />
                  <Checkbox label="Customer consent has been obtained" {...register('customerConsentObtained')} error={errors.customerConsentObtained?.message} />
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
                    <div className="flex justify-between"><span className="text-cbs-steel-600">KYC Status</span><span className={clsx('font-medium', cifCustomer?.kycStatus === 'VERIFIED' ? 'text-cbs-olive-700' : cifCustomer?.kycStatus === 'EXPIRED' ? 'text-cbs-crimson-700' : cifCustomer ? 'text-cbs-gold-700' : 'text-cbs-ink')}>{cifCustomer?.kycStatus || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-cbs-steel-600">PEP Flag</span><span className={clsx('font-medium', cifCustomer?.pepFlag ? 'text-cbs-crimson-700' : 'text-cbs-ink')}>{cifCustomer ? (cifCustomer.pepFlag ? 'Yes ⚠' : 'No') : '—'}</span></div>
                    <div className="flex justify-between"><span className="text-cbs-steel-600">Risk Category</span><span className={clsx('font-medium', cifCustomer?.riskCategory === 'HIGH' ? 'text-cbs-crimson-700' : cifCustomer?.riskCategory === 'MEDIUM' ? 'text-cbs-gold-700' : 'text-cbs-ink')}>{cifCustomer?.riskCategory || '—'}</span></div>
                    {cifCustomer?.rekycDue && <div className="flex justify-between"><span className="text-cbs-steel-600">Re-KYC</span><span className="text-cbs-crimson-700 font-medium">Due ⚠</span></div>}
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
            <RoleGate
              roles={['MAKER', 'ADMIN']}
              fallback={<span className="text-xs text-cbs-steel-600">Insufficient privileges — MAKER role required</span>}
            >
              <Button type="submit" isLoading={isSubmitting} disabled={!isPostingAllowed}>Submit for Approval</Button>
            </RoleGate>
          </div>
        </div>
      </form>
    </div>
  );
}
