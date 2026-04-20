/**
 * Dashboard Widget Registry — role-based widget blueprint.
 * @file src/components/dashboard/widgetRegistry.ts
 *
 * Per the backend dashboard contract, the widget endpoints are:
 *   GET /api/v1/dashboard/widgets/portfolio          → 60s refresh
 *   GET /api/v1/dashboard/widgets/npa                → 60s refresh
 *   GET /api/v1/dashboard/widgets/casa               → 60s refresh
 *   GET /api/v1/dashboard/widgets/pending-approvals   → 15s refresh
 *
 * The BFF catch-all proxy at /api/cbs/[...path] forwards
 * /dashboard/widgets/portfolio → /api/v1/dashboard/widgets/portfolio.
 *
 * Widget visibility is determined by the operator's role from the
 * bootstrap context BEFORE any data fetch (skeleton-first pattern).
 * QUICK_OPS has no backend endpoint — it's purely client-side.
 */

import type { UserRole } from '@/types/entities';

export type WidgetId =
  | 'PORTFOLIO'
  | 'NPA'
  | 'CASA'
  | 'PENDING_APPROVALS'
  | 'QUICK_OPS';

export interface WidgetDef {
  id: WidgetId;
  /** API path relative to BFF base /api/cbs (e.g. "/dashboard/widgets/portfolio"). */
  endpoint: string;
  /** Error reference code for IT support. */
  errorRef: string;
  /** Auto-refresh interval in ms. 0 = no auto-refresh. */
  refreshInterval: number;
  /** Grid span class (Tailwind). */
  gridClass: string;
  /**
   * Roles that can see this widget. Empty = all roles.
   * Per backend contract:
   *   portfolio:          MAKER, CHECKER, ADMIN, AUDITOR
   *   npa:                CHECKER, ADMIN, AUDITOR
   *   casa:               CHECKER, ADMIN, AUDITOR
   *   pending-approvals:  MAKER, CHECKER, ADMIN
   */
  roles: UserRole[];
}

/**
 * Master widget definitions per backend dashboard contract.
 * Order determines render order on the dashboard.
 */
export const WIDGET_DEFS: WidgetDef[] = [
  {
    id: 'PORTFOLIO',
    endpoint: '/dashboard/widgets/portfolio',
    errorRef: 'DSH-PORT-01',
    refreshInterval: 60_000,
    gridClass: 'col-span-full',
    roles: ['MAKER', 'CHECKER', 'ADMIN', 'AUDITOR'],
  },
  {
    id: 'NPA',
    endpoint: '/dashboard/widgets/npa',
    errorRef: 'DSH-NPA-01',
    refreshInterval: 60_000,
    gridClass: 'col-span-full',
    roles: ['CHECKER', 'ADMIN', 'AUDITOR'],
  },
  {
    id: 'CASA',
    endpoint: '/dashboard/widgets/casa',
    errorRef: 'DSH-CASA-01',
    refreshInterval: 60_000,
    gridClass: 'col-span-full',
    roles: ['CHECKER', 'ADMIN', 'AUDITOR'],
  },
  {
    id: 'PENDING_APPROVALS',
    endpoint: '/dashboard/widgets/pending-approvals',
    errorRef: 'DSH-APPR-01',
    refreshInterval: 15_000,
    gridClass: 'col-span-full',
    roles: ['MAKER', 'CHECKER', 'ADMIN'],
  },
  {
    id: 'QUICK_OPS',
    endpoint: '',
    errorRef: 'DSH-OPS-01',
    refreshInterval: 0,
    gridClass: 'col-span-full',
    roles: [],
  },
];

/**
 * Filter widgets visible to the current operator's roles.
 * Empty roles array = visible to all.
 */
export function getVisibleWidgets(userRoles: UserRole[]): WidgetDef[] {
  return WIDGET_DEFS.filter((w) =>
    w.roles.length === 0 || w.roles.some((r) => userRoles.includes(r)),
  );
}
