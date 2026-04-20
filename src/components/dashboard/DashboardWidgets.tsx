'use client';

/**
 * Dashboard Widgets — per backend dashboard contract.
 * @file src/components/dashboard/DashboardWidgets.tsx
 *
 * Endpoints:
 *   GET /api/v1/dashboard/widgets/portfolio          → PortfolioWidget
 *   GET /api/v1/dashboard/widgets/npa                → NpaWidget
 *   GET /api/v1/dashboard/widgets/casa               → CasaWidget
 *   GET /api/v1/dashboard/widgets/pending-approvals   → PendingApprovalsWidget
 */

import Link from 'next/link';
import { useDashboardWidget } from '@/hooks/useDashboardWidget';
import { formatCurrency } from '@/utils/formatters';
import {
  WidgetShell,
  KpiSkeleton,
  ActionSkeleton,
} from './WidgetShell';
import type { WidgetDef } from './widgetRegistry';

/* ── Data shapes per backend dashboard contract ──────────────── */

/** GET /dashboard/widgets/portfolio */
interface PortfolioData {
  totalCustomers: number;
  casaAccounts: number;
  activeLoans: number;
  smaAccounts: number;
  npaAccounts: number;
  pendingApplications: number;
}

/** GET /dashboard/widgets/npa */
interface NpaData {
  totalOutstanding: number;
  npaOutstanding: number;
  totalProvisioning: number;
  grossNpaRatio: number;
  provisionCoverage: number;
}

/** GET /dashboard/widgets/casa */
interface CasaData {
  totalDeposits: number;
  casaAccountCount: number;
  casaRatio: number;
}

/** GET /dashboard/widgets/pending-approvals */
interface ApprovalsData {
  pendingCount: number;
}

/* ── Sub-components ───────────────────────────────────────────── */

function StatCard({ label, value, valueClass }: {
  label: string; value: string; valueClass?: string;
}) {
  return (
    <div className="cbs-surface p-3 h-[80px]">
      <div className="cbs-field-label">{label}</div>
      <div className={`text-lg font-bold cbs-tabular text-cbs-ink mt-1 ${valueClass || ''}`}>
        {value}
      </div>
    </div>
  );
}

/** Format large INR amounts as Cr/L for dashboard readability. */
function fmtCr(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)} L`;
  return formatCurrency(n);
}

/* ── Widget: Portfolio Summary (ALL roles, 60s) ──────────────── */

export function PortfolioWidget({ def }: { def: WidgetDef }) {
  const user = useAuthStore((s) => s.user);
  const sessionLogin = user?.lastLoginTimestamp;
  const w = useDashboardWidget<LastLoginData>({
    endpoint: def.endpoint,
    errorRef: def.errorRef,
    refreshInterval: 0,
    enabled: !sessionLogin,
  });

  const loginAt = sessionLogin || w.data?.at;
  const loginIp = w.data?.ip;

  if (!loginAt && w.status === 'loading') {
    return (
      <div className="h-[32px] cbs-skeleton rounded-sm" role="status" aria-label="Loading">
        <span className="sr-only">Loading</span>
      </div>
    );
  }
  if (!loginAt) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-cbs-steel-600 bg-cbs-mist border border-cbs-steel-100 px-3 py-1.5 rounded-sm">
      <ShieldCheck size={13} strokeWidth={1.75} className="text-cbs-navy-600 shrink-0" aria-hidden="true" />
      Last sign-in:
      <span className="cbs-tabular font-medium text-cbs-ink">
        {formatCbsTimestamp(loginAt)}
      </span>
      {loginIp && (
        <span className="cbs-tabular text-cbs-steel-500">from {loginIp}</span>
      )}
    </div>
  );
}

/* ── Widget: Announcements / RBI Circulars ───────────────────── */

export function AnnouncementsWidget({ def }: { def: WidgetDef }) {
  const w = useDashboardWidget<Announcement[]>({
    endpoint: def.endpoint,
    errorRef: def.errorRef,
    refreshInterval: def.refreshInterval,
  });

  return (
    <WidgetShell
      status={w.status} error={w.error} errorRef={w.errorRef}
      isInitialLoad={w.isInitialLoad} skeleton={<AnnouncementSkeleton />}
      onRetry={w.refetch}
    >
      {w.data && w.data.length > 0 && (
        <section className="space-y-2">
          {w.data.map((a) => (
            <div
              key={a.id}
              className={`flex items-start gap-2 px-3 py-2 border rounded-sm text-xs ${ANN_TONE[a.severity] || ANN_TONE.info}`}
            >
              <AnnIcon severity={a.severity} />
              <div>
                <div className="font-semibold text-cbs-ink">{a.title}</div>
                {a.body && <div className="text-cbs-steel-600 mt-0.5">{a.body}</div>}
                <div className="cbs-tabular text-cbs-steel-500 mt-0.5">
                  {formatCbsTimestamp(a.publishedAt)}
                </div>
              </div>
            </div>
          ))}
        </section>
      )}
    </WidgetShell>
  );
}

/* ── Widget: KPI Transaction Summary (30s refresh) ───────────── */

export function TxnSummaryWidget({ def }: { def: WidgetDef }) {
  const w = useDashboardWidget<TxnSummaryData>({
    endpoint: def.endpoint,
    errorRef: def.errorRef,
    refreshInterval: def.refreshInterval,
  });

  return (
    <WidgetShell
      status={w.status} error={w.error} errorRef={w.errorRef}
      isInitialLoad={w.isInitialLoad}
      skeleton={
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
        </div>
      }
      onRetry={w.refetch}
    >
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard label="Today&apos;s Credits" value={formatCurrency(w.data?.todayCredits ?? 0)} valueClass="cbs-amount-credit" />
        <KpiCard label="Today&apos;s Debits" value={formatCurrency(w.data?.todayDebits ?? 0)} valueClass="cbs-amount-debit" />
        <KpiCard label="Transactions Today" value={String(w.data?.todayTxnCount ?? 0)} />
      </div>
    </WidgetShell>
  );
}

/* ── Widget: KPI Portfolio (60s refresh, MANAGER+) ───────────── */

export function PortfolioWidget({ def }: { def: WidgetDef }) {
  const w = useDashboardWidget<PortfolioData>({
    endpoint: def.endpoint,
    errorRef: def.errorRef,
    refreshInterval: def.refreshInterval,
  });

  return (
    <WidgetShell
      status={w.status} error={w.error} errorRef={w.errorRef}
      isInitialLoad={w.isInitialLoad}
      skeleton={
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
        </div>
      }
      onRetry={w.refetch}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="CASA Accounts" value={String(w.data?.casaAccountsActive ?? 0)} />
        <KpiCard label="FD Outstanding" value={formatCurrency(w.data?.fdOutstanding ?? 0)} />
        <KpiCard label="Overdue Loans" value={String(w.data?.overdueLoans ?? 0)} valueClass={(w.data?.overdueLoans ?? 0) > 0 ? 'cbs-amount-debit' : ''} />
        <KpiCard label="Unverified KYC" value={String(w.data?.unverifiedKyc ?? 0)} valueClass={(w.data?.unverifiedKyc ?? 0) > 0 ? 'cbs-amount-debit' : ''} />
      </div>
    </WidgetShell>
  );
}

/* ── Widget: Workflow Alerts (15s refresh) ────────────────────── */

export function WorkflowAlertsWidget({ def }: { def: WidgetDef }) {
  const w = useDashboardWidget<WorkflowAlertData>({
    endpoint: def.endpoint,
    errorRef: def.errorRef,
    refreshInterval: def.refreshInterval,
  });

  return (
    <WidgetShell
      status={w.status} error={w.error} errorRef={w.errorRef}
      isInitialLoad={w.isInitialLoad}
      skeleton={
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <ActionSkeleton /><ActionSkeleton /><ActionSkeleton /><ActionSkeleton />
        </div>
      }
      onRetry={w.refetch}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Link href="/workflow" className="block">
          <ActionCard icon={<ClipboardCheck size={16} strokeWidth={1.75} />} label="Pending My Action" value={w.data?.pendingMyAction ?? 0} tone={(w.data?.pendingMyAction ?? 0) > 0 ? 'gold' : 'steel'} />
        </Link>
        <Link href="/workflow" className="block">
          <ActionCard icon={<ClipboardCheck size={16} strokeWidth={1.75} />} label="Pending Approvals" value={w.data?.pendingApprovals ?? 0} tone={(w.data?.pendingApprovals ?? 0) > 0 ? 'gold' : 'steel'} />
        </Link>
        <Link href="/customers/kyc" className="block">
          <ActionCard icon={<ShieldCheck size={16} strokeWidth={1.75} />} label="Unverified KYC" value={w.data?.unverifiedKyc ?? 0} tone={(w.data?.unverifiedKyc ?? 0) > 0 ? 'crimson' : 'steel'} />
        </Link>
        <Link href="/loans" className="block">
          <ActionCard icon={<AlertTriangle size={16} strokeWidth={1.75} />} label="Overdue Loans" value={w.data?.overdueLoans ?? 0} tone={(w.data?.overdueLoans ?? 0) > 0 ? 'crimson' : 'steel'} />
        </Link>
      </div>
    </WidgetShell>
  );
}
