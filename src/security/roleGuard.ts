/**
 * Role-based access control utilities for CBS Banking Application
 * @file src/security/roleGuard.ts
 *
 * Zero Trust principle: these utilities only control UI visibility.
 * The backend MUST independently verify roles/permissions on every request.
 * Never trust client-side role checks for authorization.
 */

import { UserRole } from '@/types/entities';
import { useAuthStore } from '@/store/authStore';

/**
 * Check if the current user has ANY of the specified roles.
 */
export const hasRole = (...requiredRoles: UserRole[]): boolean => {
  const user = useAuthStore.getState().user;
  if (!user || !user.roles) return false;
  return requiredRoles.some((role) => user.roles.includes(role));
};

/**
 * Check if the current user has ALL of the specified roles.
 */
export const hasAllRoles = (...requiredRoles: UserRole[]): boolean => {
  const user = useAuthStore.getState().user;
  if (!user || !user.roles) return false;
  return requiredRoles.every((role) => user.roles.includes(role));
};

/**
 * Check if the current user has a specific permission string.
 * Searches both the flat `permissions[]` array and the structured
 * `permissionsByModule` map from the new Spring login response.
 */
export const hasPermission = (permission: string): boolean => {
  const user = useAuthStore.getState().user;
  if (!user) return false;
  // Check flat permissions array first (legacy + derived)
  if (user.permissions?.includes(permission)) return true;
  // Check structured permissionsByModule map
  if (user.permissionsByModule) {
    return Object.values(user.permissionsByModule)
      .some((perms) => perms.includes(permission));
  }
  return false;
};

/**
 * Check if the current user has access to a specific CBS module.
 * Uses `allowedModules[]` from the new Spring login response.
 *
 * FAIL-CLOSED: when `allowedModules` is absent (bootstrap failed,
 * legacy login response), we return false. This is the Zero Trust
 * default — the backend gates independently, but the UI should not
 * show modules the operator may not be authorized for.
 *
 * CBS benchmark: Finacle's USRPRF and T24's EB.USER.CONTEXT both
 * fail-closed when the context service is unreachable.
 */
export const hasModuleAccess = (module: string): boolean => {
  const user = useAuthStore.getState().user;
  if (!user?.allowedModules || user.allowedModules.length === 0) return false;
  return user.allowedModules.includes(module);
};

/**
 * Check if user is a maker (can create/submit records).
 * Checks both the role array and the makerCheckerRole field.
 *
 * Per API_REFERENCE.md §2.1, makerCheckerRole values are:
 *   MAKER, CHECKER, BOTH, VIEWER
 * "BOTH" means the operator can act as either maker or checker
 * (but never on the same record — self-approval is still blocked).
 */
export const isMaker = (): boolean => {
  const user = useAuthStore.getState().user;
  if (user?.makerCheckerRole === 'MAKER' || user?.makerCheckerRole === 'BOTH') return true;
  return hasRole('MAKER', 'TELLER', 'OFFICER');
};

/**
 * Check if user is a checker (can verify/approve records).
 * Checks both the role array and the makerCheckerRole field.
 *
 * Per API_REFERENCE.md §2.1, "BOTH" grants checker capability too.
 */
export const isChecker = (): boolean => {
  const user = useAuthStore.getState().user;
  if (user?.makerCheckerRole === 'CHECKER' || user?.makerCheckerRole === 'BOTH') return true;
  return hasRole('CHECKER', 'MANAGER', 'APPROVER');
};

/**
 * Check if user is HO admin (head office admin — can see all branches).
 */
export const isHOAdmin = (): boolean => hasRole('ADMIN_HO');

/**
 * Check if user is an auditor (read-only access to audit trails).
 */
export const isAuditor = (): boolean => hasRole('AUDITOR');

/**
 * Self-approval prevention: check if user can approve a record
 * they did NOT create. Returns false if userId matches makerId,
 * or if the user's id is unknown (fail-safe: when we cannot
 * confirm the operator is a different person, hide the button).
 *
 * Tier-1 CBS requirement: maker and checker must be different users.
 * The backend is the authoritative gate — this is UI-only.
 */
export const canApprove = (makerId: string): boolean => {
  const user = useAuthStore.getState().user;
  if (!user) return false;
  // Fail-safe: if we don't know the operator's id we cannot confirm
  // they are a different person from the maker. Hide the button and
  // let the backend reject if they attempt via an API call.
  if (!user.id) return false;
  // Coerce to string before comparing: Spring returns user.id as a
  // number (Long), but makerId from workflow JSON is always a string.
  // Strict equality (===) between number and string silently passes,
  // defeating the self-approval gate.
  if (String(user.id) === String(makerId)) return false; // Self-approval blocked
  return isChecker();
};
