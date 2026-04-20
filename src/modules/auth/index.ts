/**
 * Authentication domain module — co-located exports.
 * @file src/modules/auth/index.ts
 *
 * CBS domain-bounded module pattern: Groups auth types, services,
 * store, and security guards under a single import surface.
 *
 * Usage:
 *   import { authService, useAuthStore, hasRole, isMaker, type User } from '@/modules/auth';
 */

// Types
export type { User, UserRole, AuthToken } from '@/types/auth.types';

// Services
export { authService } from '@/services/api/authService';
export type {
  LoginBffResponse,
  MfaVerifyRequest,
  HeartbeatResponse,
  BusinessDay,
  OperationalConfig,
  TransactionLimit,
} from '@/services/api/authService';

// Store
export { useAuthStore } from '@/store/authStore';

// Security guards
export {
  hasRole,
  hasAllRoles,
  hasPermission,
  hasModuleAccess,
  isMaker,
  isChecker,
  isHOAdmin,
  isAuditor,
  canApprove,
} from '@/security/roleGuard';
