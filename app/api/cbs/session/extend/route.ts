/**
 * Extend the session on explicit user action ("Stay logged in").
 *
 * Two things happen:
 *   1. If the session holds a refreshToken AND the JWT is within 20%
 *      of expiry, we call Spring `/api/v1/auth/refresh` to rotate the
 *      tokens (per LOGIN_API_RESPONSE_CONTRACT §Token Refresh Flow).
 *   2. The BFF cookie expiry is extended but never past the absolute
 *      TTL ceiling of CBS_SESSION_TTL_SECONDS.
 */
import { NextResponse, type NextRequest } from "next/server";
import { readCorrelationId } from "@/lib/server/correlation";
import { assertCsrf } from "@/lib/server/csrf";
import { serverEnv } from "@/lib/server/env";
import { readSession, writeSession } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const correlationId = readCorrelationId(req);
  const env = serverEnv();
  const session = await readSession();
  if (!session) {
    return NextResponse.json(
      { success: false, errorCode: "NO_SESSION", correlationId },
      { status: 401, headers: { "x-correlation-id": correlationId } },
    );
  }
  try {
    assertCsrf(req, session);
  } catch {
    return NextResponse.json(
      { success: false, errorCode: "CSRF_REJECTED", correlationId },
      { status: 403, headers: { "x-correlation-id": correlationId } },
    );
  }

  const now = Date.now();
  let accessToken = session.accessToken;
  let refreshToken = session.refreshToken;
  let tokenType = session.tokenType;
  let businessDate = session.businessDate;
  let sessionUser = session.user;

  // ── Proactive JWT refresh ──────────────────────────────────────
  // Per LOGIN_API_RESPONSE_CONTRACT §Token Refresh Flow: refresh the
  // JWT when it is within 20% of its lifetime remaining. The BFF
  // holds the refreshToken in the encrypted session blob and calls
  // Spring's /api/v1/auth/refresh to rotate both tokens silently.
  // On REFRESH_TOKEN_REUSED (token theft detection) we force-clear
  // the session and return 401 so the client redirects to /login.
  let sessionBusinessDay = session.businessDay;
  let sessionOpConfig = session.operationalConfig;
  let sessionTxnLimits = session.transactionLimits;
  let jwtExpiresAt = session.jwtExpiresAt;

  // Use jwtExpiresAt (JWT lifetime) for refresh scheduling, NOT session
  // expiresAt (idle timeout). The sliding session window continuously
  // extends expiresAt, making the old condition always false for active
  // users. jwtExpiresAt tracks the actual JWT expiry from Spring.
  //
  // For legacy sessions without jwtExpiresAt (created before this field
  // was added), fall back to issuedAt + 15min (default JWT lifetime).
  // Using session.expiresAt as fallback would never trigger because the
  // sliding window keeps it 30 min in the future.
  const jwtExpiry = session.jwtExpiresAt ?? (session.issuedAt + 15 * 60 * 1000);
  if (refreshToken && jwtExpiry - now < 60_000) {
    try {
      const upstream = await fetch(`${env.backendApiBase}/auth/refresh`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-correlation-id": correlationId,
          "x-tenant-id": session.user.tenantId || env.defaultTenantId,
        },
        body: JSON.stringify({ refreshToken }),
        cache: "no-store",
        // CRITICAL: do not follow redirects. Same rationale as the login
        // route (app/api/cbs/auth/login/route.ts:257): Spring Security's
        // UI chain redirects unauthenticated POSTs to an HTML login page
        // (302→200). Without this, fetch follows the redirect and
        // json().catch(() => ({})) silently produces an empty object.
        redirect: "manual",
      });

      if (!upstream.ok) {
        const errBody = await upstream.json().catch(() => ({}));
        // REFRESH_TOKEN_REUSED → possible token theft. Force logout.
        if (errBody?.errorCode === "REFRESH_TOKEN_REUSED") {
          const { clearSession } = await import("@/lib/server/session");
          await clearSession();
          return NextResponse.json(
            { success: false, errorCode: "REFRESH_TOKEN_REUSED", message: "Session interrupted for security. Please sign in again.", correlationId },
            { status: 401, headers: { "x-correlation-id": correlationId } },
          );
        }
        // Other refresh failures — keep existing tokens silently.
      } else {
        const json = await upstream.json().catch(() => ({}));
        const d = json.data;
        // Handle both nested (data.token.accessToken) and flat (data.accessToken) shapes
        const newAccessToken = d?.token?.accessToken || d?.accessToken;
        if (newAccessToken) {
          accessToken = newAccessToken;
          refreshToken = d?.token?.refreshToken ?? d?.refreshToken ?? refreshToken;
          tokenType = d?.token?.tokenType ?? d?.tokenType ?? tokenType;
          // Update jwtExpiresAt from the new token's expiry
          const newExpiresIn = d?.token?.expiresIn ?? d?.expiresIn;
          const newExpiresAtRaw = d?.token?.expiresAt ?? d?.expiresAt;
          if (newExpiresIn && newExpiresIn > 0) {
            jwtExpiresAt = now + newExpiresIn * 1000;
          } else if (newExpiresAtRaw && newExpiresAtRaw > now / 1000) {
            jwtExpiresAt = newExpiresAtRaw * 1000;
          } else {
            jwtExpiresAt = now + 15 * 60 * 1000; // default 15 min
          }
          // Update business date from refreshed response
          const newBizDate = d?.businessDay?.businessDate || d?.businessDate;
          if (newBizDate) businessDate = newBizDate;
          // Update businessDay context (dayStatus may have changed)
          if (d?.businessDay) {
            sessionBusinessDay = {
              businessDate: d.businessDay.businessDate || businessDate || "",
              dayStatus: d.businessDay.dayStatus || "UNKNOWN",
              isHoliday: d.businessDay.isHoliday ?? false,
              previousBusinessDate: d.businessDay.previousBusinessDate,
              nextBusinessDate: d.businessDay.nextBusinessDate,
            };
          }
          // Update user profile if refreshed
          if (d?.user) {
            const u = d.user;
            sessionUser = {
              ...sessionUser,
              id: u.userId ?? u.id ?? sessionUser.id,
              username: u.username || sessionUser.username,
              firstName: u.firstName || sessionUser.firstName,
              lastName: u.lastName || sessionUser.lastName,
              email: u.email || sessionUser.email,
              displayName: u.displayName || sessionUser.displayName,
              roles: (d?.role?.role ? [d.role.role] : u.roles) || sessionUser.roles,
              branchCode: d?.branch?.branchCode || u.branchCode || sessionUser.branchCode,
              branchName: d?.branch?.branchName || u.branchName || sessionUser.branchName,
              mfaEnrolled: u.mfaEnabled ?? u.mfaEnrolled ?? sessionUser.mfaEnrolled,
            };
          }
          // Update operational config + limits if present
          if (d?.operationalConfig) sessionOpConfig = d.operationalConfig;
          if (d?.limits?.transactionLimits) sessionTxnLimits = d.limits.transactionLimits;
        }
      }
    } catch {
      // Best-effort: keep existing tokens on network failure.
    }
  }

  const absoluteCeiling = session.issuedAt + env.sessionTtlSeconds * 1000;
  const idleExtension = now + env.sessionIdleExtensionSeconds * 1000;
  await writeSession({
    ...session,
    accessToken,
    refreshToken,
    tokenType,
    jwtExpiresAt,
    user: sessionUser,
    businessDate,
    businessDay: sessionBusinessDay,
    operationalConfig: sessionOpConfig,
    transactionLimits: sessionTxnLimits,
    expiresAt: Math.min(idleExtension, absoluteCeiling),
    csrfToken: session.csrfToken,
    // Preserve the original issuedAt so the absolute TTL ceiling
    // above stays pinned to the original login time; without this,
    // a user could extend indefinitely.
    issuedAt: session.issuedAt,
  });
  return NextResponse.json(
    { success: true, correlationId },
    { status: 200, headers: { "x-correlation-id": correlationId } },
  );
}
