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
import { WidgetErrorBoundary } from '@/components/cbs/CbsErrorBoundary';
import { formatCbsDate, formatCbsTimestamp } from '@/utils/formatters';
import { useCbsKeyboard } from '@/hooks/useCbsKeyboard';
import { ShieldCheck, Printer, Download } from 'lucide-react';
import { printScreen } from '@/utils/cbsPrint';
import {
  getVisibleWidgets,
  PortfolioWidget,
  NpaWidget,
  CasaWidget,
  PendingApprovalsWidget,
  TellerTxnSummaryWidget,
  ApprovalQueueWidget,
  ClearingStatusWidget,
  RiskMetricsWidget,
  QuickOpsWidget,
} from '@/components/dashboard';
import type { WidgetDef } from '@/components/dashboard';

// Per backend contract: dayStatus values
const DAY_STATUS_TONE: Record<string, string> = {
  DAY_OPEN: 'text-cbs-olive-700 bg-cbs-olive-50',
  DAY_CLOSED: 'text-cbs-crimson-700 bg-cbs-crimson-50',
  EOD_RUNNING: 'text-cbs-gold-700 bg-cbs-gold-50',
  NOT_OPENED: 'text-cbs-crimson-700 bg-cbs-crimson-50',
};

/** Maps widget ID → component per backend dashboard contract. */
function renderWidget(def: WidgetDef) {
  switch (def.id) {
    case 'PORTFOLIO': return <PortfolioWidget key={def.id} def={def} />;
    case 'NPA': return <NpaWidget key={def.id} def={def} />;
    case 'CASA': return <CasaWidget key={def.id} def={def} />;
    case 'PENDING_APPROVALS': return <PendingApprovalsWidget key={def.id} def={def} />;
    case 'TELLER_TXN_SUMMARY': return <TellerTxnSummaryWidget key={def.id} def={def} />;
    case 'APPROVAL_QUEUE': return <ApprovalQueueWidget key={def.id} def={def} />;
    case 'CLEARING_STATUS': return <ClearingStatusWidget key={def.id} def={def} />;
    case 'RISK_METRICS': return <RiskMetricsWidget key={def.id} def={def} />;
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

  // CBS keyboard shortcuts (F2=Transfer, F5=Refresh, F9=Print)
  const shortcuts = useMemo(() => ({
    F2: () => router.push('/transfers'),
    F5: () => { window.location.reload(); },
    F9: () => { printScreen(); },
  }), [router]);
  useCbsKeyboard(shortcuts);

  // Captured once on mount so the footer timestamp is stable across
  // background widget refreshes. useMemo (not useRef) keeps React
  // Compiler's refs-during-render rule happy.
  const snapshotTime = useMemo(() => new Date(), []);

  const displayName = user?.firstName || user?.username || 'Operator';
  const dayStatus = businessDay?.dayStatus || null;

  // ── Step 2: Render layout + role-based skeleton grid immediately ──
  // Navigation, header, and day-status render from session state (no API).
  // Widget grid renders skeletons that match real content dimensions.
  const lastLogin = user?.lastLoginTimestamp;

  return (
    <div className="space-y-4">
      <Breadcrumb items={[{ label: 'Dashboard' }]} />

      {/* ── Page Header with Day Status (from session, no API) ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-cbs-ink">Branch Operations Dashboard</h1>
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

      {/* ── Last Login Security Notice (RBI IT Governance §8) ── */}
      {lastLogin && (
        <div className="flex items-center gap-2 text-xs text-cbs-steel-600 bg-cbs-mist border border-cbs-steel-100 px-4 py-2 rounded-sm">
          <ShieldCheck size={13} strokeWidth={1.75} className="text-cbs-navy-600 shrink-0" aria-hidden="true" />
          Last sign-in:
          <span className="cbs-tabular font-medium text-cbs-ink">
            {formatCbsTimestamp(lastLogin)}
          </span>
        </div>
      )}

      {/* ── Widget grid — 12-column, 16px gap, skeleton-first ── */}
      {/* Each widget is wrapped in WidgetErrorBoundary so a render
          crash in one widget does NOT take down the entire dashboard.
          CBS benchmark: Tier-1 CBS portal isolates each module tile. */}
      {visibleWidgets.map((def) => (
        <div key={def.id} className={def.gridClass}>
          <WidgetErrorBoundary moduleRef={def.errorRef}>
            {renderWidget(def)}
          </WidgetErrorBoundary>
        </div>
      ))}

      {/* ── Footer: Print + Snapshot (RBI Audit Requirement) ── */}
      <div className="flex items-center justify-between pt-2 border-t border-cbs-steel-100">
        <div className="flex items-center gap-2 cbs-no-print">
          <button
            type="button"
            onClick={() => printScreen()}
            className="flex items-center gap-1 text-[10px] text-cbs-steel-500 hover:text-cbs-navy-700 transition-colors"
            title="Print dashboard (F9)"
          >
            <Printer size={11} />
            Print
          </button>
        </div>
        <div className="text-[10px] text-cbs-steel-400 text-right cbs-tabular">
          Dashboard snapshot: {formatCbsTimestamp(snapshotTime)}
        </div>
      </div>
    </div>
  );
}
