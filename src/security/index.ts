/**
 * Security module exports for CBS Banking Application
 * @file src/security/index.ts
 */

export {
  hasRole,
  hasAllRoles,
  hasPermission,
  isMaker,
  isChecker,
  isHOAdmin,
  isAuditor,
  canApprove,
} from './roleGuard';
