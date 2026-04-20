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

/**
 * CBS Metric Card — Tier-1 spec:
 *   Height: 128px fixed (zero CLS)
 *   Label: 13px medium, secondary color
 *   Value: 24px semi-bold, right-aligned, monospace
 *   Subtext: 12px regular (optional)
 *   Padding: 16px
 *   Border-radius: 8px
 */
function StatCard({ label, value, sub, valueClass }: {
  label: string; value: string; sub?: string; valueClass?: string;
}) {
  return (
    <div className="cbs-surface p-4 h-[128px] rounded-lg flex flex-col justify-between">
      <div className="text-[13px] font-medium text-cbs-steel-600">{label}</div>
      <div className={`text-2xl font-semibold cbs-tabular text-right text-cbs-ink ${valueClass || ''}`}>
        {value}
      </div>
      {sub && (
        <div className="text-xs text-cbs-steel-500 text-right cbs-tabular">{sub}</div>
      )}
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
  const w = useDashboardWidget<PortfolioData>({
    endpoint: def.endpoint,
    errorRef: def.errorRef,
    refreshInterval: def.refreshInterval,
  });
  return (
    <WidgetShell status={w.status} error={w.error} errorRef={w.errorRef}
      isInitialLoad={w.isInitialLoad} onRetry={w.refetch}
      skeleton={<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">{Array.from({length:6},(_,i)=><div key={i} className="cbs-skeleton rounded-lg h-[128px]" />)}</div>}>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Customers" value={String(w.data?.totalCustomers ?? 0)} />
        <StatCard label="CASA Accounts" value={String(w.data?.casaAccounts ?? 0)} />
        <StatCard label="Active Loans" value={String(w.data?.activeLoans ?? 0)} valueClass="text-cbs-olive-700" />
        <StatCard label="SMA Accounts" value={String(w.data?.smaAccounts ?? 0)} valueClass={(w.data?.smaAccounts ?? 0) > 0 ? 'text-cbs-gold-700' : ''} />
        <StatCard label="NPA Accounts" value={String(w.data?.npaAccounts ?? 0)} valueClass={(w.data?.npaAccounts ?? 0) > 0 ? 'cbs-amount-debit' : ''} />
        <StatCard label="Pending Apps" value={String(w.data?.pendingApplications ?? 0)} />
      </div>
    </WidgetShell>
  );
}

/* ── Widget: NPA Overview (CHECKER+ADMIN+AUDITOR, 60s) ────────── */

export function NpaWidget({ def }: { def: WidgetDef }) {
  const w = useDashboardWidget<NpaData>({
    endpoint: def.endpoint,
    errorRef: def.errorRef,
    refreshInterval: def.refreshInterval,
  });
  return (
    <WidgetShell status={w.status} error={w.error} errorRef={w.errorRef}
      isInitialLoad={w.isInitialLoad} onRetry={w.refetch}
      skeleton={<div className="grid grid-cols-2 md:grid-cols-5 gap-4">{Array.from({length:5},(_,i)=><div key={i} className="cbs-skeleton rounded-lg h-[128px]" />)}</div>}>
      <section className="cbs-surface rounded-lg">
        <div className="cbs-surface-header">
          <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">NPA Overview</span>
        </div>
        <div className="cbs-surface-body grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Total Outstanding" value={fmtCr(w.data?.totalOutstanding ?? 0)} />
          <StatCard label="NPA Outstanding" value={fmtCr(w.data?.npaOutstanding ?? 0)} valueClass="cbs-amount-debit" />
          <StatCard label="Provisioning" value={fmtCr(w.data?.totalProvisioning ?? 0)} />
          <StatCard label="Gross NPA %" value={`${(w.data?.grossNpaRatio ?? 0).toFixed(2)}%`} valueClass={(w.data?.grossNpaRatio ?? 0) > 5 ? 'cbs-amount-debit' : ''} />
          <StatCard label="Provision Coverage" value={`${(w.data?.provisionCoverage ?? 0).toFixed(2)}%`} valueClass={(w.data?.provisionCoverage ?? 0) < 80 ? 'text-cbs-gold-700' : 'text-cbs-olive-700'} />
        </div>
      </section>
    </WidgetShell>
  );
}

/* ── Widget: CASA Overview (CHECKER+ADMIN+AUDITOR, 60s) ──────── */

export function CasaWidget({ def }: { def: WidgetDef }) {
  const w = useDashboardWidget<CasaData>({
    endpoint: def.endpoint,
    errorRef: def.errorRef,
    refreshInterval: def.refreshInterval,
  });
  return (
    <WidgetShell status={w.status} error={w.error} errorRef={w.errorRef}
      isInitialLoad={w.isInitialLoad} onRetry={w.refetch}
      skeleton={<div className="grid grid-cols-2 md:grid-cols-3 gap-3"><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /></div>}>
      <section className="cbs-surface">
        <div className="cbs-surface-header">
          <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">CASA Overview</span>
        </div>
        <div className="cbs-surface-body grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard label="Total Deposits" value={fmtCr(w.data?.totalDeposits ?? 0)} />
          <StatCard label="CASA Accounts" value={String(w.data?.casaAccountCount ?? 0)} />
          <StatCard label="CASA Ratio" value={`${(w.data?.casaRatio ?? 0).toFixed(2)}%`} />
        </div>
      </section>
    </WidgetShell>
  );
}

/* ── Widget: Pending Approvals (MAKER+CHECKER+ADMIN, 15s) ────── */

export function PendingApprovalsWidget({ def }: { def: WidgetDef }) {
  const w = useDashboardWidget<ApprovalsData>({
    endpoint: def.endpoint,
    errorRef: def.errorRef,
    refreshInterval: def.refreshInterval,
  });
  const count = w.data?.pendingCount ?? 0;
  return (
    <WidgetShell status={w.status} error={w.error} errorRef={w.errorRef}
      isInitialLoad={w.isInitialLoad} onRetry={w.refetch}
      skeleton={<ActionSkeleton />}>
      <Link href="/workflow" className="block">
        <div className={`flex items-center gap-3 p-3 border rounded-sm h-[52px] transition-colors hover:bg-cbs-navy-50 ${count > 0 ? 'border-cbs-gold-600 bg-cbs-gold-50 text-cbs-gold-700' : 'border-cbs-steel-200 bg-cbs-paper text-cbs-steel-600'}`}>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider">Pending Approvals</div>
          </div>
          <div className="text-xl font-bold cbs-tabular">{count}</div>
        </div>
      </Link>
    </WidgetShell>
  );
}
