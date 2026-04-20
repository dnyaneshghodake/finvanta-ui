/**
 * Administration domain module — co-located exports.
 * @file src/modules/admin/index.ts
 *
 * CBS domain-bounded module pattern: Groups all admin-provisioned
 * entities (operators, branches, holidays, tenants) under a single
 * import surface. All mutations are subject to maker-checker
 * governance on the backend.
 *
 * Usage:
 *   import { operatorService, branchService, type Operator, type Branch } from '@/modules/admin';
 */

// Types
export type {
  Operator, OperatorStatus,
  Branch, BranchStatus, BranchType,
  Holiday, HolidayType, HolidayScope,
  Tenant, TenantStatus,
} from '@/types/admin.types';

// Services
export {
  operatorService,
  branchService,
  holidayService,
  tenantService,
} from '@/services/api/adminService';
