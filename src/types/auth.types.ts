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
 * Authentication token entity (legacy — kept for backward compat).
 */
export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  businessDate?: string;
  user?: User;
}

// ── API_LOGIN_CONTRACT.md §12 TypeScript Interfaces ──────────────

/**
 * Login response (200 from /auth/token or /auth/mfa/verify).
 * Per API_LOGIN_CONTRACT.md §12: identity + tokens ONLY.
 * Operational context comes from GET /context/bootstrap.
 */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  /** Unix epoch seconds — schedule proactive refresh at expiresAt - 60. */
  expiresAt: number;
  user: {
    userId: number;
    username: string;
    displayName: string;
    role: 'MAKER' | 'CHECKER' | 'ADMIN' | 'AUDITOR';
    branchCode: string | null;
    authenticationLevel: 'PASSWORD' | 'MFA';
    mfaEnabled: boolean;
  };
}

/**
 * Bootstrap context (200 from GET /context/bootstrap).
 * Per API_LOGIN_CONTRACT.md §7 and §12.
 */
export interface LoginSessionContext {
  token: null;
  user: {
    userId: number;
    username: string;
    displayName: string;
    authenticationLevel: 'SESSION';
    loginTimestamp: string;
    lastLoginTimestamp: string | null;
    passwordExpiryDate: string | null;
    mfaEnabled: boolean;
  };
  branch: {
    branchId: number;
    branchCode: string;
    branchName: string;
    ifscCode: string | null;
    branchType: 'HEAD_OFFICE' | 'ZONAL_OFFICE' | 'REGIONAL_OFFICE' | 'BRANCH';
    zoneCode: string | null;
    regionCode: string | null;
    headOffice: boolean;
  } | null;
  businessDay: {
    businessDate: string | null;
    dayStatus: 'DAY_OPEN' | 'EOD_RUNNING' | 'DAY_CLOSED' | 'NOT_OPENED';
    isHoliday: boolean;
    previousBusinessDate: string | null;
    nextBusinessDate: string | null;
  } | null;
  role: {
    role: 'MAKER' | 'CHECKER' | 'ADMIN' | 'AUDITOR';
    makerCheckerRole: 'MAKER' | 'CHECKER' | 'BOTH' | 'VIEWER';
    permissionsByModule: Record<string, string[]>;
    allowedModules: string[];
  };
  limits: {
    transactionLimits: Array<{
      transactionType: string;
      channel: string | null;
      perTransactionLimit: number | null;
      dailyAggregateLimit: number | null;
    }>;
  };
  operationalConfig: {
    baseCurrency: string;
    decimalPrecision: number;
    roundingMode: string;
    fiscalYearStartMonth: number;
    businessDayPolicy: string;
  };
}

/**
 * Token refresh response (200 from /auth/refresh).
 * Per API_LOGIN_CONTRACT.md §6 and §12: bare token pair, no user.
 */
export interface TokenRefreshResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresAt: number;
}

/**
 * MFA challenge response (428 from /auth/token).
 * Per API_LOGIN_CONTRACT.md §4 and §12.
 */
export interface MfaChallengeResponse {
  status: 'ERROR';
  errorCode: 'MFA_REQUIRED';
  message: string;
  data: {
    challengeId: string;
    channel: 'TOTP';
  };
  timestamp: string;
}

/**
 * All auth error codes per API_LOGIN_CONTRACT.md §8.
 */
export type AuthErrorCode =
  | 'AUTH_FAILED'
  | 'ACCOUNT_DISABLED'
  | 'ACCOUNT_LOCKED'
  | 'PASSWORD_EXPIRED'
  | 'MFA_REQUIRED'
  | 'INVALID_MFA_CHALLENGE'
  | 'MFA_CHALLENGE_REUSED'
  | 'MFA_VERIFICATION_FAILED'
  | 'ACCOUNT_INVALID'
  | 'INVALID_REFRESH_TOKEN'
  | 'NOT_REFRESH_TOKEN'
  | 'REFRESH_TOKEN_REUSED'
  | 'LEGACY_REFRESH_TOKEN'
  | 'UNAUTHORIZED'
  | 'VALIDATION_FAILED'
  | 'MISSING_TENANT_ID'
  | 'INVALID_TENANT_ID'
  | 'INTERNAL_ERROR';
