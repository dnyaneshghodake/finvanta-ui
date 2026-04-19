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
 */
export const hasPermission = (permission: string): boolean => {
  const user = useAuthStore.getState().user;
  if (!user || !user.permissions) return false;
  return user.permissions.includes(permission);
};

/**
 * Check if user is a maker (can create/submit records).
 */
export const isMaker = (): boolean => hasRole('MAKER', 'TELLER', 'OFFICER');

/**
 * Check if user is a checker (can verify/approve records).
 */
export const isChecker = (): boolean => hasRole('CHECKER', 'MANAGER', 'APPROVER');

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
