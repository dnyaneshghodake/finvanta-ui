/**
 * Next.js middleware entry point.
 *
 * Next.js requires this file to be named `middleware.ts` at the
 * project root with an exported `middleware` function. The actual
 * implementation lives in proxy.ts (which was incorrectly named
 * during the Next.js 16 migration). This file re-exports from
 * proxy.ts so Next.js discovers and executes the security headers,
 * CSP nonce, and correlation-id seeding on every request.
 *
 * Per RBI IT Governance 2023 §8: CSP, HSTS, CORP, COEP, and
 * X-Content-Type-Options are mandatory on all responses.
 */
export { middleware, config } from "./proxy";
