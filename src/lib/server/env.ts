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

  cached = {
    // Spring server root only -- no trailing path. The BFF appends
    // `/api/v1/<resource>` to reach the Spring REST surface.
    // Auth and all other endpoints use the `/api/v1/` prefix.
    backendBaseUrl:
      process.env.CBS_BACKEND_URL || "http://localhost:8080",
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
