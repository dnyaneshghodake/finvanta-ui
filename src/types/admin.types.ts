/**
 * Administration domain types — operators, branches, holidays, tenants.
 * @file src/types/admin.types.ts
 *
 * Split from entities.ts per CBS domain-bounded module pattern.
 * Contains all admin-provisioned entities under maker-checker governance.
 */

import type { UserRole } from './auth.types';

// ── Operator ───────────────────────────────────────────────────────

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

// ── Branch ─────────────────────────────────────────────────────────

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

// ── Holiday Calendar ───────────────────────────────────────────────

export type HolidayType = 'NATIONAL' | 'STATE' | 'RBI' | 'CUSTOM';
export type HolidayScope = 'ALL_BRANCHES' | 'STATE' | 'BRANCH';

export interface Holiday {
  id: number;
  date: string;
  name: string;
  type: HolidayType;
  scope: HolidayScope;
  stateCode?: string;
  branchCode?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Tenant ─────────────────────────────────────────────────────────

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
