/**
 * BFF login endpoint -- step 1 of the Spring MFA step-up flow.
 *
 * The Spring API `POST /api/v1/auth/token` accepts {username, password}
 * as JSON and either:
 *   200  -> {accessToken, refreshToken, tokenType, expiresAt}     (no MFA)
 *   428  -> errorCode=MFA_REQUIRED, data={challengeId, channel}   (MFA on)
 *   401  -> invalid credentials / account locked
 *
 * On 200 we materialise the encrypted server-side session (fv_sid) and
 * the JS-readable CSRF cookie (fv_csrf) and return the safe subset of
 * the user profile to the browser. The JWT never crosses the cookie
 * boundary.
 *
 * On 428 we stash the opaque challenge into a short-lived HttpOnly
 * bridge cookie (fv_mfa) so the /login/mfa page can complete the
 * step-up without the challengeId ever being exposed to JS (which would
 * otherwise make it stealable by XSS).
 */
import { NextResponse, type NextRequest } from "next/server";
import { readCorrelationId } from "@/lib/server/correlation";
import { serverEnv } from "@/lib/server/env";
import { writeSession, type CbsSessionUser } from "@/lib/server/session";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LoginBody {
  username?: string;
  email?: string;
  password: string;
  rememberMe?: boolean;
}

interface SpringTokenResponse {
  /**
   * Spring uses `status: "SUCCESS" | "ERROR"` (not boolean `success`).
   * The BFF checks `upstream.ok` + `json.data?.accessToken` instead.
   */
  status?: string;
  data?: {
    accessToken: string;
    refreshToken?: string;
    tokenType?: string;
    /**
     * Spring returns `expiresIn` (seconds until expiry, e.g. 900) per
     * the audited API catalogue §1.1. Some deployments may return
     * `expiresAt` (epoch seconds) instead. We handle both.
     */
    expiresIn?: number;
    expiresAt?: number;
    /** Server-authoritative business date from DayOpenService (YYYY-MM-DD). */
    businessDate?: string;
    user?: CbsSessionUser;
  };
  error?: {
    code?: string;
    message?: string;
    /** Remaining login attempts before account lock (Spring may include). */
    remainingAttempts?: number;
  };
  errorCode?: string;
  message?: string;
}

interface SpringMfaChallengeResponse {
  success?: boolean;
  data?: { challengeId?: string; channel?: string };
  error?: { code?: string; message?: string };
  errorCode?: string;
  message?: string;
}

export async function POST(req: NextRequest) {
  const correlationId = readCorrelationId(req);
  const env = serverEnv();
  const body = (await req.json().catch(() => ({}))) as LoginBody;
  const username = body.username || body.email;

  if (!username || !body.password) {
    return NextResponse.json(
      {
        success: false,
        errorCode: "INVALID_CREDENTIALS",
        message: "Username and password are required",
        correlationId,
      },
      { status: 400, headers: { "x-correlation-id": correlationId } },
    );
  }

  const upstream = await fetch(`${env.backendBaseUrl}/api/v1/auth/token`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "x-correlation-id": correlationId,
      "x-tenant-id": env.defaultTenantId,
    },
    body: JSON.stringify({
      username,
      password: body.password,
    }),
    cache: "no-store",
  });

  // 428 Precondition Required -- MFA step-up required.
  if (upstream.status === 428) {
    const mfaJson = (await upstream
      .json()
      .catch(() => ({}))) as SpringMfaChallengeResponse;
    const challengeId = mfaJson.data?.challengeId;
    const channel = mfaJson.data?.channel || "TOTP";
    if (!challengeId) {
      return NextResponse.json(
        {
          success: false,
          errorCode: "MFA_CHALLENGE_MISSING",
          message: "Backend signalled MFA but omitted challengeId",
          correlationId,
        },
        { status: 502, headers: { "x-correlation-id": correlationId } },
      );
    }

    const jar = await cookies();
    jar.set(env.mfaChallengeCookieName, challengeId, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: env.mfaChallengeTtlSeconds,
    });

    return NextResponse.json(
      {
        success: false,
        errorCode: "MFA_REQUIRED",
        message: "MFA step-up required to complete sign-in",
        data: { channel },
        correlationId,
      },
      { status: 428, headers: { "x-correlation-id": correlationId } },
    );
  }

  const json = (await upstream.json().catch(() => ({}))) as SpringTokenResponse;

  if (!upstream.ok || !json.data?.accessToken) {
    return NextResponse.json(
      {
        success: false,
        errorCode:
          json.error?.code ||
          json.errorCode ||
          (upstream.status === 401 ? "AUTH_FAILED" : "LOGIN_FAILED"),
        message:
          json.error?.message ||
          json.message ||
          "Login failed",
        // Surface remaining attempts so the login page can warn the
        // operator before account lock (Tier-1 CBS UX requirement).
        data: json.error?.remainingAttempts !== undefined
          ? { remainingAttempts: json.error.remainingAttempts }
          : undefined,
        correlationId,
      },
      {
        status: upstream.ok ? 502 : upstream.status,
        headers: { "x-correlation-id": correlationId },
      },
    );
  }

  const now = Date.now();
  // Spring returns `expiresIn` (seconds, e.g. 900) per the audited API
  // catalogue. Some deployments may return `expiresAt` (epoch seconds).
  // Handle both; fall back to the configured session TTL.
  let expiresAt: number;
  if (json.data.expiresIn && json.data.expiresIn > 0) {
    expiresAt = now + json.data.expiresIn * 1000;
  } else if (json.data.expiresAt && json.data.expiresAt > now / 1000) {
    expiresAt = json.data.expiresAt * 1000;
  } else {
    expiresAt = now + env.sessionTtlSeconds * 1000;
  }

  // Business date: Spring may include it in the token response
  // (from DayOpenService). Fall back to the BFF server's clock date.
  // In a CBS the business date can differ from the calendar date
  // (e.g. after midnight before day-close), so the Spring-provided
  // value takes precedence when available.
  const businessDate =
    json.data.businessDate || new Date().toISOString().slice(0, 10);

  const session = await writeSession({
    accessToken: json.data.accessToken,
    refreshToken: json.data.refreshToken,
    tokenType: json.data.tokenType || "Bearer",
    expiresAt,
    user: json.data.user || {
      username,
      roles: [],
      tenantId: env.defaultTenantId,
    },
    correlationId,
    businessDate,
  });

  // Clean up any stale fv_mfa cookie from a previous abandoned MFA
  // flow. Without this, a leftover challengeId could be consumed by
  // the MFA verify route in a context where it no longer belongs.
  const jar = await cookies();
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
