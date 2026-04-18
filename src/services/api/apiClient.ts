/**
 * Axios API client with interceptors for CBS Banking Application
 * @file src/services/api/apiClient.ts
 */

import axios, {
  AxiosInstance,
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import { logger } from '@/utils/logger';
import { errorHandler, AppError } from '@/utils/errorHandler';

/**
 * Custom Axios config type
 */
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  _startTime?: number;
}

/**
 * Generate unique request ID for tracing
 */
const generateRequestId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Create Axios instance
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api',
  timeout: parseInt(process.env.API_TIMEOUT || '30000', 10),
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

/**
 * Request Interceptor
 */
apiClient.interceptors.request.use(
  (config: CustomAxiosRequestConfig) => {
    // Track request time
    config._startTime = Date.now();

    // Add JWT token from localStorage
    const token = typeof window !== 'undefined' ? localStorage.getItem('cbs_access_token') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add request ID for tracing
    config.headers['X-Request-ID'] = generateRequestId();

    // Add client version
    config.headers['X-Client-Version'] = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';

    logger.debug(`[REQUEST] ${config.method?.toUpperCase()} ${config.url}`, {
      params: config.params,
      headers: config.headers,
    });

    return config;
  },
  (error) => {
    logger.error('Request interceptor error', error);
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor
 */
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    const config = response.config as CustomAxiosRequestConfig;
    const duration = config._startTime ? Date.now() - config._startTime : 0;

    logger.info(`[RESPONSE] ${response.status} ${config.method?.toUpperCase()} ${config.url}`, {
      duration: `${duration}ms`,
      dataSize: JSON.stringify(response.data).length,
    });

    return response;
  },
  async (error: AxiosError) => {
    const config = error.config as CustomAxiosRequestConfig;
    const appError = errorHandler.handleApiError(error);

    logger.error(`[ERROR] ${error.response?.status} ${config?.method?.toUpperCase()} ${config?.url}`, {
      code: appError.code,
      message: appError.message,
      details: appError.details,
    });

    // Handle 401 Unauthorized - Token expired
    if (error.response?.status === 401 && !config?._retry) {
      config._retry = true;

      try {
        logger.warn('Token expired, attempting refresh...');
        
        // Attempt token refresh
        const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('cbs_refresh_token') : null;
        if (refreshToken) {
          const refreshResponse = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
            { refreshToken },
            { timeout: 10000 }
          );

          const { accessToken, refreshToken: newRefreshToken } = refreshResponse.data.data;
          
          if (typeof window !== 'undefined') {
            localStorage.setItem('cbs_access_token', accessToken);
            localStorage.setItem('cbs_refresh_token', newRefreshToken);
          }

          // Retry original request with new token
          config.headers.Authorization = `Bearer ${accessToken}`;
          return apiClient(config);
        }
      } catch (refreshError) {
        logger.error('Token refresh failed', refreshError);
        
        // Clear auth data and redirect to login
        if (typeof window !== 'undefined') {
          localStorage.removeItem('cbs_access_token');
          localStorage.removeItem('cbs_refresh_token');
          localStorage.removeItem('cbs_user');
          window.location.href = '/login';
        }
      }
    }

    // Handle 429 Too Many Requests - Exponential backoff
    if (error.response?.status === 429) {
      const retryAfter = parseInt(error.response.headers['retry-after'] || '5', 10);
      logger.warn(`Rate limited. Retrying after ${retryAfter}s`);
      
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return apiClient(config);
    }

    return Promise.reject(appError);
  }
);

export { apiClient, AppError };
