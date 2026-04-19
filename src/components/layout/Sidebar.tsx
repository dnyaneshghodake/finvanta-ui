/**
 * Sidebar component for CBS Banking Application
 * @file src/components/layout/Sidebar.tsx
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUIStore } from '@/store/uiStore';
import clsx from 'clsx';

/**
 * Navigation item interface
 */
interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  children?: NavItem[];
}

/**
 * Navigation items
 */
const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 12l2-3m0 0l7-4 7 4M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9m-9 16l4-4m0 0l4 4m-4-4v4m0-11l4 2m0 0l4-2"
        />
      </svg>
    ),
  },
  {
    label: 'Accounts',
    href: '/accounts',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 6a3 3 0 013-3h2.25a3 3 0 013 3v2.25a3 3 0 01-3 3H6a3 3 0 01-3-3V6zM9 3.75A2.25 2.25 0 0011.25 6v2.25A2.25 2.25 0 009 10.5H6.75A2.25 2.25 0 014.5 8.25V6A2.25 2.25 0 016.75 3.75H9z"
        />
      </svg>
    ),
  },
  {
    label: 'Transfers',
    href: '/transfers',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3v-6"
        />
      </svg>
    ),
  },
  {
    label: 'Beneficiaries',
    href: '/beneficiaries',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 4.354a4 4 0 110 5.292M15 12H9m4 13H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v16a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    label: 'Cards',
    href: '/cards',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 10h18M7 15h8m4 0a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
    ),
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
