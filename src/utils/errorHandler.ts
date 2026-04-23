/**
 * Error handler utility for CBS Banking Application
 * @file src/utils/errorHandler.ts
 */

import { ApiResponse } from '@/types/api';
import { logger } from './logger';

/**
 * Custom application error
 */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, string>,
    /**
     * X-Correlation-Id from the BFF response headers (when available).
     * Preserved through the interceptor so UI error alerts can render
     * it via <CorrelationRefBadge /> per DESIGN_SYSTEM §16b — operators
     * quote this reference to IT support for trace lookup in Loki/Tempo.
     */
    public correlationId?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Error handler class
 */
class ErrorHandler {
  /**
   * Handle API errors and return user-friendly messages
   */
  handleApiError(error: unknown): AppError {
    const err = error as {
      response?: {
        status: number;
        headers?: Record<string, string | undefined>;
        data?: { error?: { code?: string; message?: string; details?: Record<string, string> } };
      };
      request?: unknown;
      code?: string;
      message?: string;
    };
    logger.error('API Error occurred', error);

    // Handle axios error
    if (err.response) {
      const { status, data, headers } = err.response;
      // Axios lower-cases response header names; the BFF (proxy.ts)
      // always emits `x-correlation-id` on every response, success or
      // failure, so we capture it here for the UI's <CorrelationRefBadge />.
      const correlationId =
        typeof headers?.['x-correlation-id'] === 'string'
          ? (headers['x-correlation-id'] as string)
          : undefined;

      if (data?.error) {
        return new AppError(
          data.error.code || 'UNKNOWN_ERROR',
          data.error.message || 'An error occurred',
          status,
          data.error.details,
          correlationId,
        );
      }

      // Handle common HTTP errors with CBS-specific messages.
      const errorMessages: Record<number, string> = {
        400: 'Invalid request. Please check your input.',
        401: 'Session expired. Please sign in again.',
        403: 'Access denied. You do not have permission for this action.',
        404: 'The requested resource was not found.',
        409: 'This record has been modified by another user. Please refresh and try again.',
        422: 'Validation failed. Please correct the highlighted fields.',
        428: 'Additional verification is required to complete this action.',
        429: 'Too many requests. Please wait a moment and try again.',
        500: 'An internal server error occurred. Please try again or contact IT support.',
        502: 'The banking server returned an invalid response. Please retry.',
        503: 'The banking server is temporarily unavailable. Please try again shortly.',
      };

      return new AppError(
        `HTTP_${status}`,
        errorMessages[status] || 'An error occurred',
        status,
        undefined,
        correlationId,
      );
    }

    // Handle network error — backend unreachable or browser offline.
    // Tier-1 CBS: operator must see a clear, actionable message so
    // they can distinguish "backend down" from "my network is bad".
    if (err.request && !err.response) {
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      return new AppError(
        isOffline ? 'OFFLINE' : 'BACKEND_UNREACHABLE',
        isOffline
          ? 'Your device appears to be offline. Please check your network connection and try again.'
          : 'The banking server is not responding. This may be a temporary outage — please wait a moment and retry. If the problem persists, contact IT support.',
        0,
      );
    }

    // Handle timeout
    if (err.code === 'ECONNABORTED') {
      return new AppError(
        'TIMEOUT_ERROR',
        'The request timed out. The server may be under heavy load — please wait a moment and retry.',
        408,
      );
    }

    // Handle unknown error
    return new AppError(
      'UNKNOWN_ERROR',
      err.message || 'An unexpected error occurred',
      500
    );
  }

  /**
   * Format error for logging
   */
  formatErrorLog(error: AppError | Error): Record<string, unknown> {
    if (error instanceof AppError) {
      return {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        details: error.details,
      };
    }

    return {
      message: error.message,
      stack: error.stack,
    };
  }

  /**
   * Show error notification to user
   */
  showNotification(options: {
    type: 'error' | 'success' | 'warning' | 'info';
    title: string;
    message?: string;
  }): void {
    // This will be handled by a toast/notification service
    logger.warn(`[${options.type.toUpperCase()}] ${options.title}`, options.message);
  }

  /**
   * Retry failed request with exponential backoff
   */
  async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (i < maxRetries - 1) {
          const delay = initialDelay * Math.pow(2, i);
          logger.warn(`Retry attempt ${i + 1} after ${delay}ms`, lastError.message);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Validate API response
   */
  validateResponse<T>(response: unknown): ApiResponse<T> {
    if (!response || typeof response !== 'object') {
      throw new AppError('INVALID_RESPONSE', 'Invalid response format', 500);
    }
    const r = response as {
      success?: boolean;
      error?: { code: string; message: string; statusCode: number; details?: Record<string, string> };
    };
    if (r.success === false && r.error) {
      throw new AppError(
        r.error.code,
        r.error.message,
        r.error.statusCode,
        r.error.details
      );
    }

    return response as ApiResponse<T>;
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(error: AppError | Error): string {
    if (error instanceof AppError) {
      return error.message;
    }
    return 'An unexpected error occurred. Please try again.';
  }
}

export const errorHandler = new ErrorHandler();
