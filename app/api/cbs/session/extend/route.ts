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
  // On failure we keep the existing tokens — the next API call will
  // fail with 401 and the client interceptor redirects to /login.
  if (refreshToken && session.expiresAt - now < env.sessionIdleExtensionSeconds * 1000 * 0.2) {
    try {
      const upstream = await fetch(`${env.backendBaseUrl}/api/v1/auth/refresh`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-correlation-id": correlationId,
          "x-tenant-id": session.user.tenantId || env.defaultTenantId,
        },
        body: JSON.stringify({ refreshToken }),
        cache: "no-store",
      });
      if (upstream.ok) {
        const json = await upstream.json().catch(() => ({}));
        if (json.data?.accessToken) {
          accessToken = json.data.accessToken;
          refreshToken = json.data.refreshToken ?? refreshToken;
          tokenType = json.data.tokenType ?? tokenType;
          if (json.data.businessDate) businessDate = json.data.businessDate;
          if (json.data.user) sessionUser = json.data.user;
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
    user: sessionUser,
    businessDate,
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
