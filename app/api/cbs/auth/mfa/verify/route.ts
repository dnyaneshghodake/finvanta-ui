/**
 * BFF MFA step-up verifier -- step 2 of the Spring MFA step-up flow.
 *
 * After `POST /api/cbs/auth/login` returns 428 with a challengeId
 * stashed in the fv_mfa HttpOnly cookie, the login page redirects to
 * /login/mfa where the user enters the 6-digit TOTP. That page POSTs
 * {otp} to this route. We read the challengeId from fv_mfa (so XSS
 * cannot steal it), POST {challengeId, otp} to Spring's
 * `/api/v1/auth/mfa/verify`, and on 200 materialise the encrypted
 * fv_sid session exactly like the non-MFA path -- then clear fv_mfa.
 *
 * When called from inside an authenticated session (in-app sensitive
 * operation step-up, e.g. high-value transfer) the Spring call is
 * authorised with the existing access token and we bump
 * mfaVerifiedAt on the session.
 */
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { readCorrelationId } from "@/lib/server/correlation";
import { serverEnv } from "@/lib/server/env";
import {
  readSession,
  writeSession,
  type CbsSessionUser,
} from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface VerifyBody {
  challengeId?: string;
  otp?: string;
}

interface SpringTokenResponse {
  status?: string;
  data?: {
    accessToken?: string;
    refreshToken?: string;
    tokenType?: string;
    /** Seconds until expiry (e.g. 900) — per LOGIN_API_RESPONSE_CONTRACT. */
    expiresIn?: number;
    /** Epoch seconds — alternative format some deployments may use. */
    expiresAt?: number;
    /** Server-authoritative business date (YYYY-MM-DD) from DayOpenService. */
    businessDate?: string;
    user?: CbsSessionUser;
  };
  errorCode?: string;
  message?: string;
}

export async function POST(req: NextRequest) {
  const correlationId = readCorrelationId(req);
  const env = serverEnv();
  const body = (await req.json().catch(() => ({}))) as VerifyBody;

  const jar = await cookies();
  // Prefer the HttpOnly fv_mfa cookie over the body field so XSS
  // cannot supply an attacker-controlled challengeId. The body
  // fallback is retained only for the in-session step-up path where
  // the cookie may not be set (the caller already holds a session).
  const challengeId =
    jar.get(env.mfaChallengeCookieName)?.value ?? body.challengeId;

  if (!challengeId || !body.otp) {
    return NextResponse.json(
      {
        success: false,
        errorCode: "INVALID_MFA",
        message: "challengeId and otp are required",
        correlationId,
      },
      { status: 400, headers: { "x-correlation-id": correlationId } },
    );
  }

  const existing = await readSession();

  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
    "x-correlation-id": correlationId,
    "x-tenant-id": existing?.user.tenantId || env.defaultTenantId,
  };
  if (existing?.accessToken) {
    headers.authorization = `${existing.tokenType || "Bearer"} ${existing.accessToken}`;
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      `${env.backendBaseUrl}/api/v1/auth/mfa/verify`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ challengeId, otp: body.otp }),
        cache: "no-store",
      },
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        errorCode: "BACKEND_UNREACHABLE",
        message: "The banking server is currently unavailable. Please try again shortly.",
        correlationId,
      },
      { status: 503, headers: { "x-correlation-id": correlationId } },
    );
  }

  const json = (await upstream
    .json()
    .catch(() => ({}))) as SpringTokenResponse;

  if (!upstream.ok) {
    return NextResponse.json(
      {
        success: false,
        errorCode:
          json.errorCode ||
          "MFA_VERIFICATION_FAILED",
        message:
          json.message ||
          "MFA verification failed",
        correlationId,
      },
      { status: upstream.status, headers: { "x-correlation-id": correlationId } },
    );
  }

  const now = Date.now();

  // Step-up during a pre-existing authenticated session: keep the
  // session user/branch context but bump mfaVerifiedAt.
  if (existing && !json.data?.accessToken) {
    await writeSession({
      ...existing,
      mfaVerifiedAt: now,
      csrfToken: existing.csrfToken,
      // Step-up within an existing session -- preserve issuedAt so
      // the absolute TTL ceiling stays anchored to the original login.
      issuedAt: existing.issuedAt,
    });
    jar.delete(env.mfaChallengeCookieName);
    return NextResponse.json(
      { success: true, correlationId },
      { status: 200, headers: { "x-correlation-id": correlationId } },
    );
  }

  // Completion of the login MFA challenge: Spring returned fresh tokens.
  if (!json.data?.accessToken) {
    return NextResponse.json(
      {
        success: false,
        errorCode: "MFA_VERIFIER_NO_TOKEN",
        message: "Backend verified MFA but returned no access token",
        correlationId,
      },
      { status: 502, headers: { "x-correlation-id": correlationId } },
    );
  }

  // Handle both expiresIn (seconds) and expiresAt (epoch seconds).
  let expiresAt: number;
  if (json.data.expiresIn && json.data.expiresIn > 0) {
    expiresAt = now + json.data.expiresIn * 1000;
  } else if (json.data.expiresAt && json.data.expiresAt > now / 1000) {
    expiresAt = json.data.expiresAt * 1000;
  } else {
    expiresAt = now + env.sessionTtlSeconds * 1000;
  }

  // Business date: prefer the Spring response (MFA verify returns the
  // same EnhancedTokenResponse as login, including businessDate per
  // LOGIN_API_RESPONSE_CONTRACT §1.2). Fall back to existing session,
  // then BFF server clock. Without this the Header shows '--' for
  // every MFA-authenticated operator until the first heartbeat fires.
  const businessDate =
    json.data.businessDate ||
    existing?.businessDate ||
    new Date().toISOString().slice(0, 10);

  const session = await writeSession({
    accessToken: json.data.accessToken,
    refreshToken: json.data.refreshToken,
    tokenType: json.data.tokenType || "Bearer",
    expiresAt,
    user:
      json.data.user ||
      existing?.user ||
      { username: "unknown", roles: [], tenantId: env.defaultTenantId },
    mfaVerifiedAt: now,
    correlationId,
    businessDate,
  });

  jar.delete(env.mfaChallengeCookieName);

  return NextResponse.json(
    {
      success: true,
      data: {
        user: session.user,
        expiresAt: session.expiresAt,
        csrfToken: session.csrfToken,
        businessDate: session.businessDate,
      },
      correlationId,
    },
    { status: 200, headers: { "x-correlation-id": correlationId } },
  );
}
