/**
 * CBS Header — Tier-1 chrome bar.
 * @file src/components/layout/Header.tsx
 *
 * Mandatory elements per Tier-1 CBS convention:
 *   - Brand mark (left)
 *   - Branch code + branch name (center-left, always visible)
 *   - Business date (center-right, always visible)
 *   - Operator identity + role badge (right)
 *   - Logout action
 *
 * Branch and business date are the two most critical context
 * indicators in any CBS — every teller glance must confirm they
 * are operating in the correct branch on the correct value date.
 */

'use client';

import { useState, useEffect, useRef, useCallback, FC } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { Menu, ChevronDown, LogOut } from 'lucide-react';

export interface HeaderProps {
  className?: string;
}

const Header: FC<HeaderProps> = ({ className }) => {
  const { user, logout } = useAuthStore();
  const { toggleSidebar } = useUIStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setIsDropdownOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen, handleClickOutside]);

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = '/login';
    } catch {
      // Best-effort; redirect regardless
    }
  };

  // Business date: read from the server-authoritative session (populated
  // from Spring DayOpenService at login, refreshed via heartbeat).
  // Never use `new Date()` on the client — the CBS business date can
  // differ from the calendar date (e.g. after midnight before day-close).
  const rawBizDate = useAuthStore((s) => s.businessDate);
  const bizDate = (() => {
    if (!rawBizDate) return '--';
    const d = new Date(rawBizDate + 'T00:00:00');
    if (isNaN(d.getTime())) return rawBizDate;
    const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
  })();

  const initials =
    (user?.firstName?.[0] || user?.username?.[0]?.toUpperCase() || '?') +
    (user?.lastName?.[0] || user?.username?.[1]?.toUpperCase() || '');

  const displayName = user?.displayName || user?.firstName || user?.username || 'Operator';
  const primaryRole = user?.roles?.[0] || '';

  // Day status from the server-authoritative businessDay context.
  const businessDay = useAuthStore((s) => s.businessDay);
  const dayStatus = businessDay?.dayStatus || null;
  const DAY_STATUS_LABEL: Record<string, string> = {
    DAY_OPEN: 'Day Open',
    DAY_CLOSED: 'Day Closed',
    DAY_CLOSE: 'Day Closed',
    EOD_IN_PROGRESS: 'EOD In Progress',
    BOD_IN_PROGRESS: 'BOD In Progress',
  };
  const DAY_STATUS_TONE: Record<string, string> = {
    DAY_OPEN: 'text-cbs-olive-700 bg-cbs-olive-50',
    DAY_CLOSED: 'text-cbs-crimson-700 bg-cbs-crimson-50',
    DAY_CLOSE: 'text-cbs-crimson-700 bg-cbs-crimson-50',
    EOD_IN_PROGRESS: 'text-cbs-gold-700 bg-cbs-gold-50',
    BOD_IN_PROGRESS: 'text-cbs-gold-700 bg-cbs-gold-50',
  };

  return (
    <header
      className={`bg-cbs-navy-800 text-white sticky top-0 z-50 cbs-no-print ${className || ''}`}
    >
      <div className="flex items-center justify-between h-12 px-3">
        {/* Left: hamburger + brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded hover:bg-cbs-navy-700 lg:hidden"
            aria-label="Toggle sidebar"
          >
            <Menu size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>

          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 bg-white text-cbs-navy-800 flex items-center justify-center text-xs font-bold rounded-sm">
              FV
            </div>
            <span className="text-sm font-semibold tracking-wide hidden sm:inline">
              FINVANTA
            </span>
          </Link>
        </div>

        {/* Center: Branch + Business Date — mandatory CBS context */}
        <div className="hidden md:flex items-center gap-4 text-xs">
          {user?.branchCode && (
            <div className="flex items-center gap-1.5">
              <span className="text-cbs-navy-300 uppercase tracking-wider text-[10px] font-semibold">Branch</span>
              <span className="cbs-tabular font-semibold text-white">
                {user.branchCode}
                {user.branchName ? ` — ${user.branchName}` : ''}
              </span>
            </div>
          )}
          <div className="w-px h-4 bg-cbs-navy-600" />
          <div className="flex items-center gap-1.5">
            <span className="text-cbs-navy-300 uppercase tracking-wider text-[10px] font-semibold">Biz Date</span>
            <span className="cbs-tabular font-semibold text-white">{bizDate}</span>
          </div>
          {dayStatus && (
            <>
              <div className="w-px h-4 bg-cbs-navy-600" />
              <span className={`cbs-ribbon text-[10px] ${DAY_STATUS_TONE[dayStatus] || 'text-cbs-steel-700 bg-cbs-mist'}`}>
                {DAY_STATUS_LABEL[dayStatus] || dayStatus.replace(/_/g, ' ')}
              </span>
            </>
          )}
        </div>

        {/* Right: operator identity */}
        <div className="relative flex items-center gap-2" ref={dropdownRef}>
          {primaryRole && (
            <span className="hidden sm:inline-flex cbs-ribbon text-cbs-navy-200 border-cbs-navy-500 text-[10px]">
              {primaryRole}
            </span>
          )}
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-cbs-navy-700 transition-colors"
            aria-expanded={isDropdownOpen}
            aria-haspopup="true"
            aria-label={`${displayName} menu`}
          >
            <div className="w-7 h-7 bg-cbs-navy-600 rounded-sm flex items-center justify-center text-xs font-semibold">
              {initials}
            </div>
            <span className="text-xs font-medium hidden sm:inline">{displayName}</span>
            <ChevronDown
              size={14}
              strokeWidth={2}
              className={`transition-transform duration-150 ${isDropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-cbs-paper border border-cbs-steel-200 rounded-sm shadow-md z-50 py-1">
              {/* Mobile-only: branch + date */}
              <div className="md:hidden px-3 py-2 border-b border-cbs-steel-100 space-y-1">
                {user?.branchCode && (
                  <div className="text-xs text-cbs-steel-600">
                    <span className="cbs-field-label">Branch</span>{' '}
                    <span className="cbs-tabular font-medium text-cbs-ink">{user.branchCode}</span>
                  </div>
                )}
                <div className="text-xs text-cbs-steel-600">
                  <span className="cbs-field-label">Biz Date</span>{' '}
                  <span className="cbs-tabular font-medium text-cbs-ink">{bizDate}</span>
                </div>
              </div>
              <div className="px-3 py-2 border-b border-cbs-steel-100">
                <div className="text-xs font-semibold text-cbs-ink">{displayName}</div>
                {primaryRole && (
                  <div className="text-[10px] text-cbs-steel-500 uppercase tracking-wider mt-0.5">{primaryRole}</div>
                )}
              </div>
              <div className="border-t border-cbs-steel-100 mt-1 pt-1">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-cbs-crimson-700 hover:bg-cbs-crimson-50"
                >
                  <LogOut size={14} strokeWidth={1.75} />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

Header.displayName = 'Header';

export { Header };
