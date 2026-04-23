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
import { findResponseSchema } from './schemas';

/**
 * CSRF cookie name. Must match the server-side CBS_CSRF_COOKIE env var
 * (see src/lib/server/env.ts:66). We expose it via NEXT_PUBLIC_CBS_CSRF_COOKIE
 * so the client-side reader stays in sync with the server-side writer.
 * Default: 'fv_csrf'.
 */
const CSRF_COOKIE_NAME = process.env.NEXT_PUBLIC_CBS_CSRF_COOKIE || 'fv_csrf';

/**
 * Read the double-submit CSRF token that the BFF set as a readable
 * cookie at login time. This value is echoed in the X-CSRF-Token
 * header on every mutating request so the BFF can compare it against
 * the copy inside the encrypted session blob.
 */
const readCsrfFromCookie = (): string | null => {
  if (typeof document === 'undefined') return null;
  const escaped = CSRF_COOKIE_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]+)`));
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
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};

/**
 * Browser API base URL — hardcoded to the Next.js BFF route prefix.
 *
 * This is NOT configurable via env vars. The browser MUST always talk
 * to the BFF at `/api/cbs/**` on the same origin. The BFF then
 * forwards to Spring with JWT, CSRF, branch/tenant headers injected
 * server-side. Any direct-to-Spring URL here would bypass every
 * security control (JWT containment, CSRF double-submit, branch
 * injection, correlation-id propagation).
 *
 * The BFF route prefix `/api/cbs` is a compile-time architectural
 * constant — it matches the Next.js App Router directory structure
 * at `app/api/cbs/`. Changing it requires moving the route files.
 */
const BFF_BASE_URL = '/api/cbs';

const apiClient: AxiosInstance = axios.create({
  baseURL: BFF_BASE_URL,
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
    // X-Correlation-Id (seeded by proxy.ts) that survives retries.
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

    // Contract validation — see src/services/api/schemas/index.ts.
    // For registered endpoints, the Spring envelope MUST satisfy the
    // corresponding Zod schema. A mismatch fails closed: the UI sees
    // a normalised AppError('CONTRACT_MISMATCH') instead of a
    // maliciously or accidentally mis-shaped payload.
    try {
      const method = (config.method || 'get').toUpperCase();
      const url = config.url || '';
      const rule = findResponseSchema(method, url);
      if (rule) {
        const parsed = rule.schema.safeParse(response.data);
        if (!parsed.success) {
          logger.error(`[CONTRACT_MISMATCH] ${rule.name} ${method} ${url}`, {
            issues: parsed.error.issues.slice(0, 10),
          });
          throw new AppError(
            'CONTRACT_MISMATCH',
            'The banking server returned an unexpected response. Please retry; contact IT support if the issue persists.',
            502,
          );
        }
      }
    } catch (err) {
      if (err instanceof AppError) {
        return Promise.reject(err);
      }
      // Never let a validator exception leak as a 2xx.
      logger.error('[CONTRACT_VALIDATOR_ERROR]', err);
      return Promise.reject(
        new AppError(
          'CONTRACT_VALIDATOR_ERROR',
          'Response validation failed unexpectedly.',
          500,
        ),
      );
    }

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
    // Per LOGIN_API_RESPONSE_CONTRACT, specific errorCodes get
    // targeted redirect reasons so the login page shows the right
    // message.
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        const errorCode = (error.response?.data as Record<string, unknown>)?.errorCode;
        let reason = 'session_expired';
        if (errorCode === 'REFRESH_TOKEN_REUSED') reason = 'session_compromised';
        else if (errorCode === 'ACCOUNT_INVALID') reason = 'account_invalid';
        window.location.href = `/login?reason=${reason}`;
      }
      return Promise.reject(appError);
    }

    // 503 from the BFF means the Spring backend is down or unreachable.
    // The BFF proxy returns structured { errorCode: "BACKEND_UNREACHABLE" }
    // per REST_API_COMPLETE_CATALOGUE §Actuator. We surface this clearly
    // so operators know it's a backend issue, not their session.
    if (error.response?.status === 503) {
      const errorCode = (error.response?.data as Record<string, unknown>)?.errorCode;
      const msg = (error.response?.data as Record<string, unknown>)?.message;
      const corr = error.response?.headers?.['x-correlation-id'];
      return Promise.reject(new AppError(
        typeof errorCode === 'string' ? errorCode : 'BACKEND_UNAVAILABLE',
        typeof msg === 'string' ? msg : 'The banking server is temporarily unavailable. Please try again shortly.',
        503,
        undefined,
        typeof corr === 'string' ? corr : undefined,
      ));
    }

    // Handle 429 Too Many Requests - Exponential backoff with max retries.
    //
    // FINANCIAL SAFETY: only retry safe (idempotent) methods automatically.
    // Retrying a POST/PUT/PATCH/DELETE after rate-limiting could double-post
    // a financial transaction if the caller did not set an idempotency key.
    // The BFF proxy generates a server-side fallback key for POSTs that
    // arrive without one (src/lib/server/proxy.ts:306-308), but that key
    // is per-request — a retry from the client would mint a NEW request
    // with a NEW fallback key, bypassing server-side dedup. Only retry
    // mutating calls when the caller explicitly provided X-Idempotency-Key
    // (proving they intended retry-safety). Safe methods (GET/HEAD/OPTIONS)
    // are always retryable.
    //
    // Per RBI IT Governance 2023 §8.2: financial operations must never
    // double-post due to automatic retry mechanisms.
    if (error.response?.status === 429) {
      const method = (config?.method || 'get').toLowerCase();
      const isSafeMethod = SAFE_METHODS.has(method);
      const hasIdempotencyKey = !!config?.headers?.['X-Idempotency-Key'];

      if (!isSafeMethod && !hasIdempotencyKey) {
        logger.warn(
          `Rate limited on mutating ${method.toUpperCase()} without X-Idempotency-Key — not retrying to prevent double-post`,
        );
        return Promise.reject(appError);
      }

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
