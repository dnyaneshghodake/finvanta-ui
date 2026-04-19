/**
 * BFF login endpoint -- step 1 of the Spring MFA step-up flow.
 *
 * The Spring API `POST /api/v1/auth/token` accepts {username, password}
 * as JSON and returns one of:
 *
 *   200 + status:"SUCCESS" + data.accessToken  → successful login (no MFA)
 *   428 + errorCode:"MFA_REQUIRED" + error.challengeId → MFA step-up
 *   401 + errorCode:"INVALID_CREDENTIALS" / "ACCOUNT_LOCKED" → auth failure
 *   403 + errorCode:"PASSWORD_EXPIRED" → password change required
 *   429 → rate-limited (per RBI Cyber Security Framework 2024 §6.2)
 *
 * Per REST_API_COMPLETE_CATALOGUE §Auth, MFA challenge data is in the
 * `error` object: `error: { challengeId, method }`. The BFF also reads
 * from `data` for backward compatibility with older deployments.
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
 * Spring error detail — per REST_API_COMPLETE_CATALOGUE §Standard
 * Response Envelope, error detail is in the `error` object:
 *   error: { code, message, remainingAttempts }
 * Some deployments may also put error detail in `data`. We read both.
 */
interface SpringErrorData {
  code?: string;
  message?: string;
  remainingAttempts?: number;
  lockoutDurationMinutes?: number;
}

interface SpringTokenResponse {
  status?: string;
  data?: SpringTokenSuccessData | SpringErrorData | SpringMfaData | null;
  errorCode?: string;
  message?: string;
  timestamp?: string;
  /**
   * Per REST_API_COMPLETE_CATALOGUE, error detail (including MFA
   * challengeId) lives in the `error` object, not `data`.
   */
  error?: SpringMfaError & {
    code?: string;
    remainingAttempts?: number;
  };
}

/**
 * Spring MFA challenge response — per REST_API_COMPLETE_CATALOGUE §Auth:
 *
 *   HTTP 428, errorCode: "MFA_REQUIRED"
 *   error: { challengeId, method, message }
 *
 * The challengeId may also appear in `data` (per older API catalogue).
 * We read from both locations so the BFF works against either shape.
 */
interface SpringMfaError {
  challengeId?: string;
  /** "TOTP" or "SMS" — REST_API_COMPLETE_CATALOGUE uses `method`. */
  method?: string;
  /** Older catalogues used `channel` instead of `method`. */
  channel?: string;
  message?: string;
}

interface SpringMfaData {
  challengeId?: string;
  channel?: string;
  method?: string;
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
        errorCode: "VALIDATION_ERROR",
        message: "username: Username is required; password: Password is required;",
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
  // REST_API_COMPLETE_CATALOGUE §Auth: HTTP 428 with errorCode
  // "MFA_REQUIRED" and error: { challengeId, method }. We also
  // accept errorCode in the body on HTTP 200 for backward compat
  // with older Spring deployments (API_ENDPOINT_CATALOGUE Finding #4).
  const isMfaRequired =
    upstream.status === 428 ||
    json.errorCode === "MFA_REQUIRED";

  if (isMfaRequired) {
    // REST_API_COMPLETE_CATALOGUE puts challengeId in `error.challengeId`
    // and method in `error.method`. Older catalogues put it in `data`.
    // Read from both locations for backward compatibility.
    const mfaErr = json.error as SpringMfaError | undefined;
    const mfaData = json.data as SpringMfaData | undefined;
    const challengeId = mfaErr?.challengeId || mfaData?.challengeId;
    const channel = mfaErr?.method || mfaErr?.channel || mfaData?.method || mfaData?.channel || "TOTP";
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
    // Error path — per REST_API_COMPLETE_CATALOGUE §Standard Response
    // Envelope, error detail is in the `error` object:
    //   error: { code, message, remainingAttempts }
    // Older deployments may put it in `data`. Read from both.
    const errObj = json.error;
    const errData = json.data as SpringErrorData | null | undefined;
    const errorCode =
      errObj?.code ||
      errData?.code ||
      json.errorCode ||
      (upstream.status === 401 ? "AUTH_FAILED"
        : upstream.status === 403 ? "PASSWORD_EXPIRED"
        : upstream.status === 429 ? "RATE_LIMITED"
        : "LOGIN_FAILED");

    const remainingAttempts = errObj?.remainingAttempts ?? errData?.remainingAttempts;

    return NextResponse.json(
      {
        success: false,
        errorCode,
        message:
          errObj?.message ||
          errData?.message ||
          json.message ||
          "Login failed",
        // Surface remaining attempts + lockout duration so the login
        // page can warn the operator (Tier-1 CBS UX requirement).
        data: {
          ...(remainingAttempts !== undefined
            ? { remainingAttempts }
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
