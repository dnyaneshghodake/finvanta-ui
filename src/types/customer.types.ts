/**
 * Customer CIF domain types — maps 1:1 to the Spring Customer API.
 * @file src/types/customer.types.ts
 *
 * Per CIF_API_CONTRACT.md v2.0:
 *   - CreateCustomerRequest: 67 fields (§3)
 *   - CustomerResponse: 76 fields (§4)
 *   - CifLookupResponse: 30 fields (§5) — used by CifLookup.tsx
 *
 * Regulatory: RBI KYC MD 2016, PMLA 2002, CERSAI CKYC v2.0, FATCA IGA
 *
 * New code should import from this file directly:
 *   import type { CreateCustomerRequest, CustomerResponse } from '@/types/customer.types';
 */

/* ── Enum-like string unions ────────────────────────────────────── */

export type CustomerType =
  | 'INDIVIDUAL' | 'JOINT' | 'HUF' | 'PARTNERSHIP'
  | 'COMPANY' | 'TRUST' | 'NRI' | 'MINOR' | 'GOVERNMENT';

export type Gender = 'M' | 'F' | 'T';

export type MaritalStatus = 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED' | 'SEPARATED';

export type Nationality = 'INDIAN' | 'NRI' | 'PIO' | 'OCI' | 'FOREIGN';

export type ResidentStatus = 'RESIDENT' | 'NRI' | 'PIO' | 'OCI' | 'FOREIGN_NATIONAL';

export type OccupationCode =
  | 'SALARIED_PRIVATE' | 'SALARIED_GOVT' | 'BUSINESS' | 'PROFESSIONAL'
  | 'SELF_EMPLOYED' | 'RETIRED' | 'HOUSEWIFE' | 'STUDENT'
  | 'AGRICULTURIST' | 'OTHER';

export type AnnualIncomeBand =
  | 'BELOW_1L' | '1L_TO_5L' | '5L_TO_10L'
  | '10L_TO_25L' | '25L_TO_1CR' | 'ABOVE_1CR';

export type SourceOfFunds =
  | 'SALARY' | 'BUSINESS' | 'INVESTMENT' | 'AGRICULTURE' | 'PENSION' | 'OTHER';

export type KycRiskCategory = 'LOW' | 'MEDIUM' | 'HIGH';

export type KycMode = 'IN_PERSON' | 'VIDEO_KYC' | 'DIGITAL_KYC' | 'CKYC_DOWNLOAD';

export type PhotoIdType =
  | 'PASSPORT' | 'VOTER_ID' | 'DRIVING_LICENSE'
  | 'NREGA_CARD' | 'PAN_CARD' | 'AADHAAR';

export type AddressProofType =
  | 'PASSPORT' | 'VOTER_ID' | 'DRIVING_LICENSE'
  | 'UTILITY_BILL' | 'BANK_STATEMENT' | 'AADHAAR';

export type CommunicationPref = 'EMAIL' | 'SMS' | 'BOTH' | 'NONE';

export type EmploymentType = 'SALARIED' | 'SELF_EMPLOYED' | 'BUSINESS' | 'RETIRED' | 'OTHER';

export type CustomerSegment =
  | 'RETAIL' | 'PREMIUM' | 'HNI' | 'CORPORATE' | 'MSME' | 'AGRICULTURE';

export type ConstitutionType =
  | 'PROPRIETORSHIP' | 'PARTNERSHIP' | 'LLP' | 'PRIVATE_LIMITED'
  | 'PUBLIC_LIMITED' | 'TRUST' | 'SOCIETY' | 'HUF';

/* ── Request DTO — 67 fields per §3 ────────────────────────────── */

/**
 * CreateCustomerRequest — used by POST (create) and PUT (update).
 * All fields optional unless marked Required in the contract.
 * PAN and Aadhaar are immutable after creation (§6).
 */
export interface CreateCustomerRequest {
  // §3.1 Identity (8 fields)
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth?: string;
  panNumber?: string;
  aadhaarNumber?: string;
  customerType?: CustomerType;
  branchId: number;
  // §3.2 Contact (4 fields)
  mobileNumber?: string;
  email?: string;
  alternateMobile?: string;
  communicationPref?: CommunicationPref;
  // §3.3 Legacy Address (4 fields)
  address?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  // §3.4 Demographics — CERSAI v2.0 (10 fields)
  gender?: Gender;
  fatherName?: string;
  motherName?: string;
  spouseName?: string;
  nationality?: Nationality;
  maritalStatus?: MaritalStatus;
  residentStatus?: ResidentStatus;
  occupationCode?: OccupationCode;
  annualIncomeBand?: AnnualIncomeBand;
  sourceOfFunds?: SourceOfFunds;
  // §3.5 KYC and Risk (3 fields)
  kycRiskCategory?: KycRiskCategory;
  pep?: boolean;
  kycMode?: KycMode;
  // §3.6 KYC Documents (4 fields)
  photoIdType?: PhotoIdType;
  photoIdNumber?: string;
  addressProofType?: AddressProofType;
  addressProofNumber?: string;
  // §3.7 OVD — RBI KYC Section 3 (4 fields)
  passportNumber?: string;
  passportExpiry?: string;
  voterId?: string;
  drivingLicense?: string;
  // §3.8 FATCA/CRS (1 field)
  fatcaCountry?: string;
  // §3.9 Permanent Address — CKYC (7 fields)
  permanentAddress?: string;
  permanentCity?: string;
  permanentDistrict?: string;
  permanentState?: string;
  permanentPinCode?: string;
  permanentCountry?: string;
  addressSameAsPermanent?: boolean;
  // §3.10 Correspondence Address — CKYC (6 fields)
  correspondenceAddress?: string;
  correspondenceCity?: string;
  correspondenceDistrict?: string;
  correspondenceState?: string;
  correspondencePinCode?: string;
  correspondenceCountry?: string;
  // §3.11 Income and Exposure (5 fields)
  monthlyIncome?: number;
  maxBorrowingLimit?: number;
  employmentType?: EmploymentType;
  employerName?: string;
  cibilScore?: number;
  // §3.12 Segmentation (2 fields)
  customerSegment?: CustomerSegment;
  sourceOfIntroduction?: string;
  // §3.13 Corporate — RBI KYC Section 9 (6 fields)
  companyName?: string;
  cin?: string;
  gstin?: string;
  dateOfIncorporation?: string;
  constitutionType?: ConstitutionType;
  natureOfBusiness?: string;
  // §3.14 Nominee (3 fields)
  nomineeDob?: string;
  nomineeAddress?: string;
  nomineeGuardianName?: string;
}

/* ── Response DTO — 76 fields per §4 ───────────────────────────── */

/**
 * CustomerResponse — returned by create, update, verify-kyc, deactivate, search.
 * Contains all request fields plus system-managed read-only fields.
 * PII is masked per RBI IT Governance §8.5.
 */
export interface CustomerResponse extends Omit<CreateCustomerRequest, 'panNumber' | 'aadhaarNumber' | 'mobileNumber'> {
  // System-managed (read-only)
  id: number;
  customerNumber: string;
  fullName: string;
  active: boolean;
  branchCode: string;
  createdAt: string;
  // KYC system fields
  kycVerified: boolean;
  kycExpiryDate?: string;
  rekycDue: boolean;
  ckycStatus?: string;
  ckycNumber?: string;
  videoKycDone: boolean;
  // Group / RM
  customerGroupId?: number;
  customerGroupName?: string;
  relationshipManagerId?: string;
  // PII masked (§4 Masking)
  maskedPan?: string;
  maskedAadhaar?: string;
  maskedMobile?: string;
}

/* ── CIF Lookup Response — 30 fields per §5 ─────────────────────
 * This is the shape returned by GET /customers/{id}.
 * Already defined as CifCustomer in CifLookup.tsx — re-exported
 * from there for backward compat. This type exists for documentation
 * and for future screens that don't use the CifLookup widget. */

/* ── Error codes per §8 ─────────────────────────────────────────── */

export type CustomerErrorCode =
  | 'CUSTOMER_NOT_FOUND'
  | 'FIRST_NAME_REQUIRED'
  | 'LAST_NAME_REQUIRED'
  | 'INVALID_PAN_FORMAT'
  | 'DUPLICATE_PAN'
  | 'INVALID_AADHAAR_FORMAT'
  | 'INVALID_AADHAAR_CHECKSUM'
  | 'DUPLICATE_AADHAAR'
  | 'INVALID_MOBILE_FORMAT'
  | 'INVALID_PINCODE_FORMAT'
  | 'INVALID_EMAIL_FORMAT'
  | 'GENDER_REQUIRED'
  | 'INVALID_GENDER'
  | 'DOB_REQUIRED'
  | 'FATHER_NAME_REQUIRED'
  | 'MOTHER_NAME_REQUIRED'
  | 'BRANCH_NOT_FOUND'
  | 'IMMUTABLE_FIELD'
  | 'SELF_VERIFY_PROHIBITED'
  | 'INVALID_KYC_RISK_CATEGORY'
  | 'CONCURRENT_MODIFICATION'
  | 'CUSTOMER_HAS_ACTIVE_LOANS'
  | 'CUSTOMER_HAS_ACTIVE_DEPOSITS'
  | 'UNAUTHORIZED';
