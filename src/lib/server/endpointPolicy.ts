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
  // ── Accounts (deposit / CASA) ──────────────────────────────
  // Paths below match the actual calls in `src/services/api/
  // accountService.ts` and the account-related pages under
  // `app/(dashboard)/accounts/`.
  { method: "GET", pathPattern: "/accounts" },
  { method: "GET", pathPattern: "/accounts/:acct" },
  { method: "GET", pathPattern: "/accounts/:acct/balance" },
  { method: "GET", pathPattern: "/accounts/:acct/mini-statement" },
  { method: "GET", pathPattern: "/accounts/:acct/statement" },
  { method: "GET", pathPattern: "/accounts/:acct/transactions" },
  { method: "GET", pathPattern: "/accounts/customer/:id" },
  { method: "POST", pathPattern: "/accounts/open" },
  { method: "POST", pathPattern: "/accounts/transfer" },
  { method: "PATCH", pathPattern: "/accounts/:acct" },
  { method: "POST", pathPattern: "/accounts/:acct/freeze" },
  { method: "POST", pathPattern: "/accounts/:acct/activate" },
  { method: "POST", pathPattern: "/accounts/:acct/unfreeze" },

  // ── Customers (CIF) ────────────────────────────────────────
  { method: "GET", pathPattern: "/customers" },
  { method: "GET", pathPattern: "/customers/:id" },
  { method: "GET", pathPattern: "/customers/:id/accounts" },
  { method: "GET", pathPattern: "/customers/:id/kyc" },
  { method: "POST", pathPattern: "/customers" },
  { method: "PATCH", pathPattern: "/customers/:id" },
  { method: "POST", pathPattern: "/customers/:id/verify-kyc" },
  { method: "POST", pathPattern: "/customers/search" },

  // ── Loans ───────────────────────────────────────────────────
  { method: "GET", pathPattern: "/loans" },
  { method: "GET", pathPattern: "/loans/active" },
  { method: "GET", pathPattern: "/loans/:id" },
  { method: "GET", pathPattern: "/loans/:id/schedule" },
  { method: "GET", pathPattern: "/loans/:id/transactions" },
  { method: "POST", pathPattern: "/loans" },
  { method: "POST", pathPattern: "/loans/:id/disburse" },
  { method: "POST", pathPattern: "/loans/:id/repay" },
  // Loan origination flow (loan-applications entity is distinct
  // from disbursed loans — applications are pre-sanction).
  { method: "POST", pathPattern: "/loan-applications" },

  // ── Fixed Deposits (FD) ────────────────────────────────────
  // The UI currently calls these endpoints directly (see the
  // `/deposits` pages). Historic `/deposits/*` patterns are kept
  // below for the RD/TD flows that route through the same
  // surface on Spring.
  { method: "GET", pathPattern: "/fixed-deposits" },
  { method: "GET", pathPattern: "/fixed-deposits/active" },
  { method: "GET", pathPattern: "/fixed-deposits/:id" },
  { method: "POST", pathPattern: "/fixed-deposits/book" },
  { method: "POST", pathPattern: "/fixed-deposits/:id/premature-close" },
  { method: "POST", pathPattern: "/fixed-deposits/:id/lien/:action" },

  // ── Deposits (generic FD/RD/TD — legacy path) ──────────────
  { method: "GET", pathPattern: "/deposits" },
  { method: "GET", pathPattern: "/deposits/:id" },
  { method: "POST", pathPattern: "/deposits" },
  { method: "POST", pathPattern: "/deposits/:id/close" },
  { method: "POST", pathPattern: "/deposits/:id/renew" },

  // ── Workflow (maker-checker) ───────────────────────────────
  // Actual endpoints exposed by `workflowService.ts`. Path
  // parameter is named `:id` (numeric workflow-item id); keep
  // the naming aligned with the service so review is easier.
  { method: "GET", pathPattern: "/workflow/pending" },
  { method: "GET", pathPattern: "/workflow/mine" },
  { method: "GET", pathPattern: "/workflow/sla-breached" },
  { method: "GET", pathPattern: "/workflow/:id" },
  { method: "GET", pathPattern: "/workflow/history/:entityType/:entityId" },
  { method: "POST", pathPattern: "/workflow/escalate" },
  { method: "POST", pathPattern: "/workflow/:id/approve" },
  { method: "POST", pathPattern: "/workflow/:id/reject" },
  { method: "POST", pathPattern: "/workflow/:id/recall" },

  // ── Admin surface (RBAC-gated server-side) ─────────────────
  { method: "GET", pathPattern: "/admin/users" },
  { method: "GET", pathPattern: "/admin/users/:id" },
  { method: "POST", pathPattern: "/admin/users" },
  { method: "PUT", pathPattern: "/admin/users/:id" },
  { method: "POST", pathPattern: "/admin/users/:id/reset-password" },
  { method: "POST", pathPattern: "/admin/users/:id/lock" },
  { method: "POST", pathPattern: "/admin/users/:id/unlock" },
  { method: "GET", pathPattern: "/admin/branches" },
  { method: "GET", pathPattern: "/admin/branches/:id" },
  { method: "POST", pathPattern: "/admin/branches" },
  { method: "PUT", pathPattern: "/admin/branches/:id" },
  { method: "GET", pathPattern: "/admin/calendar/holidays" },
  { method: "POST", pathPattern: "/admin/calendar/holidays" },
  { method: "DELETE", pathPattern: "/admin/calendar/holidays/:id" },
  { method: "GET", pathPattern: "/admin/tenant" },
  { method: "PUT", pathPattern: "/admin/tenant" },

  // ── General Ledger (read-only UI surfaces) ─────────────────
  { method: "GET", pathPattern: "/gl/chart-of-accounts" },
  { method: "GET", pathPattern: "/gl/trial-balance" },

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
