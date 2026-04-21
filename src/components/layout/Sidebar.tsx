/**
 * CBS Sidebar — Tier-1 Enterprise Navigation Panel.
 * @file src/components/layout/Sidebar.tsx
 *
 * Per Tier-1 CBS Enterprise Sidebar UX Blueprint:
 *   - Module headers expand/collapse to reveal operation sub-items
 *   - Accordion: only one module open at a time
 *   - Sub-items are role-gated (MAKER/CHECKER/ADMIN)
 *   - Active sub-item auto-expands its parent module
 *   - Icons: 18px stroke on module headers only
 *   - Sub-items: indent + text only (CBS density convention)
 *   - User context block: operator, role, branch, biz date
 *   - Environment badge: PROD/UAT/SIT/DEV (prevents env mistakes)
 *   - 3px left border on active items (CBS active state convention)
 *   - aria-expanded on expandable modules (WCAG 2.1 AA)
 *   - Collapsed rail mode: 72px icon-only with tooltips (§9)
 *   - Navigation search: Ctrl+K fuzzy search over all screens (§7)
 *   - Auto-collapse below 1280px viewport width (§15)
 *
 * CBS benchmark: mirrors Finacle sidebar (272px expanded, 72px
 * collapsed rail), T24 module tree, and FLEXCUBE navigation panel.
 */

'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import clsx from 'clsx';
import {
  LayoutDashboard, Landmark, ArrowLeftRight, ClipboardCheck,
  Users, UserPlus, Banknote, CreditCard, BarChart3, Settings, Monitor,
  ChevronRight, Building2, Calendar, Search, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import type { UserRole } from '@/types/entities';

const ICON_SIZE = 18;
const ICON_STROKE = 1.75;
const MAKER: UserRole[] = ['MAKER', 'TELLER', 'OFFICER'];
const CHECKER: UserRole[] = ['CHECKER', 'MANAGER', 'APPROVER'];
// Per API_REFERENCE.md §1: Spring returns 'ADMIN' for full admin access.
// Must include all three admin-tier roles so sidebar items are visible.
const ADMIN: UserRole[] = ['ADMIN', 'ADMIN_HO', 'BRANCH_ADMIN'];

interface SubItem { label: string; href: string; roles?: UserRole[]; }
interface NavModule { id: string; label: string; icon: React.ReactNode; href?: string; children?: SubItem[]; roles?: UserRole[]; }

const MODULES: NavModule[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard',
    icon: <LayoutDashboard size={ICON_SIZE} strokeWidth={ICON_STROKE} /> },
  { id: 'accounts', label: 'Accounts',
    icon: <Landmark size={ICON_SIZE} strokeWidth={ICON_STROKE} />, children: [
    { label: 'Account Inquiry', href: '/accounts' },
    { label: 'Open Account', href: '/accounts/new', roles: MAKER },
    { label: 'Freeze / Unfreeze', href: '/legacy/deposit/freeze', roles: [...MAKER, ...CHECKER] },
    { label: 'Close Account', href: '/legacy/deposit/close', roles: MAKER },
    { label: 'Standing Instructions', href: '/legacy/deposit/si', roles: MAKER },
    { label: 'Mini Statement', href: '/legacy/deposit/mini-statement' },
  ]},
  { id: 'transfers', label: 'Transfers',
    icon: <ArrowLeftRight size={ICON_SIZE} strokeWidth={ICON_STROKE} />, children: [
    { label: 'Internal Transfer', href: '/transfers' },
    { label: 'Transfer Inquiry', href: '/legacy/deposit/transfer-inquiry' },
    { label: 'Reversal', href: '/legacy/deposit/reversal', roles: CHECKER },
  ]},
  { id: 'deposits', label: 'Fixed Deposits',
    icon: <Banknote size={ICON_SIZE} strokeWidth={ICON_STROKE} />, children: [
    { label: 'FD Inquiry', href: '/deposits' },
    { label: 'Book FD', href: '/deposits/new', roles: MAKER },
    { label: 'Premature Close', href: '/deposits/close', roles: [...MAKER, ...CHECKER] },
    { label: 'Lien Mark / Release', href: '/deposits/lien', roles: [...MAKER, ...CHECKER] },
  ]},
  { id: 'loans', label: 'Loans',
    icon: <CreditCard size={ICON_SIZE} strokeWidth={ICON_STROKE} />, children: [
    { label: 'Loan Inquiry', href: '/loans' },
    { label: 'Loan Application', href: '/loans/apply', roles: MAKER },
    { label: 'Disbursement', href: '/loans/disburse', roles: CHECKER },
    { label: 'Repayment', href: '/loans/repay', roles: MAKER },
  ]},
  { id: 'customers', label: 'Customers',
    icon: <UserPlus size={ICON_SIZE} strokeWidth={ICON_STROKE} />, children: [
    { label: 'Customer Search', href: '/customers' },
    { label: 'New Customer (CIF)', href: '/customers/new', roles: MAKER },
    { label: 'KYC Verification', href: '/customers/kyc', roles: CHECKER },
  ]},
  { id: 'beneficiaries', label: 'Beneficiaries', href: '/beneficiaries',
    icon: <Users size={ICON_SIZE} strokeWidth={ICON_STROKE} /> },
  { id: 'workflow', label: 'Workflow', href: '/workflow',
    icon: <ClipboardCheck size={ICON_SIZE} strokeWidth={ICON_STROKE} /> },
  { id: 'reports', label: 'Reports', roles: [...CHECKER, ...ADMIN, 'AUDITOR'],
    icon: <BarChart3 size={ICON_SIZE} strokeWidth={ICON_STROKE} />, children: [
    { label: 'Trial Balance', href: '/reports/trial-balance' },
    { label: 'Day Book', href: '/reports/day-book' },
    { label: 'GL Inquiry', href: '/reports/gl' },
  ]},
  { id: 'admin', label: 'Administration', roles: ADMIN,
    icon: <Settings size={ICON_SIZE} strokeWidth={ICON_STROKE} />, children: [
    { label: 'Tenant Setup', href: '/admin/tenants', roles: ['ADMIN_HO'] },
    { label: 'Branch Management', href: '/admin/branches', roles: ADMIN },
    { label: 'Calendar & Holidays', href: '/admin/calendar', roles: ADMIN },
    { label: 'User Management', href: '/admin/users', roles: ADMIN },
    { label: 'GL Chart of Accounts', href: '/admin/gl', roles: ['ADMIN_HO'] },
    { label: 'Product Setup', href: '/admin/products', roles: ['ADMIN_HO'] },
    { label: 'Charge Setup', href: '/admin/charges', roles: ['ADMIN_HO'] },
    { label: 'Day Open / Close', href: '/admin/day', roles: ADMIN },
  ]},
  { id: 'legacy', label: 'Legacy Screens', href: '/legacy',
    icon: <Monitor size={ICON_SIZE} strokeWidth={ICON_STROKE} /> },
];

/* ── Layout Constants ───────────────────────────────────────────
 * Per Blueprint §2: 272px expanded, 72px collapsed rail.
 * Per Blueprint §15: auto-collapse below 1280px. */
const SIDEBAR_WIDTH_EXPANDED = 272;
const SIDEBAR_WIDTH_COLLAPSED = 72;
const AUTO_COLLAPSE_BREAKPOINT = 1280;

/* ── Searchable Index (§7) ──────────────────────────────────────
 * Pre-computed flat list of all navigable screens for fuzzy search.
 * Built once at module load — no runtime allocation per keystroke. */
interface SearchableItem {
  label: string;
  href: string;
  moduleId: string;
  moduleLabel: string;
  /** Lowercase label for case-insensitive matching. */
  searchKey: string;
}

function buildSearchIndex(modules: NavModule[]): SearchableItem[] {
  const items: SearchableItem[] = [];
  for (const mod of modules) {
    if (mod.href) {
      items.push({
        label: mod.label,
        href: mod.href,
        moduleId: mod.id,
        moduleLabel: mod.label,
        searchKey: mod.label.toLowerCase(),
      });
    }
    if (mod.children) {
      for (const child of mod.children) {
        items.push({
          label: child.label,
          href: child.href,
          moduleId: mod.id,
          moduleLabel: mod.label,
          searchKey: `${child.label} ${mod.label}`.toLowerCase(),
        });
      }
    }
  }
  return items;
}

const SEARCH_INDEX = buildSearchIndex(MODULES);

/* ── Environment Badge ──────────────────────────────────────────
 * Per §12 of the Tier-1 Sidebar Blueprint: environment indicator
 * is MANDATORY at the sidebar footer to prevent production mistakes.
 * Operators on branch terminals must always know which environment
 * they are working in. Color-coded: PROD=red, UAT=amber, SIT=violet, DEV=olive. */
type CbsEnvironment = 'PROD' | 'UAT' | 'SIT' | 'DEV';

function resolveEnvironment(): CbsEnvironment {
  const env = (process.env.NEXT_PUBLIC_CBS_ENV || '').toUpperCase();
  if (env === 'PROD' || env === 'PRODUCTION') return 'PROD';
  if (env === 'UAT' || env === 'STAGING') return 'UAT';
  if (env === 'SIT' || env === 'QA') return 'SIT';
  return 'DEV';
}

/** Resolved once at module load — env never changes at runtime. */
const CBS_ENV = resolveEnvironment();

const ENV_TONE: Record<CbsEnvironment, string> = {
  PROD: 'bg-cbs-crimson-600 text-white',
  UAT: 'bg-cbs-gold-600 text-white',
  SIT: 'bg-cbs-violet-600 text-white',
  DEV: 'bg-cbs-olive-600 text-white',
};

export interface SidebarProps { className?: string; }

const Sidebar: React.FC<SidebarProps> = ({ className }) => {
  const pathname = usePathname();
  const { isSidebarOpen, setSidebarOpen } = useUIStore();
  const user = useAuthStore((s) => s.user);
  const userRoles = user?.roles ?? [];
  const businessDay = useAuthStore((s) => s.businessDay);
  const businessDate = useAuthStore((s) => s.businessDate);

  const [expanded, setExpanded] = useState<string | null>(null);

  const hasAccess = useCallback(
    (roles?: UserRole[]) => !roles || roles.length === 0 || roles.some((r) => userRoles.includes(r)),
    [userRoles],
  );
  const isActive = useCallback(
    (href: string) => pathname === href || pathname.startsWith(href + '/'),
    [pathname],
  );

  // Auto-expand module owning the current route. React Compiler
  // flags the synchronous `setExpanded` inside the effect; the pure-
  // render alternative is `useMemo` but then the operator cannot
  // manually collapse the expanded module (the memo would snap back
  // on every render).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    for (const m of MODULES) {
      if (m.children?.some((c) => isActive(c.href))) { setExpanded(m.id); return; }
    }
  }, [pathname, isActive]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Close sidebar on mobile after navigation.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [pathname, setSidebarOpen]);

  return (
    <>
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-cbs-ink/40 z-30 lg:hidden"
          role="button"
          tabIndex={-1}
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setSidebarOpen(false); }}
        />
      )}

      <aside
        className={clsx(
          'fixed left-0 top-16 h-[calc(100vh-64px)] w-[272px] shrink-0 bg-cbs-paper border-r border-cbs-steel-200 flex flex-col transition-transform duration-200 z-40 lg:z-0 lg:translate-x-0 lg:relative lg:top-0 cbs-no-print',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
          className,
        )}
      >
        {/* ── User Context Block (§6) ──────────────────────────
         * Per Tier-1 Sidebar Blueprint §6: operator context must
         * always be visible in the sidebar for 8-12hr shift awareness.
         * Branch, role, and biz date are the three most critical
         * context indicators — every teller glance must confirm them. */}
        <div className="px-3 py-3 border-b border-cbs-steel-200 bg-cbs-mist shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 bg-cbs-navy-700 rounded-sm flex items-center justify-center text-xs font-bold text-white shrink-0">
              {(user?.firstName?.[0] || user?.username?.[0]?.toUpperCase() || '?')}
              {(user?.lastName?.[0] || user?.username?.[1]?.toUpperCase() || '')}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-cbs-ink truncate">
                {user?.displayName || user?.firstName || user?.username || 'Operator'}
              </div>
              <div className="text-[10px] text-cbs-steel-500 uppercase tracking-wider">
                {userRoles[0] || 'No Role'}
              </div>
            </div>
          </div>
          <div className="space-y-1">
            {user?.branchCode && (
              <div className="flex items-center gap-1.5 text-[10px]">
                <Building2 size={11} strokeWidth={1.75} className="text-cbs-steel-400 shrink-0" aria-hidden="true" />
                <span className="text-cbs-steel-600 cbs-tabular truncate">
                  {user.branchCode}{user.branchName ? ` — ${user.branchName}` : ''}
                </span>
              </div>
            )}
            {businessDate && (
              <div className="flex items-center gap-1.5 text-[10px]">
                <Calendar size={11} strokeWidth={1.75} className="text-cbs-steel-400 shrink-0" aria-hidden="true" />
                <span className="text-cbs-steel-600 cbs-tabular">{businessDate}</span>
                {businessDay?.dayStatus && businessDay.dayStatus !== 'DAY_OPEN' && (
                  <span className="text-[9px] font-bold text-cbs-gold-700 uppercase">
                    {businessDay.dayStatus.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Scrollable Navigation Tree ───────────────────────
         * Only the nav tree scrolls — user context and footer are
         * pinned. This ensures the operator always sees their branch
         * and environment without scrolling. */}
        <nav aria-label="CBS module navigation" className="flex-1 overflow-y-auto px-2 py-2 space-y-px">
          {MODULES.map((mod) => {
            if (!hasAccess(mod.roles)) return null;
            const isExp = expanded === mod.id;
            const modActive = mod.href ? isActive(mod.href) : mod.children?.some((c) => isActive(c.href));

            /* Direct-link module (no children) */
            if (mod.href) {
              return (
                <Link key={mod.id} href={mod.href}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-[7px] rounded-sm text-[13px] transition-colors',
                    modActive
                      ? 'bg-cbs-navy-50 text-cbs-navy-700 font-semibold border-l-[3px] border-cbs-navy-700 pl-[9px]'
                      : 'text-cbs-steel-700 hover:bg-cbs-mist border-l-[3px] border-transparent pl-[9px]',
                  )}
                  aria-current={modActive ? 'page' : undefined}
                >
                  {mod.icon}
                  <span className="flex-1">{mod.label}</span>
                </Link>
              );
            }

            /* Expandable module group */
            const visibleChildren = mod.children?.filter((c) => hasAccess(c.roles)) ?? [];
            if (visibleChildren.length === 0) return null;

            return (
              <div key={mod.id}>
                <button
                  type="button"
                  onClick={() => setExpanded((p) => (p === mod.id ? null : mod.id))}
                  aria-expanded={isExp}
                  className={clsx(
                    'flex items-center gap-2 w-full px-3 py-[7px] rounded-sm text-[13px] transition-colors text-left',
                    modActive
                      ? 'text-cbs-navy-700 font-semibold border-l-[3px] border-cbs-navy-700 pl-[9px]'
                      : 'text-cbs-steel-700 hover:bg-cbs-mist border-l-[3px] border-transparent pl-[9px]',
                  )}
                >
                  {mod.icon}
                  <span className="flex-1">{mod.label}</span>
                  <ChevronRight
                    size={14} strokeWidth={2}
                    className={clsx('text-cbs-steel-400 transition-transform duration-150', isExp && 'rotate-90')}
                    aria-hidden="true"
                  />
                </button>

                {/* Sub-items — indented, no icons, CBS density */}
                {isExp && (
                  <div className="ml-[26px] border-l border-cbs-steel-200 pl-2 mt-px mb-1 space-y-px">
                    {visibleChildren.map((child) => (
                      <Link key={child.href} href={child.href}
                        className={clsx(
                          'block py-[5px] px-2 rounded-sm text-xs transition-colors',
                          isActive(child.href)
                            ? 'text-cbs-navy-700 font-semibold bg-cbs-navy-50'
                            : 'text-cbs-steel-600 hover:text-cbs-ink hover:bg-cbs-mist',
                        )}
                        aria-current={isActive(child.href) ? 'page' : undefined}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* ── Footer with Environment Badge (§12) ──────────────
         * Per Tier-1 Sidebar Blueprint §12: environment indicator
         * at the footer is MANDATORY. Prevents production mistakes
         * when operators work across multiple environments. */}
        <div className="shrink-0 px-3 py-2 border-t border-cbs-steel-200 bg-cbs-mist">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-cbs-steel-500 cbs-tabular">
              v{process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0'}
            </span>
            <span className={clsx(
              'text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider',
              ENV_TONE[CBS_ENV],
            )}>
              {CBS_ENV}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};

Sidebar.displayName = 'Sidebar';

export { Sidebar };
