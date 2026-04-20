/**
 * Root proxy — security headers, CSP nonce, host allow-list,
 * request-size ceiling, correlation-id seeding.
 *
 * Next.js 16 uses `proxy.ts` at the project root with an exported
 * `proxy` function. The old `middleware.ts` convention is deprecated.
 * See: https://nextjs.org/docs/messages/middleware-to-proxy
 *
 * Per RBI Master Direction on Information Technology Governance 2023
 * §8 and OWASP 2024, every HTML response from a Tier-1 banking
 * portal must carry Strict-Transport-Security, Content-Security-
 * Policy with a per-request nonce, Referrer-Policy, Permissions-
 * Policy, X-Content-Type-Options, COOP, COEP, and CORP. The proxy
 * also:
 *
 *   - Enforces a `Host` header allow-list so host-header injection
 *     cannot redirect the UI to an attacker-controlled origin.
 *   - Rejects requests larger than 1 MiB on non-upload routes so a
 *     malicious caller cannot exhaust server memory. Upload-capable
 *     routes (currently none on the BFF surface) are declared
 *     explicitly in `UPLOAD_PATH_PREFIXES`.
 *   - Seeds an `X-Correlation-Id` header on every server-handled
 *     request so route handlers, server components, and the BFF
 *     reverse-proxy all share the same trace id.
 *
 * NOTE: This file is NOT the same as `src/lib/server/proxy.ts` which
 * is the BFF reverse-proxy to Spring. This is the Next.js entry-point
 * convention file for request interception (formerly `middleware.ts`).
 */
import { NextRequest, NextResponse } from "next/server";

const CORRELATION_HEADER = "x-correlation-id";
const NONCE_HEADER = "x-cbs-csp-nonce";

const CORRELATION_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

/**
 * Maximum body size for non-upload routes.
 * 1 MiB matches the Spring API ceiling and covers any JSON payload
 * the CBS surface emits (a large transaction-history page is ~250 KB).
 */
const BODY_SIZE_CEILING_BYTES = 1024 * 1024;

/**
 * Path prefixes that are allowed to carry bodies larger than the
 * generic ceiling. Reserved for future document-upload / statement
 * import endpoints. Keep this list as short as possible.
 */
const UPLOAD_PATH_PREFIXES: readonly string[] = [
  // Reserved for future /api/cbs/documents/upload, /api/cbs/imports/*, etc.
];

/**
 * Host header allow-list. Populated from CBS_ALLOWED_HOSTS
 * (comma-separated). In development we allow the typical localhost
 * variants so `next dev` and Playwright still work. In production
 * the env var MUST be set — otherwise we fall back to a permissive
 * same-origin heuristic that only logs, matching Next.js' default
 * behaviour of trusting the incoming `Host`.
 */
function getAllowedHosts(): Set<string> {
  const raw = process.env.CBS_ALLOWED_HOSTS;
  const entries = (raw ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h.length > 0);
  if (entries.length === 0) {
    // Dev fallback — these are the Hosts Playwright and next dev use.
    return new Set([
      "localhost",
      "localhost:3000",
      "127.0.0.1",
      "127.0.0.1:3000",
      "0.0.0.0",
      "0.0.0.0:3000",
    ]);
  }
  return new Set(entries);
}

function isUploadPath(pathname: string): boolean {
  return UPLOAD_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

function generateCorrelationId(): string {
  return crypto.randomUUID();
}

function buildCsp(nonce: string, isDev: boolean): string {
  const self = "'self'";
  const nonceDirective = `'nonce-${nonce}'`;
  const scriptSrc = [self, nonceDirective, "'strict-dynamic'"];
  if (isDev) {
    scriptSrc.push("'unsafe-eval'");
  }
  return [
    `default-src ${self}`,
    `base-uri ${self}`,
    `frame-ancestors 'none'`,
    `form-action ${self}`,
    `object-src 'none'`,
    `img-src ${self} data: blob:`,
    `font-src ${self} data:`,
    `style-src ${self} 'unsafe-inline'`,
    `script-src ${scriptSrc.join(" ")}`,
    `connect-src ${self}`,
    `worker-src ${self} blob:`,
    `manifest-src ${self}`,
    `frame-src 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");
}

/**
 * Reject requests whose `Host` header is not in the allow-list. This
 * runs BEFORE auth checks so an attacker cannot use host-header
 * spoofing to trigger SSRF / password-reset-token leaks.
 *
 * Returns `null` when the request should proceed, or a pre-built
 * `NextResponse` (400) when it should be rejected.
 */
function enforceHostAllowList(req: NextRequest): NextResponse | null {
  const allowed = getAllowedHosts();
  const host = (req.headers.get("host") ?? "").toLowerCase();
  if (host && !allowed.has(host)) {
    return new NextResponse(
      JSON.stringify({
        success: false,
        errorCode: "HOST_REJECTED",
        message: "Host header not in allow-list",
      }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      },
    );
  }
  return null;
}

/**
 * Reject requests whose `Content-Length` exceeds the generic body
 * ceiling on non-upload routes.
 */
function enforceBodyCeiling(req: NextRequest): NextResponse | null {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }
  if (isUploadPath(req.nextUrl.pathname)) {
    return null;
  }
  const cl = req.headers.get("content-length");
  if (!cl) return null;
  const parsed = Number(cl);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  if (parsed > BODY_SIZE_CEILING_BYTES) {
    return new NextResponse(
      JSON.stringify({
        success: false,
        errorCode: "PAYLOAD_TOO_LARGE",
        message: `Request body exceeds ${BODY_SIZE_CEILING_BYTES} bytes`,
      }),
      {
        status: 413,
        headers: { "content-type": "application/json" },
      },
    );
  }
  return null;
}

export function proxy(req: NextRequest): NextResponse {
  const hostReject = enforceHostAllowList(req);
  if (hostReject) return hostReject;

  const bodyReject = enforceBodyCeiling(req);
  if (bodyReject) return bodyReject;

  const isDev = process.env.NODE_ENV !== "production";
  const nonce = generateNonce();

  const forwardedCorrelation = req.headers.get(CORRELATION_HEADER);
  const correlationId =
    forwardedCorrelation && CORRELATION_PATTERN.test(forwardedCorrelation)
      ? forwardedCorrelation
      : generateCorrelationId();

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(NONCE_HEADER, nonce);
  requestHeaders.set(CORRELATION_HEADER, correlationId);

  const res = NextResponse.next({ request: { headers: requestHeaders } });

  res.headers.set("Content-Security-Policy", buildCsp(nonce, isDev));
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // DENY (not SAMEORIGIN) — a banking UI must never be framed.
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set(
    "Permissions-Policy",
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  );
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("Cross-Origin-Embedder-Policy", "credentialless");
  res.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  if (!isDev) {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }
  res.headers.set(CORRELATION_HEADER, correlationId);
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public|assets).*)",
  ],
};
