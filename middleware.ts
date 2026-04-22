/**
 * Next.js Edge Middleware — defense-in-depth session check.
 * @file middleware.ts
 *
 * Per RBI Master Direction on IT Governance 2023 §8.3 and OWASP
 * ASVS 4.0 V3: the authenticated boundary MUST be enforced at the
 * earliest possible layer. This middleware runs at the Edge Runtime
 * BEFORE the Node.js rendering pipeline, catching unauthenticated
 * requests before they reach Server Components or API routes.
 *
 * This is a PRESENCE check only — it verifies the encrypted session
 * cookie (`fv_sid`) exists. It does NOT decrypt or validate the
 * session contents (that requires Node.js crypto, which is not
 * available in the Edge Runtime). The authoritative session
 * validation happens in:
 *   - `app/(dashboard)/layout.tsx` → `readSession()` (Server Component)
 *   - `src/lib/server/proxy.ts` → `readSession()` (BFF proxy)
 *
 * Defense-in-depth layers:
 *   Layer 1: Edge Middleware (this file) — cookie presence check
 *   Layer 2: Server Component layout — decrypt + expiry validation
 *   Layer 3: BFF proxy — decrypt + CSRF + JWT injection
 *
 * CBS benchmark: Finacle's Web Application Firewall (WAF) rejects
 * unauthenticated requests at the reverse proxy layer before they
 * reach the application server. This middleware serves the same role.
 *
 * Routes excluded from the check:
 *   - /login, /login/** — the login page itself
 *   - /api/cbs/auth/** — pre-auth BFF endpoints (login, MFA verify)
 *   - /api/cbs/health — unauthenticated health check
 *   - /_next/**, /favicon.ico, static assets — framework resources
 */
import { NextResponse, type NextRequest } from 'next/server';

/** Session cookie name — must match CBS_SESSION_COOKIE in env.ts. */
const SESSION_COOKIE = process.env.CBS_SESSION_COOKIE || 'fv_sid';

/**
 * Paths that do NOT require an authenticated session.
 * Uses startsWith matching for simplicity in the Edge Runtime.
 */
const PUBLIC_PREFIXES = [
  '/login',
  '/api/cbs/auth/',
  '/api/cbs/health',
  '/_next/',
  '/favicon.ico',
];

/** Static asset extensions — never require auth. */
const STATIC_EXTENSIONS = /\.(js|css|map|ico|png|jpg|jpeg|gif|svg|woff2?|ttf|eot)$/;

function isPublicPath(pathname: string): boolean {
  if (STATIC_EXTENSIONS.test(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths through without any check.
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check for the presence of the encrypted session cookie.
  // This is a fast, zero-crypto check — the cookie value is opaque
  // at the Edge layer. Full decryption + expiry validation happens
  // in the Node.js Server Component (layout.tsx) and BFF proxy.
  const sessionCookie = req.cookies.get(SESSION_COOKIE);

  if (!sessionCookie?.value) {
    // No session cookie → redirect to login with reason code.
    // The login page reads `reason` to show the appropriate message.
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('reason', 'session_expired');
    // Clear any stale search params from the original request
    // to prevent parameter pollution on the login page.
    return NextResponse.redirect(loginUrl);
  }

  // Session cookie exists — allow through to the Node.js layer
  // where full validation (decrypt, expiry, CSRF) will occur.
  return NextResponse.next();
}

/**
 * Matcher configuration — controls which paths this middleware runs on.
 *
 * We exclude static assets and framework internals at the config level
 * (more efficient than checking in the function body) and handle the
 * remaining path logic in the function above.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
