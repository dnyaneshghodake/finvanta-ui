/**
 * Security module exports for CBS Banking Application
 * @file src/security/index.ts
 */

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
} from './roleGuard';
