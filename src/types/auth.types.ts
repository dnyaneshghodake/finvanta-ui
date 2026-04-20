/**
 * Authentication & operator identity types.
 * @file src/types/auth.types.ts
 *
 * Split from entities.ts per CBS domain-bounded module pattern.
 * Contains operator profile, roles, permissions, and auth tokens.
 */

/**
 * Authenticated operator profile as returned by the BFF session.
 *
 * This is NOT a full CIF customer record — it is the subset of the
 * Spring `UserDetails` / `CbsSessionUser` that the BFF materialises
 * into the encrypted fv_sid cookie and returns via /api/cbs/auth/me.
 */
export interface User {
  id?: string | number;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  dateOfBirth?: Date;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  address?: import('./common.types').Address;
  kycStatus?: import('./common.types').KYCStatus;
  amlStatus?: import('./common.types').AMLStatus;
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
  makerCheckerRole?: string;
  permissionsByModule?: Record<string, string[]>;
  permissions?: string[];
  allowedModules?: string[];
  displayName?: string;
  mfaEnrolled?: boolean;
  authenticationLevel?: string;
  lastLoginTimestamp?: string;
  passwordExpiryDate?: string;
}

/**
 * User role — determines UI visibility and action authorization.
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
 * Authentication token entity.
 */
export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  businessDate?: string;
  user?: User;
}
