/**
 * CBS Sidebar — Tier-1 navigation panel.
 * @file src/components/layout/Sidebar.tsx
 *
 * Icon conventions (CBS standard):
 *   - 18px stroke icons (lucide-react), strokeWidth 1.75
 *   - Semantic mapping: LayoutDashboard for dashboard,
 *     Landmark for accounts (bank building), ArrowLeftRight
 *     for transfers, Users for beneficiaries, ClipboardCheck
 *     for workflow/approvals, Monitor for legacy bridge.
 *   - No filled icons on navigation — stroke only.
 *   - Active state inherits text color from parent (navy-700).
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUIStore } from '@/store/uiStore';
import clsx from 'clsx';
import {
  LayoutDashboard,
  Landmark,
  ArrowLeftRight,
  Users,
  ClipboardCheck,
  Monitor,
} from 'lucide-react';

/** CBS icon size: 18px, strokeWidth 1.75 for data-dense sidebar. */
const ICON_SIZE = 18;
const ICON_STROKE = 1.75;

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

/**
 * CBS navigation items — ordered by teller workflow frequency.
 * Dashboard → Accounts → Transfers → Workflow → Beneficiaries → Legacy.
 */
const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
  },
  {
    label: 'Accounts',
    href: '/accounts',
    icon: <Landmark size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
  },
  {
    label: 'Transfers',
    href: '/transfers',
    icon: <ArrowLeftRight size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
  },
  {
    label: 'Workflow',
    href: '/workflow',
    icon: <ClipboardCheck size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
  },
  {
    label: 'Beneficiaries',
    href: '/beneficiaries',
    icon: <Users size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
  },
  {
    label: 'Legacy Screens',
    href: '/legacy',
    icon: <Monitor size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
  },
];

/**
 * Sidebar component props
 */
export interface SidebarProps {
  className?: string;
}

/**
 * Sidebar component
 */
const Sidebar: React.FC<SidebarProps> = ({ className }) => {
  const pathname = usePathname();
  const { isSidebarOpen, setSidebarOpen } = useUIStore();

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/');
  };

  React.useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [pathname, setSidebarOpen]);

  return (
    <>
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-cbs-ink/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — CBS token palette, no rounded-lg */}
      <aside
        className={clsx(
          'fixed left-0 top-12 h-[calc(100vh-48px)] w-56 bg-cbs-paper border-r border-cbs-steel-200 overflow-y-auto transition-transform duration-200 z-40 lg:translate-x-0 lg:relative lg:top-0 lg:h-auto cbs-no-print',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
          className
        )}
      >
        <nav className="px-2 py-3 space-y-0.5">
          {navItems.map((item) => (
            <div key={item.href}>
              <Link
                href={item.href}
                className={clsx(
                  'flex items-center gap-2.5 px-3 py-2 rounded-sm text-sm transition-colors duration-100',
                  isActive(item.href)
                    ? 'bg-cbs-navy-50 text-cbs-navy-700 font-semibold border-l-2 border-cbs-navy-600'
                    : 'text-cbs-steel-700 hover:bg-cbs-mist'
                )}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
              </Link>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
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
