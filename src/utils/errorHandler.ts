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
    public details?: Record<string, string>
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
      response?: { status: number; data?: { error?: { code?: string; message?: string; details?: Record<string, string> } } };
      request?: unknown;
      code?: string;
      message?: string;
    };
    logger.error('API Error occurred', error);

    // Handle axios error
    if (err.response) {
      const { status, data } = err.response;

      if (data?.error) {
        return new AppError(
          data.error.code || 'UNKNOWN_ERROR',
          data.error.message || 'An error occurred',
          status,
          data.error.details
        );
      }

      // Handle common HTTP errors
      const errorMessages: Record<number, string> = {
        400: 'Invalid request. Please check your input.',
        401: 'Unauthorized. Please log in again.',
        403: 'Access denied.',
        404: 'Resource not found.',
        409: 'Conflict. This resource already exists.',
        429: 'Too many requests. Please try again later.',
        500: 'Server error. Please try again later.',
        503: 'Service unavailable. Please try again later.',
      };

      return new AppError(
        `HTTP_${status}`,
        errorMessages[status] || 'An error occurred',
        status
      );
    }

    // Handle network error
    if (err.request && !err.response) {
      return new AppError(
        'NETWORK_ERROR',
        'Network error. Please check your connection.',
        0
      );
    }

    // Handle timeout
    if (err.code === 'ECONNABORTED') {
      return new AppError(
        'TIMEOUT_ERROR',
        'Request timeout. Please try again.',
        408
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
