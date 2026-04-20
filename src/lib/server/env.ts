/**
 * Server-only environment variable loader.
 *
 * We fail fast when a required secret is missing in production so the
 * deployment surface never silently falls back to insecure defaults.
 * Development loads sensible local defaults to keep the onboarding
 * loop short.
 */
import "server-only";

interface CbsServerEnv {
  backendBaseUrl: string;
  /**
   * Full API base including version prefix.
   * Computed as `${backendBaseUrl}${apiPrefix}`.
   * Example: "http://localhost:8080/api/v1"
   *
   * Auth routes append: `/auth/token`, `/auth/mfa/verify`, `/auth/refresh`
   * Proxy routes append: `/<resource>`
   */
  backendApiBase: string;
  sessionSecret: string;
  csrfSecret: string;
  sessionCookieName: string;
  csrfCookieName: string;
  mfaChallengeCookieName: string;
  sessionTtlSeconds: number;
  /** Idle extension window in seconds (default 15 min). Must match
   *  the client-side SESSION_TIMEOUT_MS in useSessionTimeout.ts. */
  sessionIdleExtensionSeconds: number;
  mfaChallengeTtlSeconds: number;
  defaultTenantId: string;
  isProduction: boolean;
}

function requireSecret(name: string, devDefault: string, isProd: boolean): string {
  const value = process.env[name];
  if (value && value.length >= 32) {
    return value;
  }
  if (isProd) {
    throw new Error(
      `${name} is not set or too short (must be at least 32 chars of entropy in production)`,
    );
  }
  return devDefault;
}

let cached: CbsServerEnv | null = null;

export function serverEnv(): CbsServerEnv {
  // In development, skip the cache so env var changes via HMR or
  // dotenv reloads are picked up without a full server restart.
  // In production the cache is safe (cold start, immutable env).
  if (cached !== null && process.env.NODE_ENV === "production") return cached;
  const isProduction = process.env.NODE_ENV === "production";

  const backendBaseUrl = (process.env.CBS_BACKEND_URL || "http://localhost:8080").replace(/\/+$/, "");
  // CBS_API_PREFIX controls the path between the server root and the
  // versioned REST surface. Default: "/api/v1" (Spring context-path + version).
  // If your Spring has no context-path, set CBS_API_PREFIX=/v1.
  // If your Spring serves at /api/v1, keep the default.
  const apiPrefix = (process.env.CBS_API_PREFIX || "/api/v1").replace(/\/+$/, "");

  cached = {
    backendBaseUrl,
    backendApiBase: `${backendBaseUrl}${apiPrefix}`,
    sessionSecret: requireSecret(
      "CBS_SESSION_SECRET",
      "dev-only-session-secret-at-least-32-characters-long",
      isProduction,
    ),
    csrfSecret: requireSecret(
      "CBS_CSRF_SECRET",
      "dev-only-csrf-secret-at-least-32-characters-long-x",
      isProduction,
    ),
    sessionCookieName: process.env.CBS_SESSION_COOKIE || "fv_sid",
    csrfCookieName: process.env.CBS_CSRF_COOKIE || "fv_csrf",
    mfaChallengeCookieName: process.env.CBS_MFA_COOKIE || "fv_mfa",
    sessionTtlSeconds: Number(
      process.env.CBS_SESSION_TTL_SECONDS || 60 * 60 * 8,
    ),
    sessionIdleExtensionSeconds: Number(
      process.env.CBS_SESSION_IDLE_SECONDS || 15 * 60,
    ),
    mfaChallengeTtlSeconds: Number(
      process.env.CBS_MFA_TTL_SECONDS || 5 * 60,
    ),
    defaultTenantId: process.env.CBS_DEFAULT_TENANT || "DEFAULT",
    isProduction,
  };
  return cached;
}
