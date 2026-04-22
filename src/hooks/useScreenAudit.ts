/**
 * Screen-access audit logging hook for CBS Banking Application.
 * @file src/hooks/useScreenAudit.ts
 *
 * Per RBI Master Direction on IT Governance 2023 §8.5:
 *   "Every screen access by an operator shall be logged with
 *    timestamp, operator ID, branch code, and screen code."
 *
 * This hook fires a POST to the backend audit endpoint on every
 * client-side route navigation. The backend is the authoritative
 * store — this hook is fire-and-forget; failures are logged but
 * never block the operator.
 *
 * CBS benchmark: Tier-1 CBS platforms log every screen open with
 * a function code, operator ID, branch code, and timestamp.
 *
 * The hook resolves the screen code from the route registry
 * (src/config/routes.ts) by matching the current pathname against
 * all registered route paths. Dynamic routes (e.g. /accounts/:id)
 * are matched by prefix.
 */
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { R, type RouteEntry } from '@/config/routes';
import { logger } from '@/utils/logger';

/**
 * Flatten the route registry into a list of { path, screenCode }
 * pairs for matching. Built once at module load.
 */
interface FlatRoute {
  /** Static path string or prefix for dynamic routes. */
  pathOrPrefix: string;
  /** Whether this is a dynamic route (function path). */
  isDynamic: boolean;
  screenCode: string;
  label: string;
}

function buildFlatRoutes(): FlatRoute[] {
  const flat: FlatRoute[] = [];
  for (const group of Object.values(R)) {
    for (const entry of Object.values(group)) {
      const e = entry as RouteEntry;
      if (typeof e.path === 'string') {
        flat.push({
          pathOrPrefix: e.path,
          isDynamic: false,
          screenCode: e.screenCode,
          label: e.label,
        });
      } else if (typeof e.path === 'function') {
        // For dynamic routes like (id) => `/accounts/${id}`, we
        // derive the prefix by calling with a sentinel and taking
        // the portion before the sentinel. E.g. `/accounts/`.
        const sentinel = '__SENTINEL__';
        const resolved = e.path(sentinel);
        const prefix = resolved.split(sentinel)[0];
        flat.push({
          pathOrPrefix: prefix,
          isDynamic: true,
          screenCode: e.screenCode,
          label: e.label,
        });
      }
    }
  }
  // Sort by path length descending so more specific routes match first.
  // E.g. /accounts/new (static) should match before /accounts/ (dynamic prefix).
  flat.sort((a, b) => b.pathOrPrefix.length - a.pathOrPrefix.length);
  return flat;
}

const FLAT_ROUTES = buildFlatRoutes();

/**
 * Resolve the screen code for a given pathname.
 * Returns null if no matching route is found (e.g. 404 pages).
 */
function resolveScreenCode(pathname: string): { screenCode: string; label: string } | null {
  for (const route of FLAT_ROUTES) {
    if (route.isDynamic) {
      if (pathname.startsWith(route.pathOrPrefix)) return route;
    } else {
      if (pathname === route.pathOrPrefix) return route;
    }
  }
  return null;
}

/**
 * Fire-and-forget audit log to the backend.
 * Uses raw fetch (not apiClient) to avoid circular dependency
 * with the response interceptor and to ensure the audit call
 * does not trigger its own audit recursion.
 */
/**
 * Read the CSRF token from the fv_csrf cookie.
 * Duplicated from apiClient.ts readCsrfFromCookie() to avoid
 * importing apiClient (which would trigger audit recursion via
 * the response interceptor).
 */
function readCsrf(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)fv_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function emitScreenAccess(
  screenCode: string,
  screenLabel: string,
  pathname: string,
): Promise<void> {
  try {
    const csrf = readCsrf();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (csrf) headers['X-CSRF-Token'] = csrf;

    const res = await fetch('/api/cbs/audit/screen-access', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        screenCode,
        screenLabel,
        pathname,
        timestamp: new Date().toISOString(),
      }),
    });
    // fetch() does not throw on HTTP errors — check status explicitly.
    if (!res.ok) {
      logger.debug(`[SCREEN_AUDIT] HTTP ${res.status} for ${screenCode}`);
    }
  } catch {
    // Fire-and-forget: audit failures must never block the operator.
    // The server-side BFF proxy will also log the request via
    // correlation ID, providing a secondary audit trail.
    logger.debug(`[SCREEN_AUDIT] Failed to emit screen access for ${screenCode}`);
  }
}

/**
 * Hook: logs screen access to the backend audit endpoint on every
 * route navigation. Must be mounted once in the DashboardShell.
 *
 * The hook deduplicates consecutive navigations to the same pathname
 * (e.g. React StrictMode double-renders, query-param-only changes).
 */
export function useScreenAudit(): void {
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (pathname === lastPathRef.current) return;
    lastPathRef.current = pathname;

    const match = resolveScreenCode(pathname);
    if (!match) return;

    void emitScreenAccess(match.screenCode, match.label, pathname);
  }, [pathname, isAuthenticated]);
}
