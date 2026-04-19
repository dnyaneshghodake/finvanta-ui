/**
 * CBS Sidebar — Tier-1 module → sub-navigation panel.
 * @file src/components/layout/Sidebar.tsx
 *
 * Tier-1 CBS convention (RBI IT Governance 2023):
 *   - Module headers expand/collapse to reveal operation sub-items.
 *   - Accordion: only one module open at a time.
 *   - Sub-items are role-gated (MAKER/CHECKER/ADMIN).
 *   - Active sub-item auto-expands its parent module.
 *   - Icons: 18px stroke on module headers only.
 *   - Sub-items: indent + text only (CBS density convention).
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import clsx from 'clsx';
import {
  LayoutDashboard, Landmark, ArrowLeftRight, ClipboardCheck,
  Users, UserPlus, Banknote, CreditCard, BarChart3, Settings, Monitor,
  ChevronRight,
} from 'lucide-react';
import type { UserRole } from '@/types/entities';

const ICON_SIZE = 18;
const ICON_STROKE = 1.75;
const MAKER: UserRole[] = ['MAKER', 'TELLER', 'OFFICER'];
const CHECKER: UserRole[] = ['CHECKER', 'MANAGER', 'APPROVER'];
const ADMIN: UserRole[] = ['ADMIN_HO', 'BRANCH_ADMIN'];

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
    { label: 'Tenant Setup', href: '/admin/tenants' },
    { label: 'Branch Management', href: '/admin/branches' },
    { label: 'Calendar & Holidays', href: '/admin/calendar' },
    { label: 'User Management', href: '/admin/users' },
    { label: 'GL Chart of Accounts', href: '/admin/gl' },
    { label: 'Product Setup', href: '/admin/products' },
    { label: 'Charge Setup', href: '/admin/charges' },
    { label: 'Day Open / Close', href: '/admin/day' },
  ]},
  { id: 'legacy', label: 'Legacy Screens', href: '/legacy',
    icon: <Monitor size={ICON_SIZE} strokeWidth={ICON_STROKE} /> },
];

export interface SidebarProps { className?: string; }

const Sidebar: React.FC<SidebarProps> = ({ className }) => {
  const pathname = usePathname();
  const { isSidebarOpen, setSidebarOpen } = useUIStore();
  const user = useAuthStore((s) => s.user);
  const userRoles = user?.roles ?? [];

  const [expanded, setExpanded] = useState<string | null>(null);

  const hasAccess = useCallback(
    (roles?: UserRole[]) => !roles || roles.length === 0 || roles.some((r) => userRoles.includes(r)),
    [userRoles],
  );
  const isActive = useCallback(
    (href: string) => pathname === href || pathname.startsWith(href + '/'),
    [pathname],
  );

  // Auto-expand module owning the current route.
  useEffect(() => {
    for (const m of MODULES) {
      if (m.children?.some((c) => isActive(c.href))) { setExpanded(m.id); return; }
    }
  }, [pathname, isActive]);

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
          'fixed left-0 top-12 h-[calc(100vh-48px)] w-56 shrink-0 bg-cbs-paper border-r border-cbs-steel-200 overflow-y-auto transition-transform duration-200 z-40 lg:z-0 lg:translate-x-0 lg:sticky lg:top-12 cbs-no-print',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
          className,
        )}
      >
        <nav aria-label="CBS module navigation" className="px-2 py-2 space-y-px pb-10">
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
                    modActive ? 'bg-cbs-navy-50 text-cbs-navy-700 font-semibold' : 'text-cbs-steel-700 hover:bg-cbs-mist',
                  )}
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
                  className={clsx(
                    'flex items-center gap-2 w-full px-3 py-[7px] rounded-sm text-[13px] transition-colors text-left',
                    modActive ? 'text-cbs-navy-700 font-semibold' : 'text-cbs-steel-700 hover:bg-cbs-mist',
                  )}
                >
                  {mod.icon}
                  <span className="flex-1">{mod.label}</span>
                  <ChevronRight
                    size={14} strokeWidth={2}
                    className={clsx('text-cbs-steel-400 transition-transform duration-150', isExp && 'rotate-90')}
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

        <div className="absolute bottom-0 left-0 right-0 px-3 py-2 border-t border-cbs-steel-200 bg-cbs-mist">
          <p className="text-[10px] text-cbs-steel-500 cbs-tabular">
            v{process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0'}
          </p>
        </div>
      </aside>
    </>
  );
};

Sidebar.displayName = 'Sidebar';

export { Sidebar };
