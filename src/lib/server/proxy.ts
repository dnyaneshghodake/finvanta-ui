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

  // ── Sliding-window session extension ────────────────────────────
  // Every authenticated API call through the BFF resets the idle
  // clock on the server-side session. Without this, the session blob's
  // `expiresAt` (set from the JWT's `expiresIn` at login, typically
  // 900s) would expire even while the operator is actively using the
  // system — the client-side `useSessionTimeout` tracks inactivity
  // for the warning UX, but the server cookie must independently
  // stay alive for the same window.
  //
  // The new `expiresAt` is capped at the absolute TTL ceiling
  // (issuedAt + sessionTtlSeconds) so an active user cannot extend
  // indefinitely. This mirrors the logic in the explicit
  // `/api/cbs/session/extend` route but runs transparently on every
  // proxied call.
  if (session) {
    const env2 = serverEnv();
    const now = Date.now();
    const absoluteCeiling = session.issuedAt + env2.sessionTtlSeconds * 1000;
    const idleExtension = now + env2.sessionIdleExtensionSeconds * 1000;
    const newExpiresAt = Math.min(idleExtension, absoluteCeiling);

    // Only write if the extension is meaningful (>30s gain) to avoid
    // re-encrypting + re-setting cookies on every single request when
    // the operator is clicking rapidly.
    if (newExpiresAt - session.expiresAt > 30_000) {
      await writeSession({
        ...session,
        expiresAt: newExpiresAt,
        issuedAt: session.issuedAt,
        csrfToken: session.csrfToken,
      });
    }
  }

  return forward(req, session, correlationId, targetPath, search);
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
