/**
 * BFF login endpoint — Phase 1 of the two-phase auth flow.
 *
 * Per API_LOGIN_CONTRACT.md §4, Spring `POST /api/v1/auth/token`
 * accepts `{username, password}` and returns:
 *
 *   200 + status:"SUCCESS" + data.token.accessToken → full COC (no MFA)
 *   428 + errorCode:"MFA_REQUIRED" + data:{challengeId,channel} → MFA step-up
 *   401 + errorCode:"AUTH_FAILED" → invalid credentials (no enumeration)
 *   401 + errorCode:"ACCOUNT_DISABLED" → correct password, account disabled
 *   401 + errorCode:"ACCOUNT_LOCKED" → correct password, account locked
 *   401 + errorCode:"PASSWORD_EXPIRED" → correct password, password expired
 *   429 → rate-limited (20 req/IP burst, 1 token/6s refill)
 *
 * Per API_LOGIN_CONTRACT.md §4, MFA challenge data is in the `data`
 * field: `data: { challengeId, channel: "TOTP" }`. The BFF also reads
 * from the `error` object for backward compatibility.
 *
 * On successful login we materialise the encrypted server-side session
 * (fv_sid) and the JS-readable CSRF cookie (fv_csrf) and return the
 * safe subset of the user profile to the browser. The JWT never crosses
 * the cookie boundary.
 *
 * On MFA_REQUIRED we stash the opaque challengeId into a short-lived
 * HttpOnly bridge cookie (fv_mfa) so the /login/mfa page can complete
 * the step-up without the challengeId ever being exposed to JS.
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

// ── Spring nested response shape for POST /api/v1/auth/token ──────
// The response is deeply nested: data.token, data.user, data.branch,
// data.businessDay, data.role, data.limits, data.operationalConfig.

interface SpringToken {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  expiresAt?: number;
}

interface SpringUser {
  // Nested shape fields (from data.user in nested response)
  userId?: number;
  displayName?: string;
  authenticationLevel?: string;
  loginTimestamp?: string;
  lastLoginTimestamp?: string;
  passwordExpiryDate?: string;
  mfaEnabled?: boolean;
  // Flat shape fields (from data.user per LOGIN_API_RESPONSE_CONTRACT)
  id?: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  roles?: string[];
  branchCode?: string;
  branchName?: string;
  tenantId?: string;
  mfaEnrolled?: boolean;
}

interface SpringBranch {
  branchId?: number;
  branchCode?: string;
  branchName?: string;
  ifscCode?: string;
  branchType?: string;
  zoneCode?: string;
  regionCode?: string;
  headOffice?: boolean;
}

interface SpringBusinessDay {
  businessDate?: string;
  dayStatus?: string;
  isHoliday?: boolean;
  previousBusinessDate?: string;
  nextBusinessDate?: string;
}

interface SpringRole {
  role?: string;
  makerCheckerRole?: string;
  permissionsByModule?: Record<string, string[]>;
  allowedModules?: string[];
}

interface SpringTransactionLimit {
  transactionType: string;
  channel: string | null;
  perTransactionLimit: number;
  dailyAggregateLimit: number;
}

interface SpringLimits {
  transactionLimits?: SpringTransactionLimit[];
}

interface SpringOperationalConfig {
  baseCurrency?: string;
  decimalPrecision?: number;
  roundingMode?: string;
  fiscalYearStartMonth?: number;
  businessDayPolicy?: string;
}

interface SpringTokenSuccessData {
  // New nested shape
  token?: SpringToken;
  user?: SpringUser;
  branch?: SpringBranch;
  businessDay?: SpringBusinessDay;
  role?: SpringRole;
  limits?: SpringLimits;
  operationalConfig?: SpringOperationalConfig;
  // Legacy flat shape (backward compat)
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  expiresAt?: number;
  businessDate?: string;
}

/**
 * Spring error detail — per API_LOGIN_CONTRACT.md §4, auth errors
 * use the standard ApiResponse envelope with `errorCode` + `message`
 * at the top level. We also check nested `error` for backward compat.
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
 * Spring MFA challenge — per API_LOGIN_CONTRACT.md §4:
 *   HTTP 428, errorCode: "MFA_REQUIRED"
 *   data: { challengeId, channel: "TOTP" }
 * We also read from `error` for backward compatibility.
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

  let upstream: Response;
  try {
    upstream = await fetch(`${env.backendBaseUrl}/api/v1/auth/token`, {
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
  } catch {
    // Backend unreachable — ECONNREFUSED, DNS failure, or timeout.
    // Return a structured 503 so the login page can show a clear
    // "system unavailable" message instead of a cryptic network error.
    return NextResponse.json(
      {
        success: false,
        errorCode: "BACKEND_UNREACHABLE",
        message: "The banking server is currently unavailable. Please try again shortly or contact IT support.",
        correlationId,
      },
      { status: 503, headers: { "x-correlation-id": correlationId } },
    );
  }

  const json = (await upstream.json().catch(() => ({}))) as SpringTokenResponse;

  // ── MFA step-up detection ──────────────────────────────────────
  // Per API_LOGIN_CONTRACT.md §4: HTTP 428 with errorCode
  // "MFA_REQUIRED" and data: { challengeId, channel: "TOTP" }.
  const isMfaRequired =
    upstream.status === 428 ||
    json.errorCode === "MFA_REQUIRED";

  if (isMfaRequired) {
    // API_LOGIN_CONTRACT.md §4 puts challengeId in `data.challengeId`.
    // We also read from `error` for backward compatibility.
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

  // Determine if this is a success response. The new Spring shape nests
  // the access token under `data.token.accessToken`; the legacy shape
  // has it flat at `data.accessToken`. We detect both.
  const rawData = (upstream.ok && json.data) ? (json.data as SpringTokenSuccessData) : null;
  const accessToken = rawData?.token?.accessToken || rawData?.accessToken;

  if (!accessToken) {
    // Error path — per REST_API_COMPLETE_CATALOGUE §Standard Response
    // Envelope, error detail is in the `error` object:
    //   error: { code, message, remainingAttempts }
    // Older deployments may put it in `data`. Read from both.
    const errObj = json.error;
    const errData = json.data as SpringErrorData | null | undefined;
    // Per API_REFERENCE.md §2.1, all auth errors return 401 except
    // MFA_REQUIRED (428) and rate limit (429). The errorCode in the
    // body is the authoritative discriminator — HTTP status is only
    // a fallback when the body is empty.
    const errorCode =
      errObj?.code ||
      errData?.code ||
      json.errorCode ||
      (upstream.status === 401 ? "AUTH_FAILED"
        : upstream.status === 429 ? "AUTH_RATE_LIMIT_EXCEEDED"
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

  // ── Extract token fields (nested or flat) ─────────────────────
  const tok = rawData?.token;
  const expiresIn = tok?.expiresIn ?? rawData?.expiresIn;
  const expiresAtRaw = tok?.expiresAt ?? rawData?.expiresAt;

  const now = Date.now();
  let expiresAt: number;
  if (expiresIn && expiresIn > 0) {
    expiresAt = now + expiresIn * 1000;
  } else if (expiresAtRaw && expiresAtRaw > now / 1000) {
    expiresAt = expiresAtRaw * 1000;
  } else {
    expiresAt = now + env.sessionTtlSeconds * 1000;
  }

  // ── Extract nested sub-objects ──────────────────────────────
  const sUser = rawData?.user;
  const sBranch = rawData?.branch;
  const sBizDay = rawData?.businessDay;
  const sRole = rawData?.role;
  const sLimits = rawData?.limits;
  const sOpConfig = rawData?.operationalConfig;

  // Business date: prefer `data.businessDay.businessDate`, fall back
  // to legacy flat `data.businessDate`, then BFF server clock.
  const businessDate =
    sBizDay?.businessDate || rawData?.businessDate || new Date().toISOString().slice(0, 10);

  // Flatten permissionsByModule → flat string[] for legacy compat
  const flatPermissions = sRole?.permissionsByModule
    ? Object.values(sRole.permissionsByModule).flat()
    : [];

  // Build session user from whichever shape Spring returned.
  // Flat shape (LOGIN_API_RESPONSE_CONTRACT): data.user has id,
  //   firstName, lastName, email, roles[], branchCode, branchName,
  //   tenantId, displayName, mfaEnrolled.
  // Nested shape: data.user has userId, displayName, mfaEnabled;
  //   branch/role/permissions come from separate sub-objects.
  // We read from both, preferring the more specific field when present.
  const sessionUser: CbsSessionUser = {
    id: sUser?.userId ?? sUser?.id,
    username: sUser?.username || username,
    firstName: sUser?.firstName,
    lastName: sUser?.lastName,
    email: sUser?.email,
    displayName: sUser?.displayName
      || (sUser?.firstName && sUser?.lastName ? `${sUser.firstName} ${sUser.lastName}` : undefined),
    roles: sRole?.role
      ? [sRole.role]
      : (sUser?.roles?.length ? sUser.roles : []),
    makerCheckerRole: sRole?.makerCheckerRole,
    permissionsByModule: sRole?.permissionsByModule,
    permissions: flatPermissions.length > 0 ? flatPermissions : undefined,
    allowedModules: sRole?.allowedModules,
    branchCode: sBranch?.branchCode || sUser?.branchCode,
    branchName: sBranch?.branchName || sUser?.branchName,
    branchId: sBranch?.branchId,
    ifscCode: sBranch?.ifscCode,
    branchType: sBranch?.branchType,
    zoneCode: sBranch?.zoneCode,
    regionCode: sBranch?.regionCode,
    isHeadOffice: sBranch?.headOffice,
    tenantId: sUser?.tenantId || env.defaultTenantId,
    mfaEnrolled: sUser?.mfaEnabled ?? sUser?.mfaEnrolled,
    authenticationLevel: sUser?.authenticationLevel,
    lastLoginTimestamp: sUser?.lastLoginTimestamp,
    passwordExpiryDate: sUser?.passwordExpiryDate,
  };

  const session = await writeSession({
    accessToken,
    refreshToken: tok?.refreshToken ?? rawData?.refreshToken,
    tokenType: tok?.tokenType || "Bearer",
    expiresAt,
    user: sessionUser,
    correlationId,
    businessDate,
    businessDay: sBizDay ? {
      businessDate: sBizDay.businessDate || businessDate,
      dayStatus: sBizDay.dayStatus || "UNKNOWN",
      isHoliday: sBizDay.isHoliday ?? false,
      previousBusinessDate: sBizDay.previousBusinessDate,
      nextBusinessDate: sBizDay.nextBusinessDate,
    } : undefined,
    transactionLimits: sLimits?.transactionLimits,
    operationalConfig: sOpConfig ? {
      baseCurrency: sOpConfig.baseCurrency || "INR",
      decimalPrecision: sOpConfig.decimalPrecision ?? 2,
      roundingMode: sOpConfig.roundingMode || "HALF_UP",
      fiscalYearStartMonth: sOpConfig.fiscalYearStartMonth ?? 4,
      businessDayPolicy: sOpConfig.businessDayPolicy || "MON_TO_SAT",
    } : undefined,
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
        businessDay: session.businessDay ?? null,
        operationalConfig: session.operationalConfig ?? null,
        transactionLimits: session.transactionLimits ?? null,
      },
      correlationId,
    },
    { status: 200, headers: { "x-correlation-id": correlationId } },
  );
}
