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
  id?: string;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  roles: string[];
  permissions?: string[];
  branchCode?: string;
  branchName?: string;
  tenantId?: string;
  mfaEnrolled?: boolean;
}

export interface CbsSession {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt: number;
  user: CbsSessionUser;
  csrfToken: string;
  mfaVerifiedAt?: number;
  issuedAt: number;
  correlationId?: string;
  /**
   * Server-authoritative business date in ISO format (YYYY-MM-DD).
   * Populated from Spring DayOpenService at login; falls back to
   * server clock date when the backend does not supply it.
   * The Header chrome bar reads this — never `new Date()` on the
   * client — because the CBS business date can differ from the
   * calendar date (e.g. after midnight before day-close).
   */
  businessDate?: string;
}

export async function readSession(): Promise<CbsSession | null> {
  const env = serverEnv();
  const jar = await cookies();
  const sid = jar.get(env.sessionCookieName)?.value;
  if (!sid) return null;
  const session = decryptSession<CbsSession>(sid);
  if (!session) return null;
  if (session.expiresAt && session.expiresAt < Date.now()) return null;
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
