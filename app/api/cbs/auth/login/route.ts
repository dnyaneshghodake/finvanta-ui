/**
 * BFF login endpoint -- step 1 of the Spring MFA step-up flow.
 *
 * The Spring API `POST /api/v1/auth/token` accepts {username, password}
 * as JSON and returns one of:
 *
 *   200 + status:"SUCCESS" + data.accessToken  → successful login (no MFA)
 *   200 + errorCode:"MFA_REQUIRED" + data.challengeId → MFA step-up
 *   401 + errorCode:"INVALID_CREDENTIALS" / "ACCOUNT_LOCKED" → auth failure
 *   429 → rate-limited (per RBI Cyber Security Framework 2024 §6.2)
 *
 * Per the audited API Endpoint Catalogue §1.1 (Audit Finding #4), Spring
 * returns MFA_REQUIRED as HTTP 200 with `errorCode: "MFA_REQUIRED"` in
 * the body — NOT HTTP 428. The BFF also accepts 428 as a fallback for
 * backward compatibility with pre-audit Spring deployments.
 *
 * On successful login we materialise the encrypted server-side session
 * (fv_sid) and the JS-readable CSRF cookie (fv_csrf) and return the
 * safe subset of the user profile to the browser. The JWT never crosses
 * the cookie boundary.
 *
 * On MFA_REQUIRED we stash the opaque challengeId into a short-lived
 * HttpOnly bridge cookie (fv_mfa) so the /login/mfa page can complete
 * the step-up without the challengeId ever being exposed to JS (which
 * would otherwise make it stealable by XSS).
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

/**
 * Spring success response shape for POST /api/v1/auth/token.
 */
interface SpringTokenSuccessData {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  /**
   * Spring returns `expiresIn` (seconds until expiry, e.g. 900) per
   * the backend contract. We also handle `expiresAt` (epoch seconds)
   * as a fallback for alternative deployments.
   */
  expiresIn?: number;
  expiresAt?: number;
  /** Server-authoritative business date from DayOpenService (YYYY-MM-DD). */
  businessDate?: string;
  user?: CbsSessionUser;
}

/**
 * Spring error response shape — the `data` field carries error detail
 * on 401/403/429, NOT a nested `error` object. Per the backend contract:
 *
 *   401: data = { code, message, remainingAttempts }
 *   401: data = { code, message, lockoutDurationMinutes, remainingAttempts: 0 }
 *   403: data = null (PASSWORD_EXPIRED)
 *   429: data = null (RATE_LIMITED)
 */
interface SpringErrorData {
  code?: string;
  message?: string;
  remainingAttempts?: number;
  lockoutDurationMinutes?: number;
}

interface SpringTokenResponse {
  status?: string;
  data?: SpringTokenSuccessData | SpringErrorData | null;
  errorCode?: string;
  message?: string;
  timestamp?: string;
}

/**
 * Spring MFA challenge response — per audited API catalogue §1.1,
 * MFA_REQUIRED is returned as HTTP 200 with `errorCode: "MFA_REQUIRED"`
 * and `data: { challengeId, channel, expiresIn }`. The BFF also
 * accepts legacy HTTP 428 for backward compatibility.
 */
interface SpringMfaChallengeResponse {
  status?: "SUCCESS" | "ERROR";
  data?: { challengeId?: string; channel?: string; expiresIn?: number };
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

  const json = (await upstream.json().catch(() => ({}))) as SpringTokenResponse;

  // ── MFA step-up detection ──────────────────────────────────────
  // The LOGIN_API_RESPONSE_CONTRACT specifies HTTP 428 (RFC 8297)
  // with errorCode: "MFA_REQUIRED" and data: { challengeId, channel }.
  // The earlier API_ENDPOINT_CATALOGUE audit (Finding #4) documented
  // that Spring may also return HTTP 200 with the same errorCode in
  // the body. We detect both so the BFF works against either variant.
  const isMfaRequired =
    upstream.status === 428 ||
    json.errorCode === "MFA_REQUIRED";

  if (isMfaRequired) {
    const mfaData = json.data as SpringMfaChallengeResponse["data"] | undefined;
    const challengeId = mfaData?.challengeId;
    const channel = mfaData?.channel || "TOTP";
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

  // Determine if this is a success response by checking for accessToken.
  // Spring uses status: "SUCCESS"/"ERROR" but we also check upstream.ok
  // for robustness.
  const successData = (upstream.ok && json.data && "accessToken" in json.data)
    ? (json.data as SpringTokenSuccessData)
    : null;

  if (!successData?.accessToken) {
    // Error path — read error detail from data (backend contract puts
    // error info in `data: { code, message, remainingAttempts }` on 401,
    // not in a nested `error` object).
    const errData = json.data as SpringErrorData | null | undefined;
    const errorCode =
      errData?.code ||
      json.errorCode ||
      (upstream.status === 401 ? "AUTH_FAILED"
        : upstream.status === 403 ? "PASSWORD_EXPIRED"
        : upstream.status === 429 ? "RATE_LIMITED"
        : "LOGIN_FAILED");

    return NextResponse.json(
      {
        success: false,
        errorCode,
        message:
          errData?.message ||
          json.message ||
          "Login failed",
        // Surface remaining attempts + lockout duration so the login
        // page can warn the operator (Tier-1 CBS UX requirement).
        data: {
          ...(errData?.remainingAttempts !== undefined
            ? { remainingAttempts: errData.remainingAttempts }
            : {}),
          ...(errData?.lockoutDurationMinutes !== undefined
            ? { lockoutDurationMinutes: errData.lockoutDurationMinutes }
            : {}),
        },
        correlationId,
      },
      {
        status: upstream.ok ? 502 : upstream.status,
        headers: { "x-correlation-id": correlationId },
      },
    );
  }

  const now = Date.now();
  // Spring returns `expiresIn` (seconds, e.g. 900) per the backend
  // contract. We also handle `expiresAt` (epoch seconds) as fallback.
  let expiresAt: number;
  if (successData.expiresIn && successData.expiresIn > 0) {
    expiresAt = now + successData.expiresIn * 1000;
  } else if (successData.expiresAt && successData.expiresAt > now / 1000) {
    expiresAt = successData.expiresAt * 1000;
  } else {
    expiresAt = now + env.sessionTtlSeconds * 1000;
  }

  // Business date: Spring includes it from DayOpenService. Fall back to
  // BFF server clock only when backend omits it (which is wrong for CBS
  // operations — the business date can differ from the calendar date
  // after midnight before day-close).
  const businessDate =
    successData.businessDate || new Date().toISOString().slice(0, 10);

  const session = await writeSession({
    accessToken: successData.accessToken,
    refreshToken: successData.refreshToken,
    tokenType: successData.tokenType || "Bearer",
    expiresAt,
    user: successData.user || {
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
