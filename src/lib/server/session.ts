/**
 * Server-side session store keyed on the HttpOnly fv_sid cookie.
 *
 * We intentionally do NOT store the JWT in localStorage or any other
 * browser-accessible slot. The Spring backend's JWT is held inside the
 * encrypted session blob (see ./crypto.ts) and re-attached by the BFF
 * proxy on every downstream call. A parallel JS-readable fv_csrf
 * cookie carries the double-submit token; the value is also embedded
 * in the session blob so forged fv_csrf values without a session are
 * rejected.
 */
import "server-only";
import { cookies } from "next/headers";
import { decryptSession, encryptSession, generateCsrfToken } from "./crypto";
import { serverEnv } from "./env";

export interface CbsSessionUser {
  /** Database user ID — Spring returns Long (number), stored as-is. */
  id?: string | number;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  /** Primary role from `data.role.role` (e.g. "MAKER"). */
  roles: string[];
  /** Maker-checker role from `data.role.makerCheckerRole`. */
  makerCheckerRole?: string;
  /**
   * Module → permission[] map from `data.role.permissionsByModule`.
   * E.g. { DEPOSIT: ["DEPOSIT_OPEN", ...], LOAN: ["LOAN_CREATE", ...] }
   */
  permissionsByModule?: Record<string, string[]>;
  /** Flat permission list (legacy compat — derived from permissionsByModule). */
  permissions?: string[];
  /** Modules the operator is authorised to access. */
  allowedModules?: string[];
  branchCode?: string;
  branchName?: string;
  branchId?: number;
  ifscCode?: string;
  branchType?: string;
  zoneCode?: string;
  regionCode?: string;
  isHeadOffice?: boolean;
  tenantId?: string;
  /** Computed by Spring: `data.user.displayName`. */
  displayName?: string;
  mfaEnrolled?: boolean;
  authenticationLevel?: string;
  lastLoginTimestamp?: string;
  passwordExpiryDate?: string;
}

/**
 * Business day context from `data.businessDay`.
 * Stored in the session so the Header and dashboard can read it
 * without an extra API call.
 */
export interface CbsBusinessDay {
  businessDate: string;
  dayStatus: string;
  isHoliday: boolean;
  previousBusinessDate?: string;
  nextBusinessDate?: string;
}

/**
 * Operator transaction limits from `data.limits.transactionLimits[]`.
 */
export interface CbsTransactionLimit {
  transactionType: string;
  channel: string | null;
  perTransactionLimit: number;
  dailyAggregateLimit: number;
}

/**
 * Operational config from `data.operationalConfig`.
 */
export interface CbsOperationalConfig {
  baseCurrency: string;
  decimalPrecision: number;
  roundingMode: string;
  fiscalYearStartMonth: number;
  businessDayPolicy: string;
}

export interface CbsSession {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt: number;
  /**
   * JWT expiry timestamp (epoch ms) — independent of session expiresAt.
   * Used by the BFF proxy to schedule proactive token refresh at
   * jwtExpiresAt - 60s. Without this, the sliding session window
   * masks the JWT expiry and the token is never refreshed.
   */
  jwtExpiresAt?: number;
  user: CbsSessionUser;
  csrfToken: string;
  mfaVerifiedAt?: number;
  issuedAt: number;
  correlationId?: string;
  /**
   * Server-authoritative business date in ISO format (YYYY-MM-DD).
   * Populated from Spring `data.businessDay.businessDate` at login;
   * falls back to server clock date when the backend does not supply it.
   */
  businessDate?: string;
  /** Full business day context from `data.businessDay`. */
  businessDay?: CbsBusinessDay;
  /** Operator transaction limits from `data.limits`. */
  transactionLimits?: CbsTransactionLimit[];
  /** Operational config from `data.operationalConfig`. */
  operationalConfig?: CbsOperationalConfig;
}

export async function readSession(): Promise<CbsSession | null> {
  const env = serverEnv();
  const jar = await cookies();
  const sid = jar.get(env.sessionCookieName)?.value;
  if (!sid) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[readSession] no fv_sid cookie found");
    }
    return null;
  }
  const session = decryptSession<CbsSession>(sid);
  if (!session) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[readSession] decrypt failed — cookie length=${sid.length}`);
    }
    return null;
  }
  if (session.expiresAt && session.expiresAt < Date.now()) {
    if (process.env.NODE_ENV !== "production") {
      const agoMs = Date.now() - session.expiresAt;
      console.warn(`[readSession] session expired ${agoMs}ms ago — expiresAt=${session.expiresAt} now=${Date.now()}`);
    }
    return null;
  }
  return session;
}

export async function writeSession(
  partial: Omit<CbsSession, "csrfToken" | "issuedAt"> & {
    csrfToken?: string;
    issuedAt?: number;
  },
): Promise<CbsSession> {
  const env = serverEnv();
  const jar = await cookies();
  const csrfToken = partial.csrfToken ?? generateCsrfToken();
  // Preserve the original `issuedAt` when callers (e.g. the session
  // extend route, MFA verify) pass it through. Resetting it on every
  // write would let users extend the session indefinitely and drift
  // the absolute TTL ceiling forward by the idle-extension amount on
  // each tick -- the exact invariant violation flagged by Devin
  // Review on PR #2.
  const session: CbsSession = {
    ...partial,
    csrfToken,
    issuedAt: partial.issuedAt ?? Date.now(),
  };
  const encrypted = encryptSession(session);
  const common = {
    path: "/",
    secure: env.isProduction,
    sameSite: "lax" as const,
  };
  jar.set(env.sessionCookieName, encrypted, {
    ...common,
    httpOnly: true,
    maxAge: env.sessionTtlSeconds,
  });
  jar.set(env.csrfCookieName, csrfToken, {
    ...common,
    httpOnly: false,
    maxAge: env.sessionTtlSeconds,
  });
  return session;
}

export async function clearSession(): Promise<void> {
  const env = serverEnv();
  const jar = await cookies();
  jar.delete(env.sessionCookieName);
  jar.delete(env.csrfCookieName);
  // Also clear the MFA challenge bridge cookie. If a user logs out
  // while an fv_mfa cookie is still alive (started MFA but abandoned),
  // the stale challengeId must not survive into a subsequent login
  // attempt — otherwise it could be consumed by a different user's
  // MFA verify step (session fixation vector).
  jar.delete(env.mfaChallengeCookieName);
}
