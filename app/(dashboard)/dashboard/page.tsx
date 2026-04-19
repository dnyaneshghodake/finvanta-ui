'use client';

/**
 * FINVANTA CBS — Branch Operations Dashboard (Tier-1 Grade)
 *
 * Progressive Secure Hydration with Role-Based Skeleton Layout:
 *   1. Page renders immediately — layout + skeletons first.
 *   2. Widget grid is determined by operator role BEFORE data fetch.
 *   3. Each widget fetches independently in parallel.
 *   4. Failed widgets do NOT break the dashboard.
 *   5. Background refresh is silent (no loading flash).
 *   6. Zero CLS — skeleton dimensions match real content.
 *   7. No blank white screens ever.
 *
 * CBS keyboard shortcuts:  F2 = Transfer   F5 = Refresh (page reload)
 */

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Breadcrumb } from '@/components/cbs';
import { formatCbsDate } from '@/utils/formatters';
import { useCbsKeyboard } from '@/hooks/useCbsKeyboard';
import {
  getVisibleWidgets,
  LastLoginWidget,
  AnnouncementsWidget,
  TxnSummaryWidget,
  PortfolioWidget,
  WorkflowAlertsWidget,
  QuickOpsWidget,
  QuickOpsSkeleton,
} from '@/components/dashboard';
import type { WidgetDef } from '@/components/dashboard';

// Per API_REFERENCE.md §2.1: dayStatus values are
// DAY_OPEN, EOD_RUNNING, DAY_CLOSED, NOT_OPENED.
const DAY_STATUS_TONE: Record<string, string> = {
  OPEN: 'text-cbs-olive-700 bg-cbs-olive-50',
  CLOSED: 'text-cbs-crimson-700 bg-cbs-crimson-50',
  DAY_OPEN: 'text-cbs-olive-700 bg-cbs-olive-50',
  DAY_CLOSED: 'text-cbs-crimson-700 bg-cbs-crimson-50',
  EOD_RUNNING: 'text-cbs-gold-700 bg-cbs-gold-50',
  EOD_IN_PROGRESS: 'text-cbs-gold-700 bg-cbs-gold-50',
  NOT_OPENED: 'text-cbs-crimson-700 bg-cbs-crimson-50',
};

/** Maps widget ID → component. QUICK_OPS has no API fetch. */
function renderWidget(def: WidgetDef) {
  switch (def.id) {
    case 'LAST_LOGIN': return <LastLoginWidget key={def.id} def={def} />;
    case 'ANNOUNCEMENTS': return <AnnouncementsWidget key={def.id} def={def} />;
    case 'KPI_TXN_SUMMARY': return <TxnSummaryWidget key={def.id} def={def} />;
    case 'KPI_PORTFOLIO': return <PortfolioWidget key={def.id} def={def} />;
    case 'WORKFLOW_ALERTS': return <WorkflowAlertsWidget key={def.id} def={def} />;
    case 'QUICK_OPS': return <QuickOpsWidget key={def.id} />;
    default: return null;
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const businessDate = useAuthStore((s) => s.businessDate);
  const businessDay = useAuthStore((s) => s.businessDay);

  // ── Role-based widget blueprint (Step 1) ──────────────────────
  // Layout is determined by role BEFORE any data fetch.
  // Unauthorized widgets are never rendered — zero-trust UI.
  const visibleWidgets = useMemo(
    () => getVisibleWidgets(user?.roles ?? []),
    [user?.roles],
  );

  // CBS keyboard shortcuts
  const shortcuts = useMemo(() => ({
    F2: () => router.push('/transfers'),
    F5: () => { window.location.reload(); },
  }), [router]);
  useCbsKeyboard(shortcuts);

  const displayName = user?.firstName || user?.username || 'Operator';
  const dayStatus = businessDay?.dayStatus || null;

  // ── Step 2: Render layout + role-based skeleton grid immediately ──
  // Navigation, header, and day-status render from session state (no API).
  // Widget grid renders skeletons that match real content dimensions.
  return (
    <div className="space-y-4">
      <Breadcrumb items={[{ label: 'Dashboard' }]} />

      {/* ── Page Header with Day Status (from session, no API) ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-cbs-ink">Branch Operations Dashboard</h1>
          <p className="text-xs text-cbs-steel-600 mt-0.5">
            Welcome, {displayName}.
            <span className="cbs-kbd ml-3">F2</span> Transfer
            <span className="cbs-kbd ml-2">F5</span> Refresh
          </p>
        </div>
        <div className="flex items-center gap-3">
          {dayStatus && (
            <span className={`cbs-ribbon ${DAY_STATUS_TONE[dayStatus] || 'text-cbs-steel-700 bg-cbs-mist'}`}>
              {dayStatus.replace(/_/g, ' ')}
            </span>
          )}
          {businessDate && (
            <span className="cbs-tabular text-xs text-cbs-steel-600">
              {formatCbsDate(businessDate)}
            </span>
          )}
        </div>
      </div>

      {/* ── Step 3: Widget grid — each widget fetches independently ── */}
      {/* Widgets render in parallel. Each shows its own skeleton on
          initial load and its own error state on failure. Failed
          widgets do NOT block or break other widgets. */}
      {visibleWidgets.map((def) => (
        <div key={def.id} className={def.gridClass}>
          {renderWidget(def)}
        </div>
      ))}
    </div>
  );
}
