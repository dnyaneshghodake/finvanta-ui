'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { Breadcrumb, CbsTableSkeleton } from '@/components/cbs';
import { Button } from '@/components/atoms';
import { formatCurrency, formatCbsTimestamp, formatCbsDate } from '@/utils/formatters';
import { useCbsKeyboard } from '@/hooks/useCbsKeyboard';
import { apiClient } from '@/services/api/apiClient';
import { isMaker, isChecker } from '@/security/roleGuard';
import Link from 'next/link';
import {
  ArrowLeftRight, Landmark, UserPlus, Banknote, CreditCard,
  ClipboardCheck, AlertTriangle, ShieldCheck, Info,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────
 * FINVANTA CBS — Branch Operations Dashboard (Tier-1 Grade)
 *
 * Design principles (Finacle / T24 / Flexcube / BaNCS):
 * 1. ALL KPIs come from the server — the browser never computes
 *    financial aggregates (RBI IT Governance Direction 2023 §8).
 * 2. Dashboard is operator-centric, not customer-centric.
 * 3. Day-open/close status is always visible.
 * 4. Pending maker-checker queue count drives teller workflow.
 * 5. Last login timestamp is shown for security audit.
 * 6. System announcements surface regulatory notices.
 *
 * CBS keyboard shortcuts:  F2 = Transfer   F5 = Refresh
 * ───────────────────────────────────────────────────────────────── */

/** Server-driven dashboard summary — never computed client-side. */
interface BranchDashboard {
  dayStatus: 'OPEN' | 'CLOSED' | 'EOD_IN_PROGRESS';
  businessDate: string;
  branchCode: string;
  branchName?: string;
  kpi: {
    todayCredits: number;
    todayDebits: number;
    todayTxnCount: number;
    pendingApprovals: number;
    pendingMyAction: number;
    overdueLoans: number;
    unverifiedKyc: number;
    casaAccountsActive: number;
    fdOutstanding: number;
  };
  lastLogin?: { at: string; ip?: string };
  announcements: Array<{
    id: string;
    severity: 'info' | 'warning' | 'critical';
    title: string;
    body?: string;
    publishedAt: string;
  }>;
}

const DAY_STATUS_TONE: Record<string, string> = {
  OPEN: 'text-cbs-olive-700 bg-cbs-olive-50',
  CLOSED: 'text-cbs-crimson-700 bg-cbs-crimson-50',
  EOD_IN_PROGRESS: 'text-cbs-gold-700 bg-cbs-gold-50',
};

const ANNOUNCEMENT_TONE: Record<string, string> = {
  info: 'border-cbs-navy-200 bg-cbs-navy-50',
  warning: 'border-cbs-gold-600 bg-cbs-gold-50',
  critical: 'border-cbs-crimson-600 bg-cbs-crimson-50',
};

const ANNOUNCEMENT_ICON: Record<string, React.ReactNode> = {
  info: <Info size={14} strokeWidth={1.75} className="text-cbs-navy-600 shrink-0 mt-0.5" />,
  warning: <AlertTriangle size={14} strokeWidth={1.75} className="text-cbs-gold-700 shrink-0 mt-0.5" />,
  critical: <AlertTriangle size={14} strokeWidth={1.75} className="text-cbs-crimson-700 shrink-0 mt-0.5" />,
};

/** Fallback when /dashboard/summary endpoint is not yet available. */
function makeFallback(
  user: ReturnType<typeof useAuthStore.getState>['user'],
  bizDate: string | null,
): BranchDashboard {
  return {
    dayStatus: 'OPEN',
    businessDate: bizDate || new Date().toISOString().slice(0, 10),
    branchCode: user?.branchCode || '--',
    branchName: user?.branchName,
    kpi: {
      todayCredits: 0, todayDebits: 0, todayTxnCount: 0,
      pendingApprovals: 0, pendingMyAction: 0, overdueLoans: 0,
      unverifiedKyc: 0, casaAccountsActive: 0, fdOutstanding: 0,
    },
    lastLogin: user?.lastLogin ? { at: String(user.lastLogin) } : undefined,
    announcements: [],
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const businessDate = useAuthStore((s) => s.businessDate);
  const { addToast } = useUIStore();
  const [dashboard, setDashboard] = useState<BranchDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data?: BranchDashboard }>(
        '/dashboard/summary',
      );
      if (res.data?.success && res.data.data) {
        setDashboard(res.data.data);
      } else {
        setDashboard(makeFallback(user, businessDate));
      }
    } catch {
      setDashboard(makeFallback(user, businessDate));
    } finally {
      setIsLoading(false);
    }
  }, [user, businessDate]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const shortcuts = useMemo(() => ({
    F2: () => router.push('/transfers'),
    F5: () => { void loadDashboard(); },
  }), [router, loadDashboard]);
  useCbsKeyboard(shortcuts);

  const d = dashboard;
  const displayName = user?.firstName || user?.username || 'Operator';

  return (
    <div className="space-y-4">
      <Breadcrumb items={[{ label: 'Dashboard' }]} />

      {/* ── Page Header with Day Status ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-cbs-ink">Branch Operations Dashboard</h1>
          <p className="text-xs text-cbs-steel-600 mt-0.5">
            Welcome, {displayName}.
            <span className="cbs-kbd ml-3">F2</span> Transfer
            <span className="cbs-kbd ml-2">F5</span> Refresh
          </p>
        </div>
        {d && (
          <div className="flex items-center gap-3">
            <span className={`cbs-ribbon ${DAY_STATUS_TONE[d.dayStatus] || ''}`}>
              Day {d.dayStatus.replace(/_/g, ' ')}
            </span>
            <span className="cbs-tabular text-xs text-cbs-steel-600">
              {formatCbsDate(d.businessDate)}
            </span>
          </div>
        )}
      </div>

      {isLoading ? (
        <CbsTableSkeleton rows={4} />
      ) : d ? (
        <>
          {/* ── Last Login Security Notice (RBI mandate) ── */}
          {d.lastLogin && (
            <div className="flex items-center gap-2 text-xs text-cbs-steel-600 bg-cbs-mist border border-cbs-steel-100 px-3 py-1.5 rounded-sm">
              <ShieldCheck size={13} strokeWidth={1.75} className="text-cbs-navy-600 shrink-0" aria-hidden="true" />
              Last sign-in:
              <span className="cbs-tabular font-medium text-cbs-ink">
                {formatCbsTimestamp(d.lastLogin.at)}
              </span>
              {d.lastLogin.ip && (
                <span className="cbs-tabular text-cbs-steel-500">from {d.lastLogin.ip}</span>
              )}
            </div>
          )}

          {/* ── System Announcements / RBI Circulars ── */}
          {d.announcements.length > 0 && (
            <section className="space-y-2">
              {d.announcements.map((a) => (
                <div
                  key={a.id}
                  className={`flex items-start gap-2 px-3 py-2 border rounded-sm text-xs ${ANNOUNCEMENT_TONE[a.severity] || ANNOUNCEMENT_TONE.info}`}
                >
                  {ANNOUNCEMENT_ICON[a.severity] || ANNOUNCEMENT_ICON.info}
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

          {/* ── Server-Driven KPI Grid ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard label="Today's Credits" value={formatCurrency(d.kpi.todayCredits)} valueClass="cbs-amount-credit" />
            <KpiCard label="Today's Debits" value={formatCurrency(d.kpi.todayDebits)} valueClass="cbs-amount-debit" />
            <KpiCard label="Transactions Today" value={String(d.kpi.todayTxnCount)} />
            <KpiCard label="CASA Accounts" value={String(d.kpi.casaAccountsActive)} />
            <KpiCard label="FD Outstanding" value={formatCurrency(d.kpi.fdOutstanding)} />
          </div>

          {/* ── Workflow & Compliance Alerts ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <Link href="/workflow" className="block">
              <ActionCard icon={<ClipboardCheck size={16} strokeWidth={1.75} />} label="Pending My Action" value={d.kpi.pendingMyAction} tone={d.kpi.pendingMyAction > 0 ? 'gold' : 'steel'} />
            </Link>
            <Link href="/workflow" className="block">
              <ActionCard icon={<ClipboardCheck size={16} strokeWidth={1.75} />} label="Total Pending Approvals" value={d.kpi.pendingApprovals} tone={d.kpi.pendingApprovals > 0 ? 'gold' : 'steel'} />
            </Link>
            <Link href="/customers/kyc" className="block">
              <ActionCard icon={<ShieldCheck size={16} strokeWidth={1.75} />} label="Unverified KYC" value={d.kpi.unverifiedKyc} tone={d.kpi.unverifiedKyc > 0 ? 'crimson' : 'steel'} />
            </Link>
            <Link href="/loans" className="block">
              <ActionCard icon={<AlertTriangle size={16} strokeWidth={1.75} />} label="Overdue Loans" value={d.kpi.overdueLoans} tone={d.kpi.overdueLoans > 0 ? 'crimson' : 'steel'} />
            </Link>
          </div>

          {/* ── Quick Operations — role-gated ── */}
          <section className="cbs-surface">
            <div className="cbs-surface-header">
              <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
                Quick Operations
              </span>
            </div>
            <div className="cbs-surface-body grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <QuickOp href="/transfers" icon={<ArrowLeftRight size={15} />} label="Transfer" primary />
              <QuickOp href="/accounts" icon={<Landmark size={15} />} label="Account Inquiry" />
              {isMaker() && (
                <>
                  <QuickOp href="/customers/new" icon={<UserPlus size={15} />} label="New Customer" />
                  <QuickOp href="/deposits/new" icon={<Banknote size={15} />} label="Book FD" />
                  <QuickOp href="/loans/apply" icon={<CreditCard size={15} />} label="Loan Application" />
                </>
              )}
              <QuickOp href="/workflow" icon={<ClipboardCheck size={15} />} label="Workflow Queue" />
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

/* ── Sub-components (file-local, not exported) ────────────────── */

/** Server-driven KPI card — displays a single metric from the backend. */
function KpiCard({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="cbs-surface p-3">
      <div className="cbs-field-label">{label}</div>
      <div className={`text-lg font-bold cbs-tabular text-cbs-ink mt-1 ${valueClass || ''}`}>
        {value}
      </div>
    </div>
  );
}

/** Workflow / compliance action card with count badge. */
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
    <div className={`flex items-center gap-3 p-3 border rounded-sm transition-colors hover:bg-cbs-navy-50 ${toneMap[tone]}`}>
      <div className="shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wider truncate">{label}</div>
      </div>
      <div className="text-xl font-bold cbs-tabular">{value}</div>
    </div>
  );
}

/** Role-gated quick operation button. */
function QuickOp({ href, icon, label, primary }: {
  href: string; icon: React.ReactNode; label: string; primary?: boolean;
}) {
  return (
    <Link href={href}>
      <Button fullWidth variant={primary ? 'primary' : 'secondary'} size="sm" icon={icon}>
        {label}
      </Button>
    </Link>
  );
}
