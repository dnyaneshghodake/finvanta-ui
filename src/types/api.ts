/**
 * API request and response types
 * @file src/types/api.ts
 */

/**
 * BFF → Browser response envelope.
 *
 * This is the shape returned by the Next.js BFF routes (e.g.
 * /api/cbs/auth/login, /api/cbs/auth/me) to the browser. It uses
 * `success: boolean` for easy discriminated-union checks on the client.
 *
 * NOTE: The Spring backend uses a different envelope:
 *   { status: "SUCCESS" | "ERROR", data, errorCode, message, timestamp }
 * The BFF translates Spring → BFF format in each route handler.
 * See LOGIN_API_RESPONSE_CONTRACT.md §Response Envelope Schema for
 * the canonical Spring shape.
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  /** Machine-readable error code (e.g. "INVALID_CREDENTIALS", "MFA_REQUIRED"). */
  errorCode?: string;
  /** Human-readable error message for display. */
  message?: string;
  timestamp?: string;
  requestId?: string;
  correlationId?: string;
}

/**
 * API error information
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string>;
  statusCode: number;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Pagination parameters for API requests
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Filter parameters for API requests
 */
export interface FilterParams {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Login request payload.
 *
 * CBS operators authenticate with a corporate User ID (not an email).
 * The `username` field accepts either a plain user ID (e.g. "maker1")
 * or an email address — the BFF forwards it to Spring's
 * `/api/v1/auth/token` as `username` regardless.
 */
export interface LoginRequest {
  username: string;
  password: string;
  rememberMe?: boolean;
}

// NOTE: PasswordResetRequest and PasswordResetConfirm types were
// intentionally removed. Tier-1 CBS platforms never expose a public
// "forgot password" flow — operator credential resets are admin-
// initiated maker-checker actions under User Management per RBI IT
// Governance Direction 2023 §8.

/**
 * Transfer request payload
 */
export interface TransferRequest {
  fromAccountId: string;
  toAccountNumber: string;
  toIfscCode: string;
  amount: number;
  description: string;
  transferType: 'INTERNAL' | 'EXTERNAL';
}

/**
 * API request configuration
 */
export interface ApiRequestConfig {
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  timeout?: number;
  retry?: boolean;
}
