'use client';

/**
 * Dashboard KPI + Alert Widgets — independent fetch per widget.
 * @file src/components/dashboard/DashboardWidgets.tsx
 */

import Link from 'next/link';
import { useDashboardWidget } from '@/hooks/useDashboardWidget';
import { useAuthStore } from '@/store/authStore';
import { formatCurrency, formatCbsTimestamp } from '@/utils/formatters';
import {
  WidgetShell,
  KpiSkeleton,
  ActionSkeleton,
  AnnouncementSkeleton,
} from './WidgetShell';
import type { WidgetDef } from './widgetRegistry';
import {
  ClipboardCheck, AlertTriangle, ShieldCheck, Info,
} from 'lucide-react';

/* ── Data shapes (server-driven) ─────────────────────────────── */

interface LastLoginData { at: string; ip?: string }

interface Announcement {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  body?: string;
  publishedAt: string;
}

interface TxnSummaryData {
  todayCredits: number;
  todayDebits: number;
  todayTxnCount: number;
}

interface PortfolioData {
  casaAccountsActive: number;
  fdOutstanding: number;
  overdueLoans: number;
  unverifiedKyc: number;
}

interface WorkflowAlertData {
  pendingMyAction: number;
  pendingApprovals: number;
  overdueLoans: number;
  unverifiedKyc: number;
}

/* ── Tone Maps ───────────────────────────────────────────────── */

const ANN_TONE: Record<string, string> = {
  info: 'border-cbs-navy-200 bg-cbs-navy-50',
  warning: 'border-cbs-gold-600 bg-cbs-gold-50',
  critical: 'border-cbs-crimson-600 bg-cbs-crimson-50',
};

/* ── File-local sub-components ───────────────────────────────── */

function KpiCard({ label, value, valueClass }: {
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

function ActionCard({ icon, label, value, tone }: {
  icon: React.ReactNode; label: string; value: number;
  tone: 'gold' | 'crimson' | 'steel';
}) {
  const toneMap = {
    gold: 'border-cbs-gold-600 bg-cbs-gold-50 text-cbs-gold-700',
    crimson: 'border-cbs-crimson-600 bg-cbs-crimson-50 text-cbs-crimson-700',
    steel: 'border-cbs-steel-200 bg-cbs-paper text-cbs-steel-600',
  };
  return (
    <div className={`flex items-center gap-3 p-3 border rounded-sm h-[52px] transition-colors hover:bg-cbs-navy-50 ${toneMap[tone]}`}>
      <div className="shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wider truncate">{label}</div>
      </div>
      <div className="text-xl font-bold cbs-tabular">{value}</div>
    </div>
  );
}

function AnnIcon({ severity }: { severity: string }) {
  if (severity === 'critical') return <AlertTriangle size={14} strokeWidth={1.75} className="text-cbs-crimson-700 shrink-0 mt-0.5" />;
  if (severity === 'warning') return <AlertTriangle size={14} strokeWidth={1.75} className="text-cbs-gold-700 shrink-0 mt-0.5" />;
  return <Info size={14} strokeWidth={1.75} className="text-cbs-navy-600 shrink-0 mt-0.5" />;
}

/* ── Widget: Last Login (RBI Security Audit) ─────────────────── */

export function LastLoginWidget({ def }: { def: WidgetDef }) {
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
