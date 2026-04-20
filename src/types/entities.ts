/**
 * Core entity types for CBS Banking Application.
 * @file src/types/entities.ts
 *
 * BACKWARD COMPATIBILITY barrel — re-exports all types from their
 * domain-bounded modules so existing `import { X } from '@/types/entities'`
 * statements continue to work without modification.
 *
 * New code should import from the domain-specific files directly:
 *   import type { User, UserRole } from '@/types/auth.types';
 *   import type { Account, Transaction } from '@/types/deposits.types';
 *   import type { Operator, Branch } from '@/types/admin.types';
 *   import type { Address, Alert } from '@/types/common.types';
 */

// Auth domain
export type { User, UserRole, AuthToken } from './auth.types';

// Deposits (CASA) domain
export type { Account, AccountType, AccountStatus, FreezeType, Transaction } from './deposits.types';

// Common / shared types
export type { Address, KYCStatus, AMLStatus, Alert, DashboardSummary, Beneficiary } from './common.types';

// Admin domain
export type {
  Operator, OperatorStatus,
  Branch, BranchStatus, BranchType,
  Holiday, HolidayType, HolidayScope,
  Tenant, TenantStatus,
} from './admin.types';
