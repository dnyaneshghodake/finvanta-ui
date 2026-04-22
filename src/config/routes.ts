/**
 * CBS Route Registry — Single Source of Truth for all navigation paths.
 * @file src/config/routes.ts
 *
 * Every route in the application MUST be defined here. Sidebar menus,
 * breadcrumbs, contextual action buttons, `router.push()` calls, and
 * audit screen codes all reference this registry instead of raw string
 * literals.
 *
 * Why this matters for a Tier-1 CBS:
 *   1. RBI IT Governance 2023 §8.5 requires screen-level audit trail.
 *      Screen codes (e.g. CASA.OPEN) are logged with every operator action.
 *   2. Route changes propagate everywhere — no grep-and-replace across
 *      50 files when a URL structure changes.
 *   3. The Sidebar MODULES array, Breadcrumb auto-generation, and
 *      role-gated contextual actions all derive from this single map.
 *   4. Prevents broken links when pages are added, renamed, or moved.
 *
 * Convention:
 *   - Static routes use `path: string`
 *   - Dynamic routes use `path: (param) => string`
 *   - `screenCode` follows MODULE.ACTION format (Finacle convention)
 *   - `roles` lists roles that can ACCESS the screen (sidebar + RoleGate)
 *   - `type` distinguishes inquiry (read-only, available during EOD)
 *     from transaction (write, blocked when day not open) screens
 *
 * CBS benchmark: Finacle screen codes (CATM, CACT, HACLI), T24 screen
 * IDs (ACCOUNT.OPENING, FUNDS.TRANSFER), FLEXCUBE function IDs.
 */

import type { UserRole } from '@/types/entities';

/* ── Role shorthand arrays ──────────────────────────────────────
 * Mirror the Sidebar.tsx role arrays. Defined here so the route
 * registry is self-contained and importable without circular deps. */
const MAKER: UserRole[] = ['MAKER', 'TELLER', 'OFFICER'];
const CHECKER: UserRole[] = ['CHECKER', 'MANAGER', 'APPROVER'];
const ADMIN: UserRole[] = ['ADMIN', 'ADMIN_HO', 'BRANCH_ADMIN'];

export type ScreenType = 'inquiry' | 'transaction' | 'admin' | 'report';

export interface RouteEntry {
  /** Static path or dynamic path builder for parameterised routes. */
  path: string | ((...args: string[]) => string);
  /** Finacle-style screen code for audit trail logging. */
  screenCode: string;
  /** Human-readable label for breadcrumbs and sidebar. */
  label: string;
  /** Roles that can access this screen. Undefined = all authenticated. */
  roles?: UserRole[];
  /** Screen type — controls day-status blocking behaviour. */
  type?: ScreenType;
  /** Parent module ID for breadcrumb auto-generation. */
  moduleId?: string;
}

/* ── Route Registry ─────────────────────────────────────────────
 * Organised by CBS module, mirroring the Sidebar MODULES structure. */

export const R = {
  dashboard: {
    home: { path: '/dashboard', screenCode: 'DASH.HOME', label: 'Dashboard', moduleId: 'dashboard' },
  },

  accounts: {
    list:          { path: '/accounts',                                            screenCode: 'CASA.INQ',   label: 'Account Inquiry',     type: 'inquiry' as ScreenType,     moduleId: 'accounts' },
    create:        { path: '/accounts/new',                                        screenCode: 'CASA.OPEN',  label: 'Open Account',        type: 'transaction' as ScreenType, moduleId: 'accounts', roles: MAKER },
    view:          { path: (id: string) => `/accounts/${id}`,                      screenCode: 'CASA.VIEW',  label: 'Account Details',     type: 'inquiry' as ScreenType,     moduleId: 'accounts' },
    statement:     { path: (id: string) => `/accounts/${id}/statement`,            screenCode: 'CASA.STMT',  label: 'Statement',           type: 'inquiry' as ScreenType,     moduleId: 'accounts' },
    freeze:        { path: '/legacy/deposit/freeze',                               screenCode: 'CASA.FRZ',   label: 'Freeze / Unfreeze',   type: 'transaction' as ScreenType, moduleId: 'accounts', roles: [...MAKER, ...CHECKER] },
    close:         { path: '/legacy/deposit/close',                                screenCode: 'CASA.CLS',   label: 'Close Account',       type: 'transaction' as ScreenType, moduleId: 'accounts', roles: MAKER },
    si:            { path: '/legacy/deposit/si',                                   screenCode: 'CASA.SI',    label: 'Standing Instructions', type: 'transaction' as ScreenType, moduleId: 'accounts', roles: MAKER },
    miniStatement: { path: '/legacy/deposit/mini-statement',                       screenCode: 'CASA.MSTMT', label: 'Mini Statement',      type: 'inquiry' as ScreenType,     moduleId: 'accounts' },
  },

  transfers: {
    internal: { path: '/transfers',                        screenCode: 'TXN.XFER', label: 'Internal Transfer', type: 'transaction' as ScreenType, moduleId: 'transfers' },
    inquiry:  { path: '/legacy/deposit/transfer-inquiry',  screenCode: 'TXN.XINQ', label: 'Transfer Inquiry',  type: 'inquiry' as ScreenType,     moduleId: 'transfers' },
    reversal: { path: '/legacy/deposit/reversal',          screenCode: 'TXN.REV',  label: 'Reversal',          type: 'transaction' as ScreenType, moduleId: 'transfers', roles: CHECKER },
  },

  deposits: {
    list:   { path: '/deposits',       screenCode: 'FD.INQ',  label: 'FD Inquiry',           type: 'inquiry' as ScreenType,     moduleId: 'deposits' },
    create: { path: '/deposits/new',   screenCode: 'FD.BOOK', label: 'Book FD',              type: 'transaction' as ScreenType, moduleId: 'deposits', roles: MAKER },
    close:  { path: '/deposits/close', screenCode: 'FD.PREM', label: 'Premature Close',      type: 'transaction' as ScreenType, moduleId: 'deposits', roles: [...MAKER, ...CHECKER] },
    lien:   { path: '/deposits/lien',  screenCode: 'FD.LIEN', label: 'Lien Mark / Release',  type: 'transaction' as ScreenType, moduleId: 'deposits', roles: [...MAKER, ...CHECKER] },
  },

  loans: {
    list:     { path: '/loans',          screenCode: 'LOAN.INQ',  label: 'Loan Inquiry',      type: 'inquiry' as ScreenType,     moduleId: 'loans' },
    apply:    { path: '/loans/apply',    screenCode: 'LOAN.APP',  label: 'Loan Application',  type: 'transaction' as ScreenType, moduleId: 'loans', roles: MAKER },
    disburse: { path: '/loans/disburse', screenCode: 'LOAN.DISB', label: 'Disbursement',      type: 'transaction' as ScreenType, moduleId: 'loans', roles: CHECKER },
    repay:    { path: '/loans/repay',    screenCode: 'LOAN.RPMT', label: 'Repayment',         type: 'transaction' as ScreenType, moduleId: 'loans', roles: MAKER },
  },

  customers: {
    search: { path: '/customers',     screenCode: 'CIF.SEARCH', label: 'Customer Search',     type: 'inquiry' as ScreenType,     moduleId: 'customers' },
    create: { path: '/customers/new', screenCode: 'CIF.CREATE', label: 'New Customer (CIF)',  type: 'transaction' as ScreenType, moduleId: 'customers', roles: MAKER },
    view:   { path: (id: string) => `/customers/${id}`, screenCode: 'CIF.VIEW', label: 'Customer Detail', type: 'inquiry' as ScreenType, moduleId: 'customers' },
    kyc:    { path: '/customers/kyc', screenCode: 'CIF.KYC',    label: 'KYC Verification',   type: 'transaction' as ScreenType, moduleId: 'customers', roles: CHECKER },
  },

  beneficiaries: {
    list: { path: '/beneficiaries', screenCode: 'BEN.LIST', label: 'Beneficiaries', moduleId: 'beneficiaries' },
  },

  workflow: {
    queue: { path: '/workflow', screenCode: 'WF.QUEUE', label: 'Workflow Queue', moduleId: 'workflow' },
  },

  reports: {
    trialBalance: { path: '/reports/trial-balance', screenCode: 'RPT.TB', label: 'Trial Balance', roles: [...CHECKER, ...ADMIN, 'AUDITOR'] as UserRole[], type: 'report' as ScreenType, moduleId: 'reports' },
    dayBook:      { path: '/reports/day-book',      screenCode: 'RPT.DB', label: 'Day Book',      roles: [...CHECKER, ...ADMIN, 'AUDITOR'] as UserRole[], type: 'report' as ScreenType, moduleId: 'reports' },
    gl:           { path: '/reports/gl',             screenCode: 'RPT.GL', label: 'GL Inquiry',    roles: [...CHECKER, ...ADMIN, 'AUDITOR'] as UserRole[], type: 'report' as ScreenType, moduleId: 'reports' },
  },

  admin: {
    tenants:  { path: '/admin/tenants',  screenCode: 'ADM.TNT',  label: 'Tenant Setup',         roles: ['ADMIN_HO'] as UserRole[], type: 'admin' as ScreenType, moduleId: 'admin' },
    branches: { path: '/admin/branches', screenCode: 'ADM.BRN',  label: 'Branch Management',    roles: ADMIN, type: 'admin' as ScreenType, moduleId: 'admin' },
    calendar: { path: '/admin/calendar', screenCode: 'ADM.CAL',  label: 'Calendar & Holidays',  roles: ADMIN, type: 'admin' as ScreenType, moduleId: 'admin' },
    users:    { path: '/admin/users',    screenCode: 'ADM.USR',  label: 'User Management',      roles: ADMIN, type: 'admin' as ScreenType, moduleId: 'admin' },
    gl:       { path: '/admin/gl',       screenCode: 'ADM.GL',   label: 'GL Chart of Accounts', roles: ['ADMIN_HO'] as UserRole[], type: 'admin' as ScreenType, moduleId: 'admin' },
    products: { path: '/admin/products', screenCode: 'ADM.PROD', label: 'Product Setup',        roles: ['ADMIN_HO'] as UserRole[], type: 'admin' as ScreenType, moduleId: 'admin' },
    charges:  { path: '/admin/charges',  screenCode: 'ADM.CHG',  label: 'Charge Setup',         roles: ['ADMIN_HO'] as UserRole[], type: 'admin' as ScreenType, moduleId: 'admin' },
    day:      { path: '/admin/day',      screenCode: 'ADM.DAY',  label: 'Day Open / Close',     roles: ADMIN, type: 'admin' as ScreenType, moduleId: 'admin' },
  },

  legacy: {
    home: { path: '/legacy', screenCode: 'LEG.HOME', label: 'Legacy Screens', moduleId: 'legacy' },
  },
} as const;

/* ── Helper: resolve path ───────────────────────────────────────
 * Static routes → string directly.
 * Dynamic routes → call with params: resolvePath(R.accounts.view, 'SB-001') */
export function resolvePath(route: RouteEntry, ...args: string[]): string {
  if (typeof route.path === 'function') {
    return route.path(...args);
  }
  return route.path;
}

/* ── Helper: build URL with query params + returnTo ─────────────
 * CBS operators frequently traverse cross-module (Customer → Account
 * Opening → Account Detail → back to Customer). Without returnTo,
 * Cancel/Back can only go to the module list, losing context.
 *
 * Usage:
 *   buildUrl('/accounts/new', { customerId: '1001' }, '/customers/1001')
 *   → '/accounts/new?customerId=1001&returnTo=%2Fcustomers%2F1001' */
export function buildUrl(
  basePath: string,
  params?: Record<string, string>,
  returnTo?: string,
): string {
  const sp = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => { if (v) sp.set(k, v); });
  }
  if (returnTo) sp.set('returnTo', returnTo);
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/* ── Helper: read returnTo from search params ───────────────────
 * Used by Cancel/Back buttons to return to the originating screen.
 * Falls back to the provided default (typically the module list). */
export function getReturnTo(
  searchParams: URLSearchParams,
  fallback: string,
): string {
  const raw = searchParams.get('returnTo');
  // Security: only allow relative paths (no open redirect)
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return fallback;
}
