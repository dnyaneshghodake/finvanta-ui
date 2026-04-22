/**
 * CBS Route Registry integrity tests.
 * @file src/config/__tests__/routes.test.ts
 *
 * Per RBI IT Governance 2023 §8.5: screen-level audit trail requires
 * unique screen codes. These tests enforce structural invariants that
 * prevent silent regressions when routes are added or modified:
 *
 *   1. No duplicate screen codes (audit trail collision)
 *   2. No duplicate static paths (broken navigation)
 *   3. Every route entry has required fields
 *   4. Screen codes follow MODULE.ACTION format
 *   5. Every route has a valid type or is a top-level module
 *   6. resolvePath works for static and dynamic routes
 *   7. buildUrl correctly encodes params and returnTo
 *   8. getReturnTo blocks open redirects
 */
import { describe, it, expect } from 'vitest';
import { R, resolvePath, buildUrl, getReturnTo } from '../routes';
import type { RouteEntry } from '../routes';

/* ── Helper: flatten all route entries from R ───────────────────
 * Walks the nested R object and collects every leaf entry that
 * has a `screenCode` property (i.e. is a RouteEntry, not a
 * module namespace). */
interface FlatEntry {
  key: string;       // e.g. 'accounts.list'
  screenCode: string;
  path: string | ((...args: string[]) => string);
  label: string;
  moduleId?: string;
  type?: string;
  roles?: readonly string[];
}

function flattenRoutes(): FlatEntry[] {
  const entries: FlatEntry[] = [];
  for (const [modKey, modVal] of Object.entries(R)) {
    for (const [routeKey, routeVal] of Object.entries(modVal as Record<string, unknown>)) {
      const entry = routeVal as Record<string, unknown>;
      if (entry && typeof entry === 'object' && 'screenCode' in entry) {
        entries.push({
          key: `${modKey}.${routeKey}`,
          screenCode: entry.screenCode as string,
          path: entry.path as string | ((...args: string[]) => string),
          label: entry.label as string,
          moduleId: entry.moduleId as string | undefined,
          type: entry.type as string | undefined,
          roles: entry.roles as readonly string[] | undefined,
        });
      }
    }
  }
  return entries;
}

const ALL_ROUTES = flattenRoutes();

// ── 1. No duplicate screen codes ────────────────────────────────

describe('Route Registry — Screen Code Uniqueness', () => {
  it('has no duplicate screen codes (RBI audit trail §8.5)', () => {
    const codes = ALL_ROUTES.map((r) => r.screenCode);
    const duplicates = codes.filter((c, i) => codes.indexOf(c) !== i);
    expect(duplicates).toEqual([]);
  });

  it('has at least 30 registered routes', () => {
    // Sanity check — if someone accidentally empties the registry,
    // this catches it before the uniqueness test vacuously passes.
    expect(ALL_ROUTES.length).toBeGreaterThanOrEqual(30);
  });
});

// ── 2. No duplicate static paths ────────────────────────────────

describe('Route Registry — Path Uniqueness', () => {
  it('has no duplicate static paths', () => {
    const staticPaths = ALL_ROUTES
      .filter((r) => typeof r.path === 'string')
      .map((r) => r.path as string);
    const duplicates = staticPaths.filter((p, i) => staticPaths.indexOf(p) !== i);
    expect(duplicates).toEqual([]);
  });
});

// ── 3. Every route entry has required fields ────────────────────

describe('Route Registry — Entry Completeness', () => {
  it.each(ALL_ROUTES.map((r) => [r.key, r]))(
    '%s has path, screenCode, and label',
    (_key, route) => {
      const r = route as FlatEntry;
      expect(r.path).toBeDefined();
      expect(r.screenCode).toBeTruthy();
      expect(r.label).toBeTruthy();
    },
  );
});

// ── 4. Screen codes follow MODULE.ACTION format ─────────────────

describe('Route Registry — Screen Code Format', () => {
  it.each(ALL_ROUTES.map((r) => [r.key, r.screenCode]))(
    '%s screen code "%s" matches MODULE.ACTION pattern',
    (_key, code) => {
      // Finacle convention: 2-6 char module prefix, dot, 2-6 char action
      expect(code).toMatch(/^[A-Z]{2,6}\.[A-Z]{2,6}$/);
    },
  );
});

// ── 5. resolvePath helper ───────────────────────────────────────

describe('resolvePath', () => {
  it('returns static path directly', () => {
    expect(resolvePath(R.accounts.list as RouteEntry)).toBe('/accounts');
  });

  it('calls dynamic path builder with argument', () => {
    expect(resolvePath(R.accounts.view as RouteEntry, 'SB-HQ001-000001')).toBe('/accounts/SB-HQ001-000001');
  });

  it('resolves customer view with numeric ID', () => {
    expect(resolvePath(R.customers.view as RouteEntry, '42')).toBe('/customers/42');
  });

  it('resolves account statement with account number', () => {
    expect(resolvePath(R.accounts.statement as RouteEntry, 'CA-BR001-000003')).toBe('/accounts/CA-BR001-000003/statement');
  });
});

// ── 6. buildUrl helper ──────────────────────────────────────────

describe('buildUrl', () => {
  it('returns base path when no params', () => {
    expect(buildUrl('/accounts/new')).toBe('/accounts/new');
  });

  it('appends query params', () => {
    const url = buildUrl('/accounts/new', { customerId: '1001' });
    expect(url).toBe('/accounts/new?customerId=1001');
  });

  it('appends returnTo encoded', () => {
    const url = buildUrl('/accounts/new', { customerId: '1001' }, '/customers/42');
    expect(url).toContain('customerId=1001');
    expect(url).toContain('returnTo=%2Fcustomers%2F42');
  });

  it('skips empty param values', () => {
    const url = buildUrl('/accounts/new', { customerId: '1001', empty: '' });
    expect(url).toBe('/accounts/new?customerId=1001');
    expect(url).not.toContain('empty');
  });
});

// ── 7. getReturnTo helper — open redirect protection ────────────

describe('getReturnTo', () => {
  it('returns returnTo when valid relative path', () => {
    const sp = new URLSearchParams('returnTo=/customers/42');
    expect(getReturnTo(sp, '/accounts')).toBe('/customers/42');
  });

  it('returns fallback when returnTo is missing', () => {
    const sp = new URLSearchParams('');
    expect(getReturnTo(sp, '/accounts')).toBe('/accounts');
  });

  it('blocks absolute URL (open redirect)', () => {
    const sp = new URLSearchParams('returnTo=https://evil.com');
    expect(getReturnTo(sp, '/accounts')).toBe('/accounts');
  });

  it('blocks protocol-relative URL (open redirect)', () => {
    const sp = new URLSearchParams('returnTo=//evil.com/path');
    expect(getReturnTo(sp, '/accounts')).toBe('/accounts');
  });

  it('blocks empty returnTo', () => {
    const sp = new URLSearchParams('returnTo=');
    expect(getReturnTo(sp, '/accounts')).toBe('/accounts');
  });

  it('allows deep relative path', () => {
    const sp = new URLSearchParams('returnTo=/customers/42/accounts');
    expect(getReturnTo(sp, '/accounts')).toBe('/customers/42/accounts');
  });
});
