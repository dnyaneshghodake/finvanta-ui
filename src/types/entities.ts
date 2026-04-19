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
  id?: string;
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
  tenantId?: string;
  roles: UserRole[];
  permissions?: string[];
  mfaEnrolled?: boolean;
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
  | 'VIEWER';

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
 * Authentication token entity
 */
export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
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
