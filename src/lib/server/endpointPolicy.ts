/**
 * Endpoint allow-list for the generic `/api/cbs/[...path]` BFF.
 *
 * Rationale (RBI Master Direction on IT Governance 2023 §8, NIST
 * 800-53 AC-3): the catch-all route handler in
 * `app/api/cbs/[...path]/route.ts` would otherwise forward ANY
 * browser-requested path to Spring. This widens the attack surface
 * to every controller the backend exposes — including admin or
 * debug endpoints that the UI never calls. The policy enforced here
 * is explicit: only listed `{method, pathPattern}` pairs are
 * forwarded; everything else returns `404 FORBIDDEN_ENDPOINT` with
 * a correlation id.
 *
 * Each entry is a pair of method + path pattern. The pattern is a
 * string that may contain `:segment` placeholders matching a single
 * URL segment, or a trailing `*` that matches the remainder of the
 * path. Patterns are anchored: `/accounts/:acct` does NOT match
 * `/accounts/ABC/statements`. Use `*` when a sub-tree is allowed.
 *
 * Adding a new endpoint is intentionally a CODE CHANGE: it forces a
 * maker-checker review of the surface area. Do NOT weaken this to
 * regex/env-var-driven rules without audit sign-off.
 */
import "server-only";

export type HttpMethod =
  | "GET"
  | "HEAD"
  | "OPTIONS"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE";

export interface EndpointRule {
  method: HttpMethod;
  /** Pattern relative to `/api/cbs` (i.e. without the BFF prefix). */
  pathPattern: string;
}

/**
 * The allow-list. Keep this alphabetised by the first literal
 * segment so review diffs stay readable.
 *
 * NOTE: Auth / session / CSRF flows have their own dedicated route
 * handlers (app/api/cbs/auth/**, app/api/cbs/session/**) and are NOT
 * routed through the catch-all. They do not appear here.
 */
export const ENDPOINT_ALLOWLIST: ReadonlyArray<EndpointRule> = [
  // ── Accounts ────────────────────────────────────────────────
  { method: "GET", pathPattern: "/accounts" },
  { method: "GET", pathPattern: "/accounts/:acct" },
  { method: "GET", pathPattern: "/accounts/:acct/balance" },
  { method: "GET", pathPattern: "/accounts/:acct/mini-statement" },
  { method: "GET", pathPattern: "/accounts/:acct/statement" },
  { method: "GET", pathPattern: "/accounts/:acct/transactions" },
  { method: "POST", pathPattern: "/accounts" },
  { method: "PATCH", pathPattern: "/accounts/:acct" },
  { method: "POST", pathPattern: "/accounts/:acct/freeze" },
  { method: "POST", pathPattern: "/accounts/:acct/unfreeze" },
  { method: "POST", pathPattern: "/accounts/:acct/close" },

  // ── Customers ──────────────────────────────────────────────
  { method: "GET", pathPattern: "/customers" },
  { method: "GET", pathPattern: "/customers/:id" },
  { method: "GET", pathPattern: "/customers/:id/accounts" },
  { method: "GET", pathPattern: "/customers/:id/kyc" },
  { method: "POST", pathPattern: "/customers" },
  { method: "PATCH", pathPattern: "/customers/:id" },
  { method: "POST", pathPattern: "/customers/:id/kyc" },
  { method: "POST", pathPattern: "/customers/search" },

  // ── Transfers / Payments ───────────────────────────────────
  { method: "POST", pathPattern: "/transfers/intra" },
  { method: "POST", pathPattern: "/transfers/neft" },
  { method: "POST", pathPattern: "/transfers/rtgs" },
  { method: "POST", pathPattern: "/transfers/imps" },
  { method: "POST", pathPattern: "/transfers/upi" },
  { method: "POST", pathPattern: "/transfers/:ref/confirm" },
  { method: "POST", pathPattern: "/transfers/:ref/cancel" },
  { method: "GET", pathPattern: "/transfers/:ref" },
  { method: "GET", pathPattern: "/transfers/:ref/status" },

  // ── Loans ───────────────────────────────────────────────────
  { method: "GET", pathPattern: "/loans" },
  { method: "GET", pathPattern: "/loans/:id" },
  { method: "GET", pathPattern: "/loans/:id/schedule" },
  { method: "GET", pathPattern: "/loans/:id/transactions" },
  { method: "POST", pathPattern: "/loans" },
  { method: "POST", pathPattern: "/loans/:id/disburse" },
  { method: "POST", pathPattern: "/loans/:id/repay" },

  // ── Deposits (FD/RD) ───────────────────────────────────────
  { method: "GET", pathPattern: "/deposits" },
  { method: "GET", pathPattern: "/deposits/:id" },
  { method: "POST", pathPattern: "/deposits" },
  { method: "POST", pathPattern: "/deposits/:id/close" },
  { method: "POST", pathPattern: "/deposits/:id/renew" },

  // ── Workflow (maker-checker) ───────────────────────────────
  { method: "GET", pathPattern: "/workflow/queue" },
  { method: "GET", pathPattern: "/workflow/:taskId" },
  { method: "POST", pathPattern: "/workflow/:taskId/approve" },
  { method: "POST", pathPattern: "/workflow/:taskId/reject" },

  // ── Reference data ─────────────────────────────────────────
  { method: "GET", pathPattern: "/branches" },
  { method: "GET", pathPattern: "/branches/:code" },
  { method: "GET", pathPattern: "/ifsc/:code" },
  { method: "GET", pathPattern: "/products/*" },
  { method: "GET", pathPattern: "/holidays" },
  { method: "GET", pathPattern: "/rates/*" },

  // ── Dashboards / Reports (operator) ────────────────────────
  { method: "GET", pathPattern: "/dashboard/summary" },
  { method: "GET", pathPattern: "/dashboard/widgets/*" },
  { method: "GET", pathPattern: "/reports/*" },
  { method: "POST", pathPattern: "/reports/*" },

  // ── Operator / limits / permissions (read-only) ─────────────
  { method: "GET", pathPattern: "/operator/context" },
  { method: "GET", pathPattern: "/operator/limits" },

  // ── Health check (BFF side) ─────────────────────────────────
  { method: "GET", pathPattern: "/actuator/health" },
];

/**
 * Match a single path segment against a pattern segment.
 *   - `*`          → matches anything (only valid as terminal segment)
 *   - `:foo`       → matches any single segment
 *   - literal      → exact match
 */
function segmentMatches(patternSeg: string, actualSeg: string): boolean {
  if (patternSeg.startsWith(":")) return actualSeg.length > 0;
  return patternSeg === actualSeg;
}

function patternMatches(pattern: string, path: string): boolean {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = path.split("/").filter(Boolean);

  for (let i = 0; i < patternParts.length; i += 1) {
    const p = patternParts[i];
    if (p === "*") {
      // Wildcard tail matches any remaining segments (including zero).
      return true;
    }
    const a = pathParts[i];
    if (a === undefined) return false;
    if (!segmentMatches(p, a)) return false;
  }
  return pathParts.length === patternParts.length;
}

/**
 * Evaluate the allow-list for a given method + catch-all path.
 *
 * @param method  Uppercase HTTP method (GET/POST/...).
 * @param path    Path relative to `/api/cbs` — e.g. `/accounts/SB-HQ001-000001/balance`.
 * @returns `true` when the combination is explicitly allowed.
 */
export function isEndpointAllowed(method: string, path: string): boolean {
  const m = method.toUpperCase() as HttpMethod;
  // Treat HEAD as GET for allow-list purposes — safe methods only.
  const lookupMethod: HttpMethod = m === "HEAD" ? "GET" : m;
  for (const rule of ENDPOINT_ALLOWLIST) {
    if (rule.method !== lookupMethod) continue;
    if (patternMatches(rule.pathPattern, path)) return true;
  }
  return false;
}
