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
import { useAuthStore } from '@/store/authStore';

/**
 * Read the double-submit CSRF token that the BFF set as a readable
 * cookie (fv_csrf) at login time. This value is echoed in the
 * X-CSRF-Token header on every mutating request so the BFF can
 * compare it against the copy inside the encrypted session blob.
 */
const readCsrfFromCookie = (): string | null => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)fv_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

const SAFE_METHODS = new Set(['get', 'head', 'options']);

/**
 * Custom Axios config type
 */
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  _retryCount?: number;
  _startTime?: number;
}

/**
 * Maximum number of retries for 429 rate-limit responses
 */
const MAX_RATE_LIMIT_RETRIES = 3;

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
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api/cbs',
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

    // JWT is held server-side in the BFF session. The browser sends
    // its HttpOnly fv_sid cookie automatically via withCredentials.

    // Per-request id for UI-side logging; the BFF generates its own
    // X-Correlation-Id (seeded by middleware.ts) that survives retries.
    config.headers['X-Request-ID'] = generateRequestId();
    config.headers['X-Client-Version'] = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';

    // Double-submit CSRF on mutating calls.
    const method = (config.method || 'get').toLowerCase();
    if (!SAFE_METHODS.has(method)) {
      const csrf = readCsrfFromCookie() ?? useAuthStore.getState().csrfToken;
      if (csrf) config.headers['X-CSRF-Token'] = csrf;
      // Idempotency-Key is NOT auto-generated here. Auto-generating a
      // fresh key per request defeats de-duplication: a double-click
      // would produce two distinct keys and two postings. Financial
      // callers (transferService.confirm) must mint a stable key at
      // the point of the first "Confirm" click and pass it via
      // headers['X-Idempotency-Key']. The BFF proxy generates a
      // server-side fallback key for calls that arrive without one
      // (src/lib/server/proxy.ts:131-133), which protects against
      // network-level retries but not against application-level
      // double-submits — that is the caller's responsibility.
    }

    // Branch / tenant context is injected server-side by the Next.js BFF
    // from the HttpOnly session cookie. The browser never sets X-Branch-Code
    // or X-Tenant-ID itself — see app/api/cbs/[...path]/route.ts and
    // src/lib/server/proxy.ts. A client-side value here would simply be
    // overwritten by the BFF.

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

    // 401 from the BFF means the session cookie is gone or expired.
    // We do not attempt a client-side refresh (JWTs are held server
    // side); we just clear local state and send the user to /login.
    // Early return prevents callers from showing a flash of error UI
    // (toast, inline message) in the brief window before the browser
    // navigates away.
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login?reason=session_expired';
      }
      return Promise.reject(appError);
    }

    // Handle 429 Too Many Requests - Exponential backoff with max retries
    if (error.response?.status === 429) {
      const retryCount = (config._retryCount || 0) + 1;
      if (retryCount > MAX_RATE_LIMIT_RETRIES) {
        logger.error('Max rate-limit retries exceeded');
        return Promise.reject(appError);
      }
      config._retryCount = retryCount;

      const retryAfter = parseInt(error.response.headers['retry-after'] || '5', 10);
      logger.warn(`Rate limited. Retry ${retryCount}/${MAX_RATE_LIMIT_RETRIES} after ${retryAfter}s`);
      
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return apiClient(config);
    }

    return Promise.reject(appError);
  }
);

export { apiClient, AppError };
