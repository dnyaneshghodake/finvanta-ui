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

/**
 * Spring MFA verify response — may return the new nested shape
 * (data.token, data.user, data.branch, data.businessDay, data.role)
 * or the legacy flat shape (data.accessToken, data.user). We detect
 * both, consistent with the login route handler.
 */
interface SpringMfaResponse {
  status?: string;
  data?: {
    // New nested shape
    token?: { accessToken?: string; refreshToken?: string; tokenType?: string; expiresIn?: number; expiresAt?: number };
    user?: { userId?: number; id?: number; username?: string; firstName?: string; lastName?: string; email?: string; displayName?: string; roles?: string[]; branchCode?: string; branchName?: string; tenantId?: string; mfaEnabled?: boolean; mfaEnrolled?: boolean; authenticationLevel?: string; lastLoginTimestamp?: string; passwordExpiryDate?: string };
    branch?: { branchId?: number; branchCode?: string; branchName?: string; ifscCode?: string; branchType?: string; zoneCode?: string; regionCode?: string; headOffice?: boolean };
    businessDay?: { businessDate?: string; dayStatus?: string; isHoliday?: boolean; previousBusinessDate?: string; nextBusinessDate?: string };
    role?: { role?: string; makerCheckerRole?: string; permissionsByModule?: Record<string, string[]>; allowedModules?: string[] };
    limits?: { transactionLimits?: Array<{ transactionType: string; channel: string | null; perTransactionLimit: number; dailyAggregateLimit: number }> };
    operationalConfig?: { baseCurrency?: string; decimalPrecision?: number; roundingMode?: string; fiscalYearStartMonth?: number; businessDayPolicy?: string };
    // Legacy flat shape
    accessToken?: string;
    refreshToken?: string;
    tokenType?: string;
    expiresIn?: number;
    expiresAt?: number;
    businessDate?: string;
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
      `${env.backendApiBase}/auth/mfa/verify`,
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
    .catch(() => ({}))) as SpringMfaResponse;

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

  // Detect access token from nested or flat shape
  const accessToken = json.data?.token?.accessToken || json.data?.accessToken;

  // Step-up during a pre-existing authenticated session: keep the
  // session user/branch context but bump mfaVerifiedAt.
  if (existing && !accessToken) {
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
  if (!accessToken) {
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

  // ── Extract fields from nested or flat shape ────────────────
  const d = json.data!;
  const tok = d.token;
  const sUser = d.user;
  const sBranch = d.branch;
  const sBizDay = d.businessDay;
  const sRole = d.role;
  const sLimits = d.limits;
  const sOpConfig = d.operationalConfig;

  const expiresIn = tok?.expiresIn ?? d.expiresIn;
  const expiresAtRaw = tok?.expiresAt ?? d.expiresAt;

  let expiresAt: number;
  if (expiresIn && expiresIn > 0) {
    expiresAt = now + expiresIn * 1000;
  } else if (expiresAtRaw && expiresAtRaw > now / 1000) {
    expiresAt = expiresAtRaw * 1000;
  } else {
    expiresAt = now + env.sessionTtlSeconds * 1000;
  }

  const businessDate =
    sBizDay?.businessDate || d.businessDate || existing?.businessDate || new Date().toISOString().slice(0, 10);

  // Build user from nested shape, fall back to existing session user
  const flatPermissions = sRole?.permissionsByModule
    ? Object.values(sRole.permissionsByModule).flat()
    : [];

  const sessionUser: CbsSessionUser = sUser ? {
    id: sUser.userId ?? sUser.id,
    username: sUser.username || existing?.user?.username || "unknown",
    firstName: sUser.firstName || existing?.user?.firstName,
    lastName: sUser.lastName || existing?.user?.lastName,
    email: sUser.email || existing?.user?.email,
    displayName: sUser.displayName
      || (sUser.firstName && sUser.lastName ? `${sUser.firstName} ${sUser.lastName}` : undefined)
      || existing?.user?.displayName,
    roles: sRole?.role
      ? [sRole.role]
      : (sUser.roles?.length ? sUser.roles : existing?.user?.roles || []),
    makerCheckerRole: sRole?.makerCheckerRole || existing?.user?.makerCheckerRole,
    permissionsByModule: sRole?.permissionsByModule || existing?.user?.permissionsByModule,
    permissions: flatPermissions.length > 0 ? flatPermissions : existing?.user?.permissions,
    allowedModules: sRole?.allowedModules || existing?.user?.allowedModules,
    branchCode: sBranch?.branchCode || sUser.branchCode || existing?.user?.branchCode,
    branchName: sBranch?.branchName || sUser.branchName || existing?.user?.branchName,
    branchId: sBranch?.branchId || existing?.user?.branchId,
    ifscCode: sBranch?.ifscCode || existing?.user?.ifscCode,
    branchType: sBranch?.branchType || existing?.user?.branchType,
    zoneCode: sBranch?.zoneCode || existing?.user?.zoneCode,
    regionCode: sBranch?.regionCode || existing?.user?.regionCode,
    isHeadOffice: sBranch?.headOffice ?? existing?.user?.isHeadOffice,
    tenantId: sUser.tenantId || existing?.user?.tenantId || env.defaultTenantId,
    mfaEnrolled: sUser.mfaEnabled ?? sUser.mfaEnrolled ?? existing?.user?.mfaEnrolled,
    authenticationLevel: sUser.authenticationLevel || existing?.user?.authenticationLevel,
    lastLoginTimestamp: sUser.lastLoginTimestamp || existing?.user?.lastLoginTimestamp,
    passwordExpiryDate: sUser.passwordExpiryDate || existing?.user?.passwordExpiryDate,
  } : (existing?.user || { username: "unknown", roles: [], tenantId: env.defaultTenantId });

  const session = await writeSession({
    accessToken,
    refreshToken: tok?.refreshToken ?? d.refreshToken,
    tokenType: tok?.tokenType || "Bearer",
    expiresAt,
    user: sessionUser,
    mfaVerifiedAt: now,
    correlationId,
    businessDate,
    businessDay: sBizDay ? {
      businessDate: sBizDay.businessDate || businessDate,
      dayStatus: sBizDay.dayStatus || "UNKNOWN",
      isHoliday: sBizDay.isHoliday ?? false,
      previousBusinessDate: sBizDay.previousBusinessDate,
      nextBusinessDate: sBizDay.nextBusinessDate,
    } : existing?.businessDay,
    transactionLimits: sLimits?.transactionLimits || existing?.transactionLimits,
    operationalConfig: sOpConfig ? {
      baseCurrency: sOpConfig.baseCurrency || "INR",
      decimalPrecision: sOpConfig.decimalPrecision ?? 2,
      roundingMode: sOpConfig.roundingMode || "HALF_UP",
      fiscalYearStartMonth: sOpConfig.fiscalYearStartMonth ?? 4,
      businessDayPolicy: sOpConfig.businessDayPolicy || "MON_TO_SAT",
    } : existing?.operationalConfig,
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
        businessDay: session.businessDay ?? null,
        operationalConfig: session.operationalConfig ?? null,
        transactionLimits: session.transactionLimits ?? null,
      },
      correlationId,
    },
    { status: 200, headers: { "x-correlation-id": correlationId } },
  );
}
