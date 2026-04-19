/**
 * Dashboard Widget Registry — role-based widget blueprint.
 * @file src/components/dashboard/widgetRegistry.ts
 *
 * Tier-1 CBS pattern: the widget layout is determined by the
 * operator's role BEFORE any data fetch. This ensures:
 *   ✔ No unauthorized widget visible (zero-trust UI)
 *   ✔ Layout determined before data fetch (skeleton-first)
 *   ✔ Zero flicker of hidden data
 *
 * Widget IDs map to components in the dashboard page.
 * Refresh intervals follow CBS operational cadence:
 *   - Approval queue: 15s (teller workflow driver)
 *   - Cash/txn position: 30s
 *   - GL/portfolio: 60s
 *   - Announcements: 120s (regulatory, infrequent)
 */

import type { UserRole } from '@/types/entities';

export type WidgetId =
  | 'LAST_LOGIN'
  | 'ANNOUNCEMENTS'
  | 'KPI_TXN_SUMMARY'
  | 'KPI_PORTFOLIO'
  | 'WORKFLOW_ALERTS'
  | 'QUICK_OPS';

export interface WidgetDef {
  id: WidgetId;
  /** API endpoint for this widget's data. */
  endpoint: string;
  /** Error reference code for IT support. */
  errorRef: string;
  /** Auto-refresh interval in ms. 0 = no auto-refresh. */
  refreshInterval: number;
  /** Grid span class (Tailwind). */
  gridClass: string;
  /** Minimum roles required (ANY match). Empty = all roles. */
  roles: UserRole[];
}

/**
 * Master widget definitions.
 * Order determines render order on the dashboard.
 */
export const WIDGET_DEFS: WidgetDef[] = [
  {
    id: 'LAST_LOGIN',
    endpoint: '/dashboard/last-login',
    errorRef: 'DSH-LOGIN-01',
    refreshInterval: 0,
    gridClass: 'col-span-full',
    roles: [], // All roles
  },
  {
    id: 'ANNOUNCEMENTS',
    endpoint: '/dashboard/announcements',
    errorRef: 'DSH-ANN-01',
    refreshInterval: 120_000,
    gridClass: 'col-span-full',
    roles: [], // All roles
  },
  {
    id: 'KPI_TXN_SUMMARY',
    endpoint: '/dashboard/txn-summary',
    errorRef: 'DSH-TXN-01',
    refreshInterval: 30_000,
    gridClass: 'col-span-full',
    roles: [], // All roles see txn summary
  },
  {
    id: 'KPI_PORTFOLIO',
    endpoint: '/dashboard/portfolio',
    errorRef: 'DSH-PORT-01',
    refreshInterval: 60_000,
    gridClass: 'col-span-full',
    roles: ['MANAGER', 'ADMIN_HO', 'AUDITOR', 'CHECKER', 'APPROVER'],
  },
  {
    id: 'WORKFLOW_ALERTS',
    endpoint: '/dashboard/workflow-alerts',
    errorRef: 'DSH-WF-01',
    refreshInterval: 15_000,
    gridClass: 'col-span-full',
    roles: [], // All roles see workflow counts
  },
  {
    id: 'QUICK_OPS',
    endpoint: '', // No API — purely role-driven static links
    errorRef: 'DSH-OPS-01',
    refreshInterval: 0,
    gridClass: 'col-span-full',
    roles: [], // All roles (individual ops are role-gated inside)
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
