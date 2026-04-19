/**
 * Constants for CBS Banking Application
 * @file src/constants/index.ts
 */

/**
 * Account types
 */
export const ACCOUNT_TYPES = {
  SAVINGS: 'SAVINGS',
  CURRENT: 'CURRENT',
  SALARY: 'SALARY',
} as const;

/**
 * Transaction types
 */
export const TRANSACTION_TYPES = {
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
  TRANSFER: 'TRANSFER',
} as const;

/**
 * Transaction statuses
 */
export const TRANSACTION_STATUSES = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REVERSED: 'REVERSED',
} as const;

/**
 * Account statuses
 */
export const ACCOUNT_STATUSES = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  FROZEN: 'FROZEN',
  CLOSED: 'CLOSED',
} as const;

/**
 * KYC statuses
 */
export const KYC_STATUSES = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const;

/**
 * AML statuses
 */
export const AML_STATUSES = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  FLAGGED: 'FLAGGED',
  REJECTED: 'REJECTED',
} as const;

/**
 * Alert types
 */
export const ALERT_TYPES = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  SUCCESS: 'SUCCESS',
} as const;

/**
 * Pagination defaults
 */
export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

/**
 * API timeout in milliseconds
 */
export const API_TIMEOUT = parseInt(process.env.API_TIMEOUT || '30000', 10);

/**
 * API retry attempts
 */
export const API_RETRY_ATTEMPTS = parseInt(process.env.API_RETRY_ATTEMPTS || '3', 10);

/**
 * Session TTL is controlled server-side by CBS_SESSION_TTL_SECONDS.
 * JWTs are held in the encrypted fv_sid HttpOnly cookie and never
 * exposed to the browser. These constants are retained only for
 * UI-side countdown display (e.g. session timeout warning) and must
 * NOT be used for any security decision.
 */
export const SESSION_DISPLAY_TTL_SECONDS = 28800; // 8 hours — mirrors CBS_SESSION_TTL_SECONDS default

/**
 * Storage keys.
 *
 * Token and refresh-token keys are intentionally absent — JWTs are
 * held server-side in the encrypted fv_sid HttpOnly cookie and must
 * never be stored in localStorage or sessionStorage. Only UI
 * preferences that carry no security sensitivity belong here.
 */
export const STORAGE_KEYS = {
  THEME: 'cbs_theme',
  LANGUAGE: 'cbs_language',
  LAST_LOGIN: 'cbs_last_login',
} as const;

/**
 * Validation patterns
 */
export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^[6-9]\d{9}$/,
  PAN: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  AADHAR: /^\d{12}$/,
  IFSC: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  ACCOUNT_NUMBER: /^[A-Z0-9][A-Z0-9-]{5,24}$/,
  URL: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
} as const;

/**
 * Password policy
 */
export const PASSWORD_POLICY = {
  MIN_LENGTH: 8,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBER: true,
  REQUIRE_SPECIAL_CHAR: true,
} as const;

/**
 * Transaction limits
 */
export const TRANSACTION_LIMITS = {
  MIN_AMOUNT: 1,
  MAX_AMOUNT: 100000000, // 10 crore
  DAILY_LIMIT: 500000, // 5 lakhs per day
  MONTHLY_LIMIT: 5000000, // 50 lakhs per month
} as const;

/**
 * Response codes
 */
export const RESPONSE_CODES = {
  SUCCESS: 'SUCCESS',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

/**
 * HTTP status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Feature flags
 */
export const FEATURE_FLAGS = {
  ENABLE_MFA: process.env.NEXT_PUBLIC_ENABLE_MFA === 'true',
  ENABLE_BIOMETRIC: process.env.NEXT_PUBLIC_ENABLE_BIOMETRIC === 'true',
  ENABLE_REAL_TIME_UPDATE: process.env.NEXT_PUBLIC_ENABLE_REAL_TIME_UPDATE === 'true',
} as const;

/**
 * Date formats
 */
export const DATE_FORMATS = {
  DATE: 'dd/MM/yyyy',
  TIME: 'HH:mm:ss',
  DATE_TIME: 'dd/MM/yyyy HH:mm:ss',
  ISO: "yyyy-MM-dd'T'HH:mm:ss.SSSxxx",
} as const;
