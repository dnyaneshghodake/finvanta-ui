/**
 * Root middleware — security headers, CSP nonce, correlation-id seeding.
 *
 * Per RBI Master Direction on Information Technology Governance 2023 §8
 * and OWASP 2024, every HTML response from a Tier-1 banking portal must
 * carry: Strict-Transport-Security, Content-Security-Policy with a
 * per-request nonce, Referrer-Policy, Permissions-Policy,
 * X-Content-Type-Options, COOP, COEP, and CORP.
 *
 * The middleware also seeds an X-Correlation-Id header on every server-
 * handled request so route handlers, server components, and the BFF
 * proxy all share the same trace id. Browsers don't (and can't) set this
 * header; it is server-generated per request and echoed on the response.
 */
import { NextRequest, NextResponse } from "next/server";

const CORRELATION_HEADER = "x-correlation-id";
const NONCE_HEADER = "x-cbs-csp-nonce";

/**
 * Accept only well-formed correlation ids (16-64 chars, alphanumeric
 * and dashes). Reject anything else to prevent log-forging and CRLF
 * injection via a forwarded header.
 */
const CORRELATION_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

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
    `frame-src ${self}`,
    `upgrade-insecure-requests`,
  ].join("; ");
}

export function proxy(req: NextRequest): NextResponse {
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
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set(
    "Permissions-Policy",
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  );
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
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
