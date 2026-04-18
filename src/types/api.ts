/**
 * API request and response types
 * @file src/types/api.ts
 */

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  timestamp: string;
  requestId: string;
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
 * Login request payload
 */
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * Register request payload
 */
export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  password: string;
  dateOfBirth: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  agreeToTerms: boolean;
}

/**
 * Password reset request
 */
export interface PasswordResetRequest {
  email: string;
}

/**
 * Password reset confirmation
 */
export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

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
  params?: Record<string, any>;
  timeout?: number;
  retry?: boolean;
}
