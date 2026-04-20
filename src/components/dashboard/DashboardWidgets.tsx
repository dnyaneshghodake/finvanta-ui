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

/** GET /dashboard/widgets/teller/txn-summary */
interface TellerTxnSummaryData {
  businessDate: string;
  totalTransactions: number;
  totalCredits: number;
  totalDebits: number;
  netAmount: number;
}

/** GET /dashboard/widgets/teller/approval-queue */
interface ApprovalQueueData {
  items: Array<{
    id: number;
    reference: string;
    actionType: string;
    makerUserId: string;
    age: string;
    ageMinutes: number;
    slaBreached: boolean;
    status: string;
  }>;
  totalPending: number;
  overdueCount: number;
}

/** GET /dashboard/widgets/manager/clearing-status */
interface ClearingStatusData {
  businessDate: string;
  initiated: number;
  sentToNetwork: number;
  settled: number;
  failed: number;
}

/** GET /dashboard/widgets/manager/risk-metrics */
interface RiskMetricsData {
  overdueApprovals: number;
  suspensePending: number;
  highValueTxnsToday: number;
  overdueBreached: boolean;
  suspenseBreached: boolean;
  highValueBreached: boolean;
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
    <dl className="cbs-surface p-4 h-[128px] rounded-lg flex flex-col justify-between">
      <dt className="text-[13px] font-medium text-cbs-steel-600">{label}</dt>
      <dd className={`text-2xl font-semibold cbs-tabular text-right text-cbs-ink ${valueClass || ''}`}>
        {value}
      </dd>
      {sub && (
        <dd className="text-xs text-cbs-steel-500 text-right cbs-tabular">{sub}</dd>
      )}
    </dl>
  );
}

/** Format large INR amounts as Cr/L for dashboard readability. */
function fmtCr(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)} L`;
  return formatCurrency(n);
}

/**
 * Risk Metric Card — 140px height per Tier-1 spec.
 * Red border when breached flag is true.
 */
function RiskCard({ label, value, breached }: {
  label: string; value: number; breached: boolean;
}) {
  return (
    <dl className={`cbs-surface p-4 h-[140px] rounded-lg flex flex-col justify-between ${breached ? 'border-2 border-cbs-crimson-600' : ''}`} role={breached ? 'alert' : undefined}>
      <dt className="text-[13px] font-medium text-cbs-steel-600">{label}</dt>
      <dd className={`text-2xl font-semibold cbs-tabular text-right ${breached ? 'cbs-amount-debit' : 'text-cbs-ink'}`}>
        {value}
      </dd>
      {breached && (
        <dd className="text-[10px] text-cbs-crimson-700 text-right font-semibold uppercase">Threshold Breached</dd>
      )}
    </dl>
  );
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
        <div className={`flex items-center gap-3 p-4 border rounded-lg h-[52px] transition-colors hover:bg-cbs-navy-50 ${count > 0 ? 'border-cbs-gold-600 bg-cbs-gold-50 text-cbs-gold-700' : 'border-cbs-steel-200 bg-cbs-paper text-cbs-steel-600'}`}>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider">Pending Approvals</div>
          </div>
          <div className="text-xl font-bold cbs-tabular">{count}</div>
        </div>
      </Link>
    </WidgetShell>
  );
}

/* ── Widget: Teller Txn Summary (MAKER+ADMIN, 30s) ───────────── */

export function TellerTxnSummaryWidget({ def }: { def: WidgetDef }) {
  const w = useDashboardWidget<TellerTxnSummaryData>({
    endpoint: def.endpoint,
    errorRef: def.errorRef,
    refreshInterval: def.refreshInterval,
  });
  return (
    <WidgetShell status={w.status} error={w.error} errorRef={w.errorRef}
      isInitialLoad={w.isInitialLoad} onRetry={w.refetch}
      skeleton={<div className="grid grid-cols-2 md:grid-cols-5 gap-4">{Array.from({length:5},(_,i)=><div key={i} className="cbs-skeleton rounded-lg h-[128px]" />)}</div>}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Today Transactions" value={String(w.data?.totalTransactions ?? 0)} />
        <StatCard label="Total Credits" value={fmtCr(w.data?.totalCredits ?? 0)} valueClass="text-cbs-olive-700" />
        <StatCard label="Total Debits" value={fmtCr(w.data?.totalDebits ?? 0)} />
        <StatCard label="Net Position" value={fmtCr(w.data?.netAmount ?? 0)} valueClass={(w.data?.netAmount ?? 0) >= 0 ? 'text-cbs-olive-700' : 'cbs-amount-debit'} />
      </div>
    </WidgetShell>
  );
}

/* ── Widget: Approval Queue (CHECKER+ADMIN, 15s) ─────────────── */

export function ApprovalQueueWidget({ def }: { def: WidgetDef }) {
  const w = useDashboardWidget<ApprovalQueueData>({
    endpoint: def.endpoint,
    errorRef: def.errorRef,
    refreshInterval: def.refreshInterval,
  });
  const items = w.data?.items ?? [];
  return (
    <WidgetShell status={w.status} error={w.error} errorRef={w.errorRef}
      isInitialLoad={w.isInitialLoad} onRetry={w.refetch}
      skeleton={<div className="cbs-skeleton rounded-lg h-[360px]" />}>
      <section className="cbs-surface rounded-lg">
        <div className="cbs-surface-header" style={{height:44}}>
          <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Approval Queue</span>
          <span className="text-xs text-cbs-steel-500 cbs-tabular">
            {w.data?.totalPending ?? 0} pending{(w.data?.overdueCount ?? 0) > 0 && <span className="cbs-amount-debit ml-1">({w.data?.overdueCount} overdue)</span>}
          </span>
        </div>
        <div className="overflow-x-auto" style={{ maxHeight: 360 }}>
          <table className="cbs-grid-table">
            <thead>
              <tr>
                <th scope="col" style={{width:120}}>Ref No</th>
                <th scope="col" style={{width:100}}>Type</th>
                <th scope="col" style={{width:120}}>Maker</th>
                <th scope="col" className="text-right" style={{width:80}}>Age</th>
                <th scope="col" className="text-center" style={{width:100}}>SLA</th>
                <th scope="col" style={{width:100}}>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-sm text-cbs-steel-500 py-6">No pending approvals</td></tr>
              ) : items.slice(0, 8).map((item) => (
                <tr key={item.id} style={{height:40}}>
                  <td className="cbs-tabular font-semibold text-cbs-navy-700">{item.reference}</td>
                  <td className="text-xs">{item.actionType}</td>
                  <td className="text-xs text-cbs-steel-700">{item.makerUserId}</td>
                  <td className={`cbs-tabular text-xs text-right ${item.ageMinutes > 240 ? 'cbs-amount-debit' : item.ageMinutes > 60 ? 'text-cbs-gold-700' : ''}`}>
                    {item.age}
                  </td>
                  <td className="text-center">
                    {item.slaBreached && <span className="cbs-ribbon cbs-amount-debit bg-cbs-crimson-50 border-cbs-crimson-600 text-[10px]">BREACHED</span>}
                  </td>
                  <td><span className="cbs-ribbon text-cbs-gold-700 bg-cbs-gold-50 border-cbs-gold-600 text-[10px]">{item.status.replace(/_/g, ' ')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </WidgetShell>
  );
}

/* ── Widget: Clearing Status (CHECKER+ADMIN, 60s) ────────────── */

export function ClearingStatusWidget({ def }: { def: WidgetDef }) {
  const w = useDashboardWidget<ClearingStatusData>({
    endpoint: def.endpoint,
    errorRef: def.errorRef,
    refreshInterval: def.refreshInterval,
  });
  return (
    <WidgetShell status={w.status} error={w.error} errorRef={w.errorRef}
      isInitialLoad={w.isInitialLoad} onRetry={w.refetch}
      skeleton={<div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Array.from({length:4},(_,i)=><div key={i} className="cbs-skeleton rounded-lg h-[128px]" />)}</div>}>
      <section className="cbs-surface rounded-lg">
        <div className="cbs-surface-header">
          <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Clearing Status</span>
        </div>
        <div className="cbs-surface-body grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Initiated" value={String(w.data?.initiated ?? 0)} />
          <StatCard label="Sent to Network" value={String(w.data?.sentToNetwork ?? 0)} valueClass="text-cbs-gold-700" />
          <StatCard label="Settled" value={String(w.data?.settled ?? 0)} valueClass="text-cbs-olive-700" />
          <StatCard label="Failed" value={String(w.data?.failed ?? 0)} valueClass={(w.data?.failed ?? 0) > 0 ? 'cbs-amount-debit' : ''} />
        </div>
      </section>
    </WidgetShell>
  );
}

/* ── Widget: Risk Metrics (CHECKER+ADMIN, 60s) ───────────────── */

export function RiskMetricsWidget({ def }: { def: WidgetDef }) {
  const w = useDashboardWidget<RiskMetricsData>({
    endpoint: def.endpoint,
    errorRef: def.errorRef,
    refreshInterval: def.refreshInterval,
  });
  return (
    <WidgetShell status={w.status} error={w.error} errorRef={w.errorRef}
      isInitialLoad={w.isInitialLoad} onRetry={w.refetch}
      skeleton={<div className="grid grid-cols-2 md:grid-cols-3 gap-4">{Array.from({length:3},(_,i)=><div key={i} className="cbs-skeleton rounded-lg h-[140px]" />)}</div>}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <RiskCard label="Overdue Approvals" value={w.data?.overdueApprovals ?? 0} breached={w.data?.overdueBreached ?? false} />
        <RiskCard label="Suspense Pending" value={w.data?.suspensePending ?? 0} breached={w.data?.suspenseBreached ?? false} />
        <RiskCard label="High Value Txns" value={w.data?.highValueTxnsToday ?? 0} breached={w.data?.highValueBreached ?? false} />
      </div>
    </WidgetShell>
  );
}
