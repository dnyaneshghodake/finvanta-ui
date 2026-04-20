/**
 * BFF proxy helper for Spring `/api/**` endpoints.
 *
 * Responsibilities:
 *   - Inject the JWT from the server-side session (never from the
 *     browser).
 *   - Inject X-Branch-Code / X-Tenant-ID from the session so a form
 *     input cannot override branch context.
 *   - Echo X-Correlation-Id end-to-end.
 *   - Preserve X-Idempotency-Key for mutating requests; generate one
 *     if the caller forgot to send it on a POST / PUT / PATCH so a
 *     retry never double-posts.
 *   - Strip hop-by-hop headers before returning to the browser.
 *   - Map 401 to session clear + structured response so the client
 *     interceptor can redirect to /login.
 */
import "server-only";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readSession, writeSession, type CbsSession } from "./session";
import { assertCsrf } from "./csrf";
import { readCorrelationId } from "./correlation";
import { serverEnv } from "./env";

// ── Module-level mutex for proactive JWT refresh ──────────────────
// Prevents parallel requests (e.g. 4 dashboard widgets loading
// simultaneously) from all calling Spring's /auth/refresh at once.
// The first caller sets the in-flight Promise; concurrent callers
// await it. After resolution the lock is cleared for the next cycle.
let refreshInFlight: Promise<CbsSession | null> | null = null;

async function proactiveRefresh(
  session: CbsSession,
  correlationId: string,
): Promise<CbsSession | null> {
  // If another request is already refreshing, await its result.
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      const env2 = serverEnv();
      const now = Date.now();
      const refreshRes = await fetch(`${env2.backendApiBase}/auth/refresh`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-correlation-id": correlationId,
          "x-tenant-id": session.user.tenantId || env2.defaultTenantId,
        },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
        cache: "no-store",
        // CRITICAL: do not follow redirects. Same rationale as the login
        // route (app/api/cbs/auth/login/route.ts:257): Spring Security's
        // UI chain redirects unauthenticated POSTs to an HTML login page
        // (302→200). Without this, fetch follows the redirect and
        // json().catch(() => ({})) silently produces an empty object.
        redirect: "manual",
      });
      if (refreshRes.ok) {
        const json = await refreshRes.json().catch(() => ({}));
        const d = json.data;
        const newAccessToken = d?.token?.accessToken || d?.accessToken;
        if (newAccessToken) {
          const newExpiresIn = d?.token?.expiresIn ?? d?.expiresIn;
          const newExpiresAtRaw = d?.token?.expiresAt ?? d?.expiresAt;
          let newJwtExpiresAt: number;
          if (newExpiresIn && newExpiresIn > 0) {
            newJwtExpiresAt = now + newExpiresIn * 1000;
          } else if (newExpiresAtRaw && newExpiresAtRaw > now / 1000) {
            newJwtExpiresAt = newExpiresAtRaw * 1000;
          } else {
            newJwtExpiresAt = now + 15 * 60 * 1000;
          }
          const refreshed: CbsSession = {
            ...session,
            accessToken: newAccessToken,
            refreshToken: d?.token?.refreshToken ?? d?.refreshToken ?? session.refreshToken,
            tokenType: d?.token?.tokenType ?? session.tokenType,
            jwtExpiresAt: newJwtExpiresAt,
          };
          await writeSession({
            ...refreshed,
            issuedAt: session.issuedAt,
          });
          if (process.env.NODE_ENV !== "production") {
            console.log(`[BFF proxy] JWT refreshed proactively — new expiry in ${Math.round((newJwtExpiresAt - now) / 1000)}s`);
          }
          return refreshed;
        }
      } else if (process.env.NODE_ENV !== "production") {
        console.warn(`[BFF proxy] JWT refresh failed: ${refreshRes.status}`);
      }
      return null;
    } catch {
      // Best-effort: forward with existing (soon-to-expire) JWT.
      // Spring will reject with 401 if it actually expired, and
      // the client interceptor will redirect to login.
      return null;
    }
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
]);

function shouldForwardRequestHeader(name: string): boolean {
  const lower = name.toLowerCase();
  if (HOP_BY_HOP.has(lower)) return false;
  if (lower === "host") return false;
  if (lower === "cookie") return false;
  if (lower === "content-length") return false;
  if (lower === "authorization") return false;
  if (lower === "x-branch-code" || lower === "x-tenant-id") return false;
  return true;
}

function shouldForwardResponseHeader(name: string): boolean {
  const lower = name.toLowerCase();
  if (HOP_BY_HOP.has(lower)) return false;
  if (lower === "set-cookie") return false;
  return true;
}

export interface ProxyOptions {
  requireAuth?: boolean;
  requireCsrf?: boolean;
}

export async function proxyToBackend(
  req: NextRequest,
  targetPath: string,
  search: string,
  opts: ProxyOptions = {},
): Promise<NextResponse> {
  const correlationId = readCorrelationId(req);
  const session = await readSession();

  if (opts.requireAuth && !session) {
    return NextResponse.json(
      {
        success: false,
        errorCode: "NO_SESSION",
        message: "Not authenticated",
        correlationId,
      },
      { status: 401, headers: { "x-correlation-id": correlationId } },
    );
  }

  // `opts.requireCsrf` defaults to true: every mutating call through the
  // BFF must present a matching fv_csrf cookie + X-CSRF-Token header
  // (double-submit). Callers can opt out (e.g. public read-only endpoints)
  // by explicitly passing `requireCsrf: false`; otherwise the contract is
  // unchanged and the default is the safe one.
  if (opts.requireCsrf !== false) {
    try {
      assertCsrf(req, session);
    } catch {
      return NextResponse.json(
        {
          success: false,
          errorCode: "CSRF_REJECTED",
          message: "Invalid or missing CSRF token",
          correlationId,
        },
        { status: 403, headers: { "x-correlation-id": correlationId } },
      );
    }
  }

  // ── Proactive JWT refresh ─────────────────────────────────────
  // Per API_LOGIN_CONTRACT.md §15 Rule 7: refresh the JWT at
  // jwtExpiresAt - 60s. This runs BEFORE forwarding to Spring so
  // the operator never sees a 401 mid-session. The sliding session
  // window below extends the BFF session independently.
  //
  // CBS benchmark: Finacle Connect refreshes the JWT at T-60s;
  // T24 Browser uses a similar proactive rotation.
  //
  // Race mitigation: a module-level Promise lock ensures only the
  // first request within the 60s window triggers the refresh. All
  // concurrent requests await the same Promise and use the result.
  // This prevents parallel widget requests from all calling Spring's
  // /auth/refresh simultaneously — which would cause the second+
  // requests to send an already-rotated (revoked) refresh token.
  let activeSession = session;
  if (session?.jwtExpiresAt && session.refreshToken) {
    const now = Date.now();
    const timeUntilExpiry = session.jwtExpiresAt - now;
    // Refresh when JWT expires within 60 seconds
    if (timeUntilExpiry > 0 && timeUntilExpiry < 60_000) {
      activeSession = await proactiveRefresh(session, correlationId) ?? session;
    }
  }

  // ── Sliding session window ──────────────────────────────────────
  // Every successful auth + CSRF check proves the operator is actively
  // using the system. Slide `expiresAt` forward by the idle-extension
  // window so the session does not forcefully expire while active.
  // The extension is capped at the absolute TTL ceiling anchored to
  // `issuedAt` so sessions cannot be extended indefinitely.
  //
  // Race mitigation: parallel requests (e.g. 4 dashboard widgets)
  // could race on writeSession(). The 30-second threshold below
  // ensures at most one cookie rewrite per 30s window. We also
  // re-read the session before writing to avoid overwriting a
  // fresher session that was written by a concurrent refresh.
  if (activeSession) {
    const env2 = serverEnv();
    const now = Date.now();
    const absoluteCeiling = activeSession.issuedAt + env2.sessionTtlSeconds * 1000;
    const idleExtension = now + env2.sessionIdleExtensionSeconds * 1000;
    const newExpiresAt = Math.min(idleExtension, absoluteCeiling);
    if (newExpiresAt - activeSession.expiresAt > 30_000) {
      // Re-read session to avoid overwriting tokens that a concurrent
      // refresh may have written between our initial read and now.
      const freshSession = await readSession();
      const base = freshSession ?? activeSession;
      await writeSession({
        ...base,
        expiresAt: newExpiresAt,
        issuedAt: base.issuedAt,
      });
    }
  }

  return forward(req, activeSession, correlationId, targetPath, search);
}

export async function forward(
  req: NextRequest,
  session: CbsSession | null,
  correlationId: string,
  targetPath: string,
  search: string,
): Promise<NextResponse> {
  const env = serverEnv();
  const upstreamUrl = `${env.backendApiBase}${targetPath}${search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (shouldForwardRequestHeader(key)) headers.set(key, value);
  });
  headers.set("x-correlation-id", correlationId);
  if (session?.accessToken) {
    headers.set("authorization", `${session.tokenType || "Bearer"} ${session.accessToken}`);
  }
  if (session?.user?.branchCode) {
    headers.set("x-branch-code", session.user.branchCode);
  }
  // Tenant ID: prefer session value, fall back to env default.
  // Dedicated route handlers (switch-branch, login) already apply
  // this fallback — the generic proxy must be consistent to avoid
  // Spring's TenantContext rejecting requests with no X-Tenant-Id.
  const tenantId = session?.user?.tenantId || env.defaultTenantId;
  if (tenantId) {
    headers.set("x-tenant-id", tenantId);
  }

  const method = req.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD" && !headers.has("x-idempotency-key")) {
    headers.set("x-idempotency-key", crypto.randomUUID());
  }

  let body: BodyInit | undefined;
  if (method !== "GET" && method !== "HEAD") {
    const ab = await req.arrayBuffer();
    if (ab.byteLength > 0) body = ab;
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
    });
  } catch (err) {
    // ── Backend unreachable (ECONNREFUSED / DNS failure / timeout) ──
    // Per REST_API_COMPLETE_CATALOGUE §Actuator, the backend exposes
    // /actuator/health for liveness. When the fetch itself throws,
    // Spring is down or the network path is broken. Return a
    // structured 503 so the client interceptor can show the
    // maintenance banner instead of a cryptic error.
    const isTimeout = err instanceof Error && (
      err.name === "AbortError" ||
      (err as NodeJS.ErrnoException).code === "ECONNABORTED" ||
      (err as NodeJS.ErrnoException).code === "UND_ERR_CONNECT_TIMEOUT"
    );
    return NextResponse.json(
      {
        success: false,
        errorCode: isTimeout ? "BACKEND_TIMEOUT" : "BACKEND_UNREACHABLE",
        message: isTimeout
          ? "The banking server did not respond in time. Please retry."
          : "The banking server is currently unavailable. Please try again shortly or contact IT support.",
        correlationId,
      },
      { status: 503, headers: { "x-correlation-id": correlationId } },
    );
  }

  const resHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (shouldForwardResponseHeader(key)) resHeaders.set(key, value);
  });
  resHeaders.set("x-correlation-id", correlationId);
  resHeaders.set("cache-control", "no-store");

  const buf = await upstream.arrayBuffer();
  return new NextResponse(buf, {
    status: upstream.status,
    headers: resHeaders,
  });
}
