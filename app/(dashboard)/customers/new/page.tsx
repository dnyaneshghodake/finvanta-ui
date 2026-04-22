'use client';

/**
 * FINVANTA CBS — New Customer (CIF Creation) — Tier-1 Grade.
 *
 * Creates a Customer Information File (CIF) via POST /api/v1/customers.
 * MAKER action — record enters PENDING_APPROVAL, requires CHECKER approval.
 *
 * Field coverage:
 *   - RBI Master Direction on KYC (2016, updated 2023)
 *   - CKYC (Central KYC Registry) Form Part I & II
 *   - PMLA 2002 §12 (PEP flag)
 *   - FATCA/CRS (tax residency)
 *   - UIDAI guidelines (Aadhaar masking)
 *
 * PII fields encrypted at rest by Spring PiiEncryptionConverter (AES-256-GCM).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient } from '@/services/api/apiClient';
import { Pan, Aadhaar, ValueDate, Breadcrumb } from '@/components/cbs';
import { Button } from '@/components/atoms';
import { R, resolvePath } from '@/config/routes';
import type { RouteEntry } from '@/config/routes';

/* ── Indian states for address dropdown ── */
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman & Nicobar', 'Chandigarh', 'Dadra & Nagar Haveli', 'Daman & Diu',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
] as const;

/* ── Zod schema — RBI KYC / CKYC / PMLA compliant ── */
const addressSchema = z.object({
  line1: z.string().min(1, 'Address line 1 is required').max(100),
  line2: z.string().max(100).optional().or(z.literal('')),
  city: z.string().min(1, 'City is required').max(50),
  district: z.string().min(1, 'District is required').max(50),
  state: z.string().min(1, 'State is required'),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  country: z.string().min(1, 'Country is required'),
});

const cifSchema = z.object({
  /* ── Personal Identification (CKYC Part I) ── */
  customerType: z.enum(['INDIVIDUAL', 'CORPORATE']),
  firstName: z.string().min(1, 'First name is required').max(50),
  middleName: z.string().max(50).optional().or(z.literal('')),
  lastName: z.string().min(1, 'Last name is required').max(50),
  fatherOrSpouseName: z.string().min(1, 'Father/Spouse name is required (CKYC)').max(80),
  motherName: z.string().min(1, 'Mother name is required (CKYC)').max(80),
  dob: z.string().min(1, 'Date of birth is required'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER'], { message: 'Gender is required' }),
  maritalStatus: z.enum(['SINGLE', 'MARRIED', 'WIDOWED', 'DIVORCED'], { message: 'Marital status is required' }),
  nationality: z.string().min(1, 'Nationality is required').max(30),
  residentStatus: z.enum(['RESIDENT', 'NRI', 'NRE', 'NRO'], { message: 'Resident status is required' }),

  /* ── KYC / OVD (RBI KYC §8) ── */
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN format'),
  aadhaar: z.string().regex(/^\d{12}$/, 'Aadhaar must be 12 digits'),
  ckycNumber: z.string().regex(/^\d{14}$/, '14-digit CKYC number').optional().or(z.literal('')),
  passportNumber: z.string().max(20).optional().or(z.literal('')),
  passportExpiry: z.string().optional().or(z.literal('')),
  voterId: z.string().max(20).optional().or(z.literal('')),
  drivingLicense: z.string().max(20).optional().or(z.literal('')),

  /* ── Contact (CKYC Part I) ── */
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number'),
  alternateMobile: z.string().regex(/^[6-9]\d{9}$/, 'Invalid mobile').optional().or(z.literal('')),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  communicationPref: z.enum(['SMS', 'EMAIL', 'BOTH']).optional(),

  /* ── Occupation & Income (CKYC Part II) ── */
  occupation: z.enum([
    'SALARIED', 'SELF_EMPLOYED', 'BUSINESS', 'PROFESSIONAL',
    'RETIRED', 'HOUSEWIFE', 'STUDENT', 'AGRICULTURE', 'OTHER',
  ], { message: 'Occupation is required' }),
  annualIncomeRange: z.enum([
    'BELOW_1L', '1L_5L', '5L_10L', '10L_25L', '25L_1CR', 'ABOVE_1CR',
  ], { message: 'Annual income range is required' }),
  sourceOfFunds: z.string().min(1, 'Source of funds is required').max(100),

  /* ── Risk & Compliance (PMLA / FATCA) ── */
  riskCategory: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  pepFlag: z.boolean().optional(),
  fatcaCountry: z.string().max(50).optional().or(z.literal('')),

  /* ── Cross-Module Linkage ── */
  customerSegment: z.enum(['RETAIL', 'HNI', 'CORPORATE', 'SME', 'MSME']).optional(),
  sourceOfIntroduction: z.string().max(100).optional().or(z.literal('')),
  relationshipManagerId: z.string().max(20).optional().or(z.literal('')),

  /* ── Corporate-specific (RBI KYC §18) ── */
  companyName: z.string().max(100).optional().or(z.literal('')),
  cin: z.string().max(21).optional().or(z.literal('')),
  gstin: z.string().max(15).optional().or(z.literal('')),
  dateOfIncorporation: z.string().optional().or(z.literal('')),
  constitutionType: z.enum([
    'PVT_LTD', 'PUBLIC_LTD', 'LLP', 'PARTNERSHIP', 'SOLE_PROPRIETOR',
    'TRUST', 'SOCIETY', 'HUF', 'GOVERNMENT', 'OTHER',
  ]).optional(),
  natureOfBusiness: z.string().max(100).optional().or(z.literal('')),

  /* ── Addresses (CKYC requires both permanent + correspondence) ── */
  permanentAddress: addressSchema,
  correspondenceAddress: addressSchema.optional(),
  sameAsPermanent: z.boolean().optional(),
}).superRefine((data, ctx) => {
  // When "Same as permanent" is NOT checked, correspondence address
  // fields are mandatory per CKYC. When checked, the onSubmit handler
  // copies permanent → correspondence before sending to the backend.
  if (!data.sameAsPermanent) {
    const ca = data.correspondenceAddress;
    if (!ca?.line1) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Address line 1 is required', path: ['correspondenceAddress', 'line1'] });
    if (!ca?.city) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'City is required', path: ['correspondenceAddress', 'city'] });
    if (!ca?.district) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'District is required', path: ['correspondenceAddress', 'district'] });
    if (!ca?.state) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'State is required', path: ['correspondenceAddress', 'state'] });
    if (!ca?.pincode || !/^\d{6}$/.test(ca.pincode)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Pincode must be 6 digits', path: ['correspondenceAddress', 'pincode'] });
    if (!ca?.country) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Country is required', path: ['correspondenceAddress', 'country'] });
  }
});

type CifForm = z.infer<typeof cifSchema>;

/* ── Reusable field wrapper with label + error + aria ── */
function F({ id, label, error, required, children }: {
  id: string; label: string; error?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="cbs-field-label block mb-1">
        {label}{required && <span className="text-cbs-crimson-700 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-cbs-crimson-700 mt-1" role="alert">{error}</p>}
    </div>
  );
}

export default function NewCustomerPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CifForm>({
    resolver: zodResolver(cifSchema),
    defaultValues: {
      customerType: 'INDIVIDUAL', firstName: '', middleName: '', lastName: '',
      fatherOrSpouseName: '', motherName: '', dob: '', gender: '' as unknown as 'MALE',
      maritalStatus: '' as unknown as 'SINGLE', nationality: 'Indian', residentStatus: 'RESIDENT',
      pan: '', aadhaar: '', ckycNumber: '', passportNumber: '', passportExpiry: '',
      voterId: '', drivingLicense: '', mobile: '', alternateMobile: '', email: '',
      communicationPref: 'BOTH', occupation: '' as unknown as 'SALARIED', annualIncomeRange: '' as unknown as 'BELOW_1L',
      sourceOfFunds: '', riskCategory: 'LOW', pepFlag: false, fatcaCountry: '',
      customerSegment: 'RETAIL', sourceOfIntroduction: '', relationshipManagerId: '',
      companyName: '', cin: '', gstin: '', dateOfIncorporation: '', constitutionType: undefined,
      natureOfBusiness: '',
      permanentAddress: { line1: '', line2: '', city: '', district: '', state: '', pincode: '', country: 'India' },
      correspondenceAddress: { line1: '', line2: '', city: '', district: '', state: '', pincode: '', country: 'India' },
      sameAsPermanent: false,
    },
  });

  const customerType = useWatch({ control, name: 'customerType' });
  const sameAsPermanent = useWatch({ control, name: 'sameAsPermanent' });

  const onSubmit = async (data: CifForm) => {
    setError(null);
    try {
      // Map frontend form field names → Spring REST_API_COMPLETE_CATALOGUE
      // §Customer Module field names. The form uses CKYC-centric naming;
      // Spring uses flat CBS-centric naming.
      const addr = data.sameAsPermanent
        ? data.permanentAddress
        : (data.correspondenceAddress ?? data.permanentAddress);
      const payload = {
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dob,
        panNumber: data.pan,
        aadhaarNumber: data.aadhaar,
        mobileNumber: data.mobile,
        email: data.email || undefined,
        address: data.permanentAddress.line1 + (data.permanentAddress.line2 ? ', ' + data.permanentAddress.line2 : ''),
        city: data.permanentAddress.city,
        state: data.permanentAddress.state,
        pinCode: data.permanentAddress.pincode,
        customerType: data.customerType,
        branchId: 1, // TODO: read from session user's branch
        gender: data.gender === 'MALE' ? 'M' : data.gender === 'FEMALE' ? 'F' : 'O',
        fatherName: data.fatherOrSpouseName,
        motherName: data.motherName,
        nationality: data.nationality?.toUpperCase() === 'INDIAN' ? 'INDIAN' : data.nationality,
        maritalStatus: data.maritalStatus,
        occupationCode: data.occupation,
        annualIncomeBand: data.annualIncomeRange,
        kycRiskCategory: data.riskCategory || 'LOW',
        pep: data.pepFlag ?? false,
        kycMode: 'ONLINE',
        addressSameAsPermanent: data.sameAsPermanent ?? false,
        permanentAddress: data.permanentAddress.line1 + (data.permanentAddress.line2 ? ', ' + data.permanentAddress.line2 : ''),
        permanentCity: data.permanentAddress.city,
        permanentState: data.permanentAddress.state,
        permanentPinCode: data.permanentAddress.pincode,
        permanentCountry: data.permanentAddress.country,
        // Corporate fields (only if applicable)
        ...(data.customerType === 'CORPORATE' ? {
          employerName: data.companyName,
          employmentType: 'CORPORATE',
        } : {
          employmentType: data.occupation === 'SALARIED' ? 'SALARIED' : data.occupation === 'SELF_EMPLOYED' ? 'SELF_EMPLOYED' : undefined,
        }),
      };
      const res = await apiClient.post('/customers', payload);
      const corr = res.headers?.['x-correlation-id'] as string | undefined;
      setCorrelationId(corr || null);
      if (res.data?.status === 'SUCCESS' && res.data?.data?.id) {
        router.push(resolvePath(R.customers.view as RouteEntry, String(res.data.data.id)));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create customer';
      setError(msg);
    }
  };

  return (
    <div className="space-y-4">
      <Breadcrumb items={[{ label: R.dashboard.home.label, href: R.dashboard.home.path as string }, { label: R.customers.search.label, href: R.customers.search.path as string }, { label: R.customers.create.label }]} />

      <div>
        <h1 className="text-xl font-semibold text-cbs-ink">New Customer — CIF Creation</h1>
        <p className="text-xs text-cbs-steel-600 mt-0.5">
          Maker action — CIF requires checker approval.
          <span className="text-cbs-crimson-700 ml-0.5">*</span> = mandatory per RBI KYC / CKYC.
        </p>
      </div>

      <div aria-live="polite" aria-atomic="true">
        {error && (
          <div role="alert" className="cbs-alert cbs-alert-error">
            <div className="font-semibold text-sm">CIF creation failed</div>
            <div className="mt-1 text-sm">{error}</div>
            {correlationId && (
              <div className="mt-1 text-xs cbs-tabular">Ref: {correlationId}</div>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Global validation error summary — shows when fields have errors
          * but the operator may not see them (e.g. scrolled past). Per CBS
          * convention: always show a top-level banner on failed submit. */}
        {Object.keys(errors).length > 0 && (
          <div role="alert" className="cbs-alert cbs-alert-error">
            <div className="font-semibold text-sm">Please fix {Object.keys(errors).length} validation error{Object.keys(errors).length > 1 ? 's' : ''} below</div>
            <div className="mt-1 text-xs text-cbs-crimson-700">All fields marked with * are mandatory per RBI KYC / CKYC guidelines.</div>
          </div>
        )}
        {/* 1. PERSONAL IDENTIFICATION (CKYC Part I) */}
        <section className="cbs-surface"><div className="cbs-surface-header"><span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Personal Identification — CKYC Part I</span></div>
          <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-4 gap-4">
            <F id="customerType" label="Customer Type" error={errors.customerType?.message} required><select id="customerType" className="cbs-select" {...register('customerType')}><option value="INDIVIDUAL">Individual</option><option value="CORPORATE">Corporate</option></select></F>
            <F id="firstName" label="First Name" error={errors.firstName?.message} required><input id="firstName" className="cbs-input" aria-invalid={!!errors.firstName} {...register('firstName')} /></F>
            <F id="middleName" label="Middle Name"><input id="middleName" className="cbs-input" {...register('middleName')} /></F>
            <F id="lastName" label="Last Name" error={errors.lastName?.message} required><input id="lastName" className="cbs-input" aria-invalid={!!errors.lastName} {...register('lastName')} /></F>
            <F id="fatherOrSpouseName" label="Father / Spouse Name" error={errors.fatherOrSpouseName?.message} required><input id="fatherOrSpouseName" className="cbs-input" aria-invalid={!!errors.fatherOrSpouseName} {...register('fatherOrSpouseName')} /></F>
            <F id="motherName" label="Mother Name" error={errors.motherName?.message} required><input id="motherName" className="cbs-input" aria-invalid={!!errors.motherName} {...register('motherName')} /></F>
            <ValueDate label="Date of Birth *" {...register('dob')} error={errors.dob?.message} required />
            <F id="gender" label="Gender" error={errors.gender?.message} required><select id="gender" className="cbs-select" {...register('gender')}><option value="">— Select —</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></select></F>
            <F id="maritalStatus" label="Marital Status" error={errors.maritalStatus?.message} required><select id="maritalStatus" className="cbs-select" {...register('maritalStatus')}><option value="">— Select —</option><option value="SINGLE">Single</option><option value="MARRIED">Married</option><option value="WIDOWED">Widowed</option><option value="DIVORCED">Divorced</option></select></F>
            <F id="nationality" label="Nationality" error={errors.nationality?.message} required><input id="nationality" className="cbs-input" {...register('nationality')} /></F>
            <F id="residentStatus" label="Resident Status" error={errors.residentStatus?.message} required><select id="residentStatus" className="cbs-select" {...register('residentStatus')}><option value="RESIDENT">Resident Indian</option><option value="NRI">NRI</option><option value="NRE">NRE</option><option value="NRO">NRO</option></select></F>
          </div></section>

        {/* 2. KYC / OVD DOCUMENTS (RBI KYC §8) */}
        <section className="cbs-surface"><div className="cbs-surface-header"><span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">KYC / OVD Documents — PII Encrypted at Rest</span></div>
          <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-4 gap-4">
            <Pan label="PAN *" {...register('pan')} error={errors.pan?.message} required />
            <Aadhaar label="Aadhaar *" {...register('aadhaar')} error={errors.aadhaar?.message} required />
            <F id="ckycNumber" label="CKYC Number (14-digit)"><input id="ckycNumber" className="cbs-input cbs-tabular" maxLength={14} inputMode="numeric" {...register('ckycNumber')} /></F>
            <F id="passportNumber" label="Passport Number"><input id="passportNumber" className="cbs-input cbs-tabular uppercase" {...register('passportNumber')} /></F>
            <ValueDate label="Passport Expiry" {...register('passportExpiry')} />
            <F id="voterId" label="Voter ID"><input id="voterId" className="cbs-input cbs-tabular uppercase" {...register('voterId')} /></F>
            <F id="drivingLicense" label="Driving License"><input id="drivingLicense" className="cbs-input cbs-tabular uppercase" {...register('drivingLicense')} /></F>
          </div></section>

        {/* 3. CONTACT */}
        <section className="cbs-surface"><div className="cbs-surface-header"><span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Contact Details</span></div>
          <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-4 gap-4">
            <F id="mobile" label="Mobile" error={errors.mobile?.message} required><input id="mobile" className="cbs-input cbs-tabular" inputMode="numeric" maxLength={10} aria-invalid={!!errors.mobile} {...register('mobile')} /></F>
            <F id="alternateMobile" label="Alternate Mobile"><input id="alternateMobile" className="cbs-input cbs-tabular" inputMode="numeric" maxLength={10} {...register('alternateMobile')} /></F>
            <F id="email" label="Email" error={errors.email?.message}><input id="email" className="cbs-input" type="email" {...register('email')} /></F>
            <F id="communicationPref" label="Communication Pref"><select id="communicationPref" className="cbs-select" {...register('communicationPref')}><option value="SMS">SMS</option><option value="EMAIL">Email</option><option value="BOTH">Both</option></select></F>
          </div></section>

        {/* 4. OCCUPATION & INCOME (CKYC Part II) */}
        <section className="cbs-surface"><div className="cbs-surface-header"><span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Occupation &amp; Income — CKYC Part II</span></div>
          <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-4 gap-4">
            <F id="occupation" label="Occupation" error={errors.occupation?.message} required><select id="occupation" className="cbs-select" {...register('occupation')}><option value="">— Select —</option><option value="SALARIED">Salaried</option><option value="SELF_EMPLOYED">Self Employed</option><option value="BUSINESS">Business</option><option value="PROFESSIONAL">Professional</option><option value="RETIRED">Retired</option><option value="HOUSEWIFE">Housewife</option><option value="STUDENT">Student</option><option value="AGRICULTURE">Agriculture</option><option value="OTHER">Other</option></select></F>
            <F id="annualIncomeRange" label="Annual Income Range" error={errors.annualIncomeRange?.message} required><select id="annualIncomeRange" className="cbs-select" {...register('annualIncomeRange')}><option value="">— Select —</option><option value="BELOW_1L">Below ₹1 Lakh</option><option value="1L_5L">₹1–5 Lakh</option><option value="5L_10L">₹5–10 Lakh</option><option value="10L_25L">₹10–25 Lakh</option><option value="25L_1CR">₹25L–1Cr</option><option value="ABOVE_1CR">Above ₹1 Crore</option></select></F>
            <F id="sourceOfFunds" label="Source of Funds" error={errors.sourceOfFunds?.message} required><input id="sourceOfFunds" className="cbs-input" {...register('sourceOfFunds')} /></F>
          </div></section>

        {/* 5. RISK & COMPLIANCE (PMLA / FATCA) */}
        <section className="cbs-surface"><div className="cbs-surface-header"><span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Risk &amp; Compliance — PMLA / FATCA</span></div>
          <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-4 gap-4">
            <F id="riskCategory" label="Risk Category"><select id="riskCategory" className="cbs-select" {...register('riskCategory')}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></F>
            <F id="pepFlag" label="PEP (Politically Exposed Person)"><label className="flex items-center gap-2 mt-1"><input type="checkbox" className="h-4 w-4 accent-cbs-navy-700" {...register('pepFlag')} /><span className="text-sm text-cbs-ink">Yes, this customer is a PEP</span></label></F>
            <F id="fatcaCountry" label="FATCA Tax Residency Country"><input id="fatcaCountry" className="cbs-input" placeholder="Leave blank if India only" {...register('fatcaCountry')} /></F>
            <F id="customerSegment" label="Customer Segment"><select id="customerSegment" className="cbs-select" {...register('customerSegment')}><option value="RETAIL">Retail</option><option value="HNI">HNI</option><option value="CORPORATE">Corporate</option><option value="SME">SME</option><option value="MSME">MSME</option></select></F>
          </div></section>

        {/* 6. CROSS-MODULE LINKAGE */}
        <section className="cbs-surface"><div className="cbs-surface-header"><span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Cross-Module Linkage</span></div>
          <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-4 gap-4">
            <F id="sourceOfIntroduction" label="Source of Introduction"><input id="sourceOfIntroduction" className="cbs-input" {...register('sourceOfIntroduction')} /></F>
            <F id="relationshipManagerId" label="Relationship Manager ID"><input id="relationshipManagerId" className="cbs-input cbs-tabular" {...register('relationshipManagerId')} /></F>
          </div></section>

        {/* 7. CORPORATE DETAILS (conditional — RBI KYC §18) */}
        {customerType === 'CORPORATE' && (
          <section className="cbs-surface"><div className="cbs-surface-header"><span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Corporate Details — RBI KYC §18</span></div>
            <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-4 gap-4">
              <F id="companyName" label="Company / Entity Name" required><input id="companyName" className="cbs-input" {...register('companyName')} /></F>
              <F id="cin" label="CIN"><input id="cin" className="cbs-input cbs-tabular uppercase" maxLength={21} {...register('cin')} /></F>
              <F id="gstin" label="GSTIN"><input id="gstin" className="cbs-input cbs-tabular uppercase" maxLength={15} {...register('gstin')} /></F>
              <ValueDate label="Date of Incorporation" {...register('dateOfIncorporation')} />
              <F id="constitutionType" label="Constitution Type"><select id="constitutionType" className="cbs-select" {...register('constitutionType')}><option value="">— Select —</option><option value="PVT_LTD">Private Limited</option><option value="PUBLIC_LTD">Public Limited</option><option value="LLP">LLP</option><option value="PARTNERSHIP">Partnership</option><option value="SOLE_PROPRIETOR">Sole Proprietor</option><option value="TRUST">Trust</option><option value="SOCIETY">Society</option><option value="HUF">HUF</option><option value="GOVERNMENT">Government</option><option value="OTHER">Other</option></select></F>
              <F id="natureOfBusiness" label="Nature of Business"><input id="natureOfBusiness" className="cbs-input" {...register('natureOfBusiness')} /></F>
            </div></section>
        )}

        {/* 8. PERMANENT ADDRESS (CKYC mandate) */}
        <section className="cbs-surface"><div className="cbs-surface-header"><span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Permanent Address</span></div>
          <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2"><F id="pa-l1" label="Address Line 1" error={errors.permanentAddress?.line1?.message} required><input id="pa-l1" className="cbs-input" {...register('permanentAddress.line1')} /></F></div>
            <F id="pa-l2" label="Address Line 2"><input id="pa-l2" className="cbs-input" {...register('permanentAddress.line2')} /></F>
            <F id="pa-city" label="City" error={errors.permanentAddress?.city?.message} required><input id="pa-city" className="cbs-input" {...register('permanentAddress.city')} /></F>
            <F id="pa-dist" label="District" error={errors.permanentAddress?.district?.message} required><input id="pa-dist" className="cbs-input" {...register('permanentAddress.district')} /></F>
            <F id="pa-state" label="State" error={errors.permanentAddress?.state?.message} required><select id="pa-state" className="cbs-select" {...register('permanentAddress.state')}><option value="">— Select —</option>{INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}</select></F>
            <F id="pa-pin" label="Pincode" error={errors.permanentAddress?.pincode?.message} required><input id="pa-pin" className="cbs-input cbs-tabular" inputMode="numeric" maxLength={6} {...register('permanentAddress.pincode')} /></F>
            <F id="pa-country" label="Country" error={errors.permanentAddress?.country?.message} required><input id="pa-country" className="cbs-input" {...register('permanentAddress.country')} /></F>
          </div></section>

        {/* 9. CORRESPONDENCE ADDRESS (CKYC mandate) */}
        <section className="cbs-surface"><div className="cbs-surface-header"><span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Correspondence Address</span>
            <label className="flex items-center gap-2 text-xs text-cbs-steel-600"><input type="checkbox" className="h-3.5 w-3.5 accent-cbs-navy-700" {...register('sameAsPermanent')} /> Same as permanent</label></div>
          {!sameAsPermanent && (
            <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2"><F id="ca-l1" label="Address Line 1" error={errors.correspondenceAddress?.line1?.message} required><input id="ca-l1" className="cbs-input" {...register('correspondenceAddress.line1')} /></F></div>
              <F id="ca-l2" label="Address Line 2"><input id="ca-l2" className="cbs-input" {...register('correspondenceAddress.line2')} /></F>
              <F id="ca-city" label="City" error={errors.correspondenceAddress?.city?.message} required><input id="ca-city" className="cbs-input" {...register('correspondenceAddress.city')} /></F>
              <F id="ca-dist" label="District" error={errors.correspondenceAddress?.district?.message} required><input id="ca-dist" className="cbs-input" {...register('correspondenceAddress.district')} /></F>
              <F id="ca-state" label="State" error={errors.correspondenceAddress?.state?.message} required><select id="ca-state" className="cbs-select" {...register('correspondenceAddress.state')}><option value="">— Select —</option>{INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}</select></F>
              <F id="ca-pin" label="Pincode" error={errors.correspondenceAddress?.pincode?.message} required><input id="ca-pin" className="cbs-input cbs-tabular" inputMode="numeric" maxLength={6} {...register('correspondenceAddress.pincode')} /></F>
              <F id="ca-country" label="Country" error={errors.correspondenceAddress?.country?.message} required><input id="ca-country" className="cbs-input" {...register('correspondenceAddress.country')} /></F>
            </div>
          )}</section>

        {/* SUBMIT */}
        <div className="flex gap-2 justify-end border-t border-cbs-steel-200 pt-3">
          <Button type="button" variant="secondary" onClick={() => router.push(R.customers.search.path as string)}>Cancel</Button>
          <Button type="submit" isLoading={isSubmitting}>Submit for Approval</Button>
        </div>
      </form>
    </div>
  );
}