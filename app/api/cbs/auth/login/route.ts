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
import { checkRateLimit, extractClientIp } from "@/lib/server/rateLimit";
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
  // Flat shape fields (from data.user per API_LOGIN_CONTRACT.md §4)
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

  // ── BFF-level rate limiting ────────────────────────────────────
  // Per RBI Cyber Security Framework 2024 §6.2: rate-limit auth
  // endpoints at the BFF layer BEFORE forwarding to Spring. This
  // protects the Node.js event loop from crypto/JSON overhead on
  // brute-force floods. Spring has its own limiter as a second layer.
  const clientIp = extractClientIp(req.headers);
  const rl = checkRateLimit(`login:${clientIp}`, {
    maxRequests: 20,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        success: false,
        errorCode: "AUTH_RATE_LIMIT_EXCEEDED",
        message: `Too many login attempts. Try again in ${rl.retryAfterSeconds} seconds.`,
        correlationId,
      },
      {
        status: 429,
        headers: {
          "x-correlation-id": correlationId,
          "retry-after": String(rl.retryAfterSeconds),
        },
      },
    );
  }

  const body = (await req.json().catch(() => ({}))) as LoginBody;
  const username = body.username || body.email;

  if (!username || !body.password) {
    return NextResponse.json(
      {
        success: false,
        errorCode: "VALIDATION_FAILED",
        message: "username: Username is required; password: Password is required;",
        correlationId,
      },
      { status: 400, headers: { "x-correlation-id": correlationId } },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${env.backendApiBase}/auth/token`, {
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
      // CRITICAL: do not follow redirects. Spring Security's UI chain
      // redirects unauthenticated POSTs to the HTML login page (302→200).
      // Without this, fetch follows the redirect and the BFF sees an HTML
      // page with status 200 instead of the actual 302/403 from Spring.
      redirect: "manual",
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

  // If Spring redirected (302/303), it means the request hit the UI
  // security chain instead of the API chain. Log the Location header
  // so we can diagnose the security chain mismatch.
  if (upstream.status >= 300 && upstream.status < 400) {
    const location = upstream.headers.get("location");
    if (process.env.NODE_ENV !== "production") {
      console.error(
        `[BFF login] Spring redirected: ${upstream.status} → ${location ?? "(no location)"}\n` +
        `  Requested URL: ${env.backendApiBase}/auth/token\n` +
        `  This usually means:\n` +
        `  1. CBS_API_PREFIX is wrong (current: check .env.development)\n` +
        `  2. Spring Security CSRF is blocking the POST (API chain should disable CSRF)\n` +
        `  3. The request matched the UI security chain instead of the API chain`,
      );
    }
    return NextResponse.json(
      {
        success: false,
        errorCode: "BACKEND_REDIRECT",
        message: "The banking server rejected the login request. This is a server configuration issue — contact IT support.",
        correlationId,
      },
      { status: 502, headers: { "x-correlation-id": correlationId } },
    );
  }

  // Read the raw response text first, then parse as JSON.
  // This avoids silent failures from .json().catch(() => ({})) which
  // swallows parse errors and produces an empty object — making it
  // impossible to diagnose why the token extraction fails.
  const rawText = await upstream.text().catch(() => "");
  let json: SpringTokenResponse;
  try {
    json = rawText ? JSON.parse(rawText) : {};
  } catch {
    // Spring returned non-JSON (HTML error page, empty body, etc.)
    if (process.env.NODE_ENV !== "production") {
      console.error(
        `[BFF login] upstream=${upstream.status} content-type=${upstream.headers.get("content-type")} ` +
        `body=${rawText.slice(0, 500)}`,
      );
    }
    return NextResponse.json(
      {
        success: false,
        errorCode: "BACKEND_INVALID_RESPONSE",
        message: "The banking server returned an unexpected response. Contact IT support.",
        correlationId,
      },
      { status: 502, headers: { "x-correlation-id": correlationId } },
    );
  }

  // Debug: log the parsed response shape.
  if (process.env.NODE_ENV !== "production") {
    const topKeys = Object.keys(json);
    const dataKeys = json.data && typeof json.data === "object" ? Object.keys(json.data as Record<string, unknown>) : [];
    console.log(
      `[BFF login] upstream=${upstream.status} topKeys=[${topKeys.join(",")}] ` +
      `status=${json.status ?? "?"} errorCode=${json.errorCode ?? "none"} ` +
      `data.keys=[${dataKeys.join(",")}]`,
    );
  }

  // ── MFA step-up detection ──────────────────────────────────────
  // Per API_LOGIN_CONTRACT.md §4: HTTP 428 with errorCode
  // "MFA_REQUIRED" and data: { challengeId, channel: "TOTP" }.
  // Also check root-level errorCode for bare envelope (Shape C).
  const rootObj = json as Record<string, unknown>;
  const isMfaRequired =
    upstream.status === 428 ||
    json.errorCode === "MFA_REQUIRED" ||
    rootObj.errorCode === "MFA_REQUIRED";

  if (isMfaRequired) {
    // Check data wrapper, error object, and root level for challengeId.
    const mfaErr = json.error as SpringMfaError | undefined;
    const mfaData = json.data as SpringMfaData | undefined;
    const challengeId =
      mfaErr?.challengeId ||
      mfaData?.challengeId ||
      (rootObj.challengeId as string | undefined) ||
      ((rootObj.data as Record<string, unknown> | undefined)?.challengeId as string | undefined);
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

  // ── Extract access token from any supported response shape ─────
  //
  // Spring may return tokens in three different envelope shapes:
  //
  //   Shape A (v1.0 nested):  { status:"SUCCESS", data:{ token:{ accessToken } } }
  //   Shape B (v2.0 wrapped): { status:"SUCCESS", data:{ accessToken } }
  //   Shape C (v2.0 bare):    { accessToken, refreshToken, user:{...} }
  //
  // Shape C occurs when Spring returns the AuthResponse directly
  // without the ApiResponse<T> envelope (no `status`/`data` wrapper).
  // We detect ALL three to be resilient across backend versions.
  const root = json as Record<string, unknown>;
  const dataObj = (upstream.ok && json.data && typeof json.data === "object")
    ? (json.data as Record<string, unknown>)
    : null;

  const accessToken =
    // Shape A: data.token.accessToken
    (dataObj?.token as Record<string, unknown> | undefined)?.accessToken as string | undefined ||
    // Shape B: data.accessToken
    (dataObj?.accessToken as string | undefined) ||
    // Shape C: root-level accessToken (no data wrapper)
    (upstream.ok && typeof root.accessToken === "string" ? root.accessToken : undefined) ||
    null;

  // Unified data source: prefer the `data` wrapper, fall back to root
  // (Shape C puts everything at the top level).
  const d = dataObj ?? (upstream.ok && accessToken ? root : null);
  const rawData = d as SpringTokenSuccessData | null;

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

  // ── Extract token fields (nested v1.0 or flat v2.0) ────────────
  const tok = rawData?.token;
  const refreshTokenRaw = tok?.refreshToken ?? (d?.refreshToken as string | undefined) ?? rawData?.refreshToken;
  const tokenTypeRaw = tok?.tokenType ?? (d?.tokenType as string | undefined) ?? rawData?.tokenType;
  const expiresIn = tok?.expiresIn ?? rawData?.expiresIn;
  const expiresAtRaw = tok?.expiresAt ?? (d?.expiresAt as number | undefined) ?? rawData?.expiresAt;

  // ── BFF session expiry ──────────────────────────────────────
  // The BFF session expiry is INDEPENDENT of the JWT expiry.
  // The JWT expiresAt (typically 15 min) controls when Spring rejects
  // the token. The BFF session expiry controls when the BFF itself
  // considers the session dead. These must NOT be the same:
  //
  //   JWT expiresAt:     15 min (Spring rejects after this)
  //   BFF session:       CBS_SESSION_IDLE_SECONDS (default 30 min for dev)
  //   Cookie maxAge:     CBS_SESSION_TTL_SECONDS (absolute ceiling, 8h)
  //
  // The BFF proactively refreshes the JWT via /auth/refresh at
  // expiresAt - 60s. If the refresh fails, the next API call gets
  // 401 from Spring and the user is redirected to login.
  //
  // We store the JWT's expiresAt separately so the refresh timer
  // knows when to fire, but the SESSION expiry uses the idle timeout.
  const now = Date.now();

  // JWT expiry — used for proactive refresh scheduling
  let jwtExpiresAt: number;
  if (expiresIn && expiresIn > 0) {
    jwtExpiresAt = now + expiresIn * 1000;
  } else if (expiresAtRaw && expiresAtRaw > now / 1000) {
    jwtExpiresAt = expiresAtRaw * 1000;
  } else {
    jwtExpiresAt = now + 15 * 60 * 1000; // default 15 min
  }

  // BFF session expiry — uses idle timeout, NOT JWT expiry
  const expiresAt = now + env.sessionIdleExtensionSeconds * 1000;

  // ── Extract nested sub-objects ──────────────────────────────
  // v2.0 flat AuthResponse: user is at data.user with role + branchCode
  //   directly on the user object. No separate branch/role/limits objects.
  // v1.0 nested LoginSessionContext: separate data.branch, data.role, etc.
  // We read from both shapes.
  const sUser = (d?.user as SpringUser | undefined) ?? rawData?.user;
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
  // Flat shape (API_LOGIN_CONTRACT.md §4): data.user has id,
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
    // v2.0: data.user.role is a string ("MAKER"); v1.0: data.role.role
    roles: sRole?.role
      ? [sRole.role]
      : ((sUser as Record<string, unknown> | undefined)?.role
        ? [String((sUser as Record<string, unknown>).role)]
        : (sUser?.roles?.length ? sUser.roles : [])),
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

  // ── Step 2: Context Bootstrap ─────────────────────────────────
  // Per API_LOGIN_CONTRACT.md §7: after login returns identity + tokens,
  // call GET /context/bootstrap to fetch the full operational context
  // (branch, businessDay, permissions, limits, config). This is the
  // "session activation" step per Finacle USER_SESSION / Temenos
  // EB.USER.CONTEXT pattern. The login response (v2.0) only has minimal
  // user identity — the heavy context comes from bootstrap.
  let bootstrapUser = sUser;
  let bootstrapBranch = sBranch;
  let bootstrapBizDay = sBizDay;
  let bootstrapRole = sRole;
  let bootstrapLimits = sLimits;
  let bootstrapOpConfig = sOpConfig;
  let bootstrapBusinessDate = businessDate;

  try {
    const bsRes = await fetch(`${env.backendApiBase}/context/bootstrap`, {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `${tokenTypeRaw || "Bearer"} ${accessToken}`,
        "x-correlation-id": correlationId,
        "x-tenant-id": env.defaultTenantId,
      },
      cache: "no-store",
      redirect: "manual",
    });
    if (bsRes.ok) {
      const bsText = await bsRes.text().catch(() => "");
      const bsJson = bsText ? JSON.parse(bsText) : {};
      const bs = bsJson.data;
      if (bs) {
        if (process.env.NODE_ENV !== "production") {
          console.log(`[BFF login] bootstrap OK — keys=[${Object.keys(bs).join(",")}]`);
        }
        // Merge bootstrap context over login identity.
        // Bootstrap has richer user info (lastLoginTimestamp, passwordExpiryDate).
        if (bs.user) bootstrapUser = { ...sUser, ...bs.user };
        if (bs.branch) bootstrapBranch = bs.branch;
        if (bs.businessDay) {
          bootstrapBizDay = bs.businessDay;
          bootstrapBusinessDate = bs.businessDay.businessDate || businessDate;
        }
        if (bs.role) bootstrapRole = bs.role;
        if (bs.limits) bootstrapLimits = bs.limits;
        if (bs.operationalConfig) bootstrapOpConfig = bs.operationalConfig;
      }
    } else if (process.env.NODE_ENV !== "production") {
      console.warn(`[BFF login] bootstrap failed: ${bsRes.status} — using login-only context`);
    }
  } catch (err) {
    // Bootstrap is best-effort. If it fails, we still have the login
    // identity and can render the dashboard header. The bootstrap
    // context will be missing (no permissions, no business day) but
    // the user won't be locked out.
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[BFF login] bootstrap error — using login-only context`, err);
    }
  }

  // Rebuild session user with bootstrap-enriched data
  const bUser = bootstrapUser;
  const bBranch = bootstrapBranch;
  const bRole = bootstrapRole;
  const bFlatPerms = bRole?.permissionsByModule
    ? Object.values(bRole.permissionsByModule).flat()
    : flatPermissions;

  const enrichedUser: CbsSessionUser = {
    id: bUser?.userId ?? bUser?.id ?? sessionUser.id,
    username: bUser?.username || sessionUser.username,
    firstName: bUser?.firstName || sessionUser.firstName,
    lastName: bUser?.lastName || sessionUser.lastName,
    email: bUser?.email || sessionUser.email,
    displayName: bUser?.displayName || sessionUser.displayName,
    roles: bRole?.role
      ? [bRole.role]
      : ((bUser as Record<string, unknown> | undefined)?.role
        ? [String((bUser as Record<string, unknown>).role)]
        : sessionUser.roles),
    makerCheckerRole: bRole?.makerCheckerRole || sessionUser.makerCheckerRole,
    permissionsByModule: bRole?.permissionsByModule || sessionUser.permissionsByModule,
    permissions: bFlatPerms.length > 0 ? bFlatPerms : sessionUser.permissions,
    allowedModules: bRole?.allowedModules || sessionUser.allowedModules,
    branchCode: bBranch?.branchCode || sessionUser.branchCode,
    branchName: bBranch?.branchName || sessionUser.branchName,
    branchId: bBranch?.branchId || sessionUser.branchId,
    ifscCode: bBranch?.ifscCode || sessionUser.ifscCode,
    branchType: bBranch?.branchType || sessionUser.branchType,
    zoneCode: bBranch?.zoneCode || sessionUser.zoneCode,
    regionCode: bBranch?.regionCode || sessionUser.regionCode,
    isHeadOffice: bBranch?.headOffice ?? sessionUser.isHeadOffice,
    tenantId: sessionUser.tenantId,
    mfaEnrolled: bUser?.mfaEnabled ?? sessionUser.mfaEnrolled,
    authenticationLevel: bUser?.authenticationLevel || sessionUser.authenticationLevel,
    lastLoginTimestamp: bUser?.lastLoginTimestamp || sessionUser.lastLoginTimestamp,
    passwordExpiryDate: bUser?.passwordExpiryDate || sessionUser.passwordExpiryDate,
  };

  const session = await writeSession({
    accessToken,
    refreshToken: refreshTokenRaw,
    tokenType: tokenTypeRaw || "Bearer",
    expiresAt,
    jwtExpiresAt,
    user: enrichedUser,
    correlationId,
    businessDate: bootstrapBusinessDate,
    businessDay: bootstrapBizDay ? {
      businessDate: bootstrapBizDay.businessDate || bootstrapBusinessDate,
      dayStatus: bootstrapBizDay.dayStatus || "UNKNOWN",
      isHoliday: bootstrapBizDay.isHoliday ?? false,
      previousBusinessDate: bootstrapBizDay.previousBusinessDate,
      nextBusinessDate: bootstrapBizDay.nextBusinessDate,
    } : undefined,
    transactionLimits: bootstrapLimits?.transactionLimits,
    operationalConfig: bootstrapOpConfig ? {
      baseCurrency: bootstrapOpConfig.baseCurrency || "INR",
      decimalPrecision: bootstrapOpConfig.decimalPrecision ?? 2,
      roundingMode: bootstrapOpConfig.roundingMode || "HALF_UP",
      fiscalYearStartMonth: bootstrapOpConfig.fiscalYearStartMonth ?? 4,
      businessDayPolicy: bootstrapOpConfig.businessDayPolicy || "MON_TO_SAT",
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
