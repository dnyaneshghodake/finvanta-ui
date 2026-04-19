/**
 * Core entity types for CBS Banking Application
 * @file src/types/entities.ts
 */

/**
 * Authenticated operator profile as returned by the BFF session.
 *
 * This is NOT a full CIF customer record — it is the subset of the
 * Spring `UserDetails` / `CbsSessionUser` that the BFF materialises
 * into the encrypted fv_sid cookie and returns via /api/cbs/auth/me.
 * Most fields are optional because the Spring auth response may only
 * include {username, roles} for service accounts or freshly-seeded
 * dev users.
 *
 * CBS-critical fields:
 * - branchCode: assigned at login, injected into every API request
 * - tenantId: multi-tenant isolation key
 * - roles: used for role-based UI rendering and route guards
 * - permissions: field-level permission enforcement
 */
export interface User {
  /** Database user ID — Spring returns Long (number). */
  id?: string | number;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  dateOfBirth?: Date;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  address?: Address;
  kycStatus?: KYCStatus;
  amlStatus?: AMLStatus;
  createdAt?: Date;
  updatedAt?: Date;
  lastLogin?: Date | null;

  // CBS-specific fields
  branchCode?: string;
  branchName?: string;
  branchId?: number;
  ifscCode?: string;
  branchType?: string;
  zoneCode?: string;
  regionCode?: string;
  isHeadOffice?: boolean;
  tenantId?: string;
  roles: UserRole[];
  /** Maker-checker role (e.g. "MAKER", "CHECKER"). */
  makerCheckerRole?: string;
  /** Module → permission[] map from Spring `data.role.permissionsByModule`. */
  permissionsByModule?: Record<string, string[]>;
  /** Flat permission list (derived from permissionsByModule). */
  permissions?: string[];
  /** Modules the operator is authorised to access. */
  allowedModules?: string[];
  /** Computed by Spring: `data.user.displayName`. */
  displayName?: string;
  mfaEnrolled?: boolean;
  authenticationLevel?: string;
  lastLoginTimestamp?: string;
  passwordExpiryDate?: string;
}

/**
 * User role — determines UI visibility and action authorization.
 * The backend is the source of truth; UI only renders based on these.
 */
export type UserRole =
  | 'TELLER'
  | 'OFFICER'
  | 'MANAGER'
  | 'BRANCH_ADMIN'
  | 'ADMIN_HO'
  | 'AUDITOR'
  | 'MAKER'
  | 'CHECKER'
  | 'APPROVER'
  | 'VIEWER'
  | 'RECONCILER'
  | 'ADMIN';

/**
 * Bank account entity
 */
export interface Account {
  id: string;
  accountNumber: string;
  customerId: string;
  accountType: 'SAVINGS' | 'CURRENT' | 'SALARY';
  currency: string;
  balance: number;
  availableBalance: number;
  status: 'ACTIVE' | 'INACTIVE' | 'FROZEN' | 'CLOSED';
  openedDate: Date;
  closedDate: Date | null;
  linkedAccounts: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Transaction entity
 */
export interface Transaction {
  id: string;
  transactionId: string;
  accountId: string;
  fromAccount?: string;
  toAccount?: string;
  amount: number;
  currency: string;
  transactionType: 'DEBIT' | 'CREDIT' | 'TRANSFER';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
  description: string;
  valueDate: Date;
  postingDate: Date;
  referenceNumber: string;
  beneficiaryName?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Address entity
 */
export interface Address {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  type: 'RESIDENTIAL' | 'OFFICE' | 'MAILING';
}

/**
 * KYC status enumeration
 */
export type KYCStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

/**
 * AML status enumeration
 */
export type AMLStatus = 'PENDING' | 'APPROVED' | 'FLAGGED' | 'REJECTED';

/**
 * Beneficiary entity for fund transfers
 */
export interface Beneficiary {
  id: string;
  customerId: string;
  name: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  isInternal: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Authentication token entity.
 *
 * Per LOGIN_API_RESPONSE_CONTRACT §EnhancedTokenResponse, the Spring
 * auth endpoints return tokens + user profile + businessDate in a
 * single payload. The BFF holds the tokens server-side; the browser
 * only sees the user/businessDate subset via /api/cbs/auth/me.
 */
export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  /** Seconds until accessToken expires (e.g. 900 = 15 min). */
  expiresIn: number;
  /** CBS operational date (YYYY-MM-DD) from DayOpenService. */
  businessDate?: string;
  /** User profile included in the token response. */
  user?: User;
}

/**
 * Dashboard summary data
 */
export interface DashboardSummary {
  totalBalance: number;
  accountsCount: number;
  recentTransactions: Transaction[];
  alerts: Alert[];
}

/**
 * Alert entity for notifications
 */
export interface Alert {
  id: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

// ── Admin domain entities ──────────────────────────────────────────

/**
 * CBS operator account — provisioned by admins under maker-checker.
 * There is no self-registration per RBI IT Governance Direction 2023.
 */
export type OperatorStatus = 'ACTIVE' | 'LOCKED' | 'DISABLED' | 'PENDING_ACTIVATION';

export interface Operator {
  id: number;
  username: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string;
  roles: UserRole[];
  branchCode: string;
  branchName?: string;
  tenantId?: string;
  status: OperatorStatus;
  mfaEnrolled: boolean;
  lastLoginAt?: string;
  lastLoginIp?: string;
  failedAttempts: number;
  passwordChangedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * CBS branch (SOL — Service Outlet).
 */
export type BranchStatus = 'ACTIVE' | 'INACTIVE' | 'CLOSED';
export type BranchType = 'HEAD_OFFICE' | 'REGIONAL_OFFICE' | 'BRANCH' | 'EXTENSION_COUNTER';

export interface Branch {
  id: number;
  branchCode: string;
  branchName: string;
  ifscCode: string;
  city: string;
  state: string;
  pincode?: string;
  address?: string;
  type: BranchType;
  status: BranchStatus;
  tenantId?: string;
  managerName?: string;
  phone?: string;
  email?: string;
  openedDate?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * CBS holiday calendar entry.
 */
export type HolidayType = 'NATIONAL' | 'STATE' | 'RBI' | 'CUSTOM';
export type HolidayScope = 'ALL_BRANCHES' | 'STATE' | 'BRANCH';

export interface Holiday {
  id: number;
  date: string;
  name: string;
  type: HolidayType;
  scope: HolidayScope;
  /** Applicable state code when scope = STATE (e.g. "MH", "KA"). */
  stateCode?: string;
  /** Applicable branch code when scope = BRANCH. */
  branchCode?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * CBS tenant — top-level multi-tenant isolation boundary.
 */
export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'SETUP';

export interface Tenant {
  id: number;
  tenantId: string;
  tenantName: string;
  country: string;
  baseCurrency: string;
  regulatoryBody: string;
  licenseType: string;
  status: TenantStatus;
  financialYearStart: string;
  weekOffPattern: string;
  interestCalculation: string;
  decimalPrecision: number;
  amountRounding: string;
  piiEncryption: string;
  branchCount?: number;
  userCount?: number;
  createdAt: string;
  updatedAt: string;
}
