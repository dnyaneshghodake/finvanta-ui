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
 *   - Collapsed rail identity: initials avatar + hover tooltip (§6)
 *   - Expanded mode: no user block (Header is single source of truth)
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
import { usePathname, useRouter } from 'next/navigation';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import clsx from 'clsx';
import {
  LayoutDashboard, Landmark, ArrowLeftRight, ClipboardCheck,
  Users, UserPlus, Banknote, CreditCard, BarChart3, Settings, Monitor,
  ChevronRight, Search, ChevronsLeft, ChevronsRight,
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

/* PROD uses a filled crimson badge — the most alarming visual treatment
 * in the palette — because production mistakes are irreversible. The
 * filled style is intentionally different from tinted status badges so
 * operators can distinguish "I am in PROD" from "this record is rejected"
 * at a glance. Uses crimson-600 bg + cbs-paper text:
 *   Light: #9a1d1d bg + #ffffff text = 7.8:1 ✓
 *   Dark:  #f85149 bg + #161b22 text = 5.2:1 ✓ (AA)
 *
 * UAT/SIT/DEV use the tinted-badge pattern (-50 bg + -700 text) which
 * works in both light and dark themes because the -50/-700 pair inverts
 * together. */
const ENV_TONE: Record<CbsEnvironment, string> = {
  PROD: 'bg-cbs-crimson-600 text-cbs-paper border border-cbs-crimson-700',
  UAT: 'bg-cbs-gold-50 text-cbs-gold-700 border border-cbs-gold-600',
  SIT: 'bg-cbs-violet-50 text-cbs-violet-700 border border-cbs-violet-600',
  DEV: 'bg-cbs-olive-50 text-cbs-olive-700 border border-cbs-olive-600',
};

export interface SidebarProps { className?: string; }

const Sidebar: React.FC<SidebarProps> = ({ className }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { isSidebarOpen, setSidebarOpen, isSidebarCollapsed, setSidebarCollapsed, toggleSidebarCollapse } = useUIStore();
  const user = useAuthStore((s) => s.user);
  const userRoles = user?.roles ?? [];
  const businessDate = useAuthStore((s) => s.businessDate);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchHighlight, setSearchHighlight] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* Per uiStore §9: isSidebarCollapsed is irrelevant on mobile —
   * the drawer is always full-width. Track desktop state to ensure
   * collapsed rail never renders in the mobile overlay drawer.
   * Initial setState call is intentional — subscribes to matchMedia
   * external system and sets initial value after hydration. */
  const [isDesktop, setIsDesktop] = useState(false);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsDesktop(e.matches);
    handler(mql);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  const collapsed = isSidebarCollapsed && isDesktop;

  /** Hydration-safe platform detection for keyboard shortcut hints.
   *  setState is intentional — must run after hydration to avoid mismatch. */
  const [isMac, setIsMac] = useState(false);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setIsMac(/Mac|iPod|iPhone|iPad/.test(navigator.platform));
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const hasAccess = useCallback(
    (roles?: UserRole[]) => !roles || roles.length === 0 || roles.some((r) => userRoles.includes(r)),
    [userRoles],
  );
  const isActive = useCallback(
    (href: string) => pathname === href || pathname.startsWith(href + '/'),
    [pathname],
  );
  /** Exact match — for aria-current="page" which must mark only the single current page (WCAG). */
  const isExactPage = useCallback(
    (href: string) => pathname === href,
    [pathname],
  );

  /* ── Search Results (§7) ─────────────────────────────────────
   * Role-filtered fuzzy match over the pre-built search index.
   * Filters by substring match on the lowercase search key.
   * Memoized to avoid re-computation on unrelated re-renders. */
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return SEARCH_INDEX.filter((item) => {
      const mod = MODULES.find((m) => m.id === item.moduleId);
      if (!hasAccess(mod?.roles)) return false;
      const child = mod?.children?.find((c) => c.href === item.href);
      if (child && !hasAccess(child.roles)) return false;
      return item.searchKey.includes(q);
    }).slice(0, 8);
  }, [searchQuery, hasAccess]);

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

  // Close search on navigation. setState calls are intentional —
  // search must reset when the operator navigates to a new screen.
  // Also re-assert auto-collapse on narrow desktops (§15) since
  // Ctrl+K temporarily expands the sidebar for search input.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchHighlight(0);
    if (typeof window !== 'undefined' && window.innerWidth >= 1024 && window.innerWidth < AUTO_COLLAPSE_BREAKPOINT) {
      setSidebarCollapsed(true);
    }
  }, [pathname, setSidebarCollapsed]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* ── Auto-collapse on narrow desktops (§15) ──────────────────
   * Per Blueprint §15: below 1280px → auto collapse to rail.
   * Per uiStore §9: isSidebarCollapsed is irrelevant on mobile
   * (< 1024px) — the drawer is always full-width. The media query
   * must only target the desktop range (1024px–1279px) to avoid
   * setting collapsed=true on mobile viewports. */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(`(min-width: 1024px) and (max-width: ${AUTO_COLLAPSE_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setSidebarCollapsed(e.matches);
    };
    handler(mql);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [setSidebarCollapsed]);

  /* ── Ctrl+K global search shortcut (§7) ──────────────────────
   * Registered here (not in useCbsKeyboardNav) because the search
   * input lives inside the sidebar component tree. The global hook
   * dispatches a custom event; we listen for it as a fallback. */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        e.stopPropagation();
        setIsSearchOpen(true);
        // If collapsed, expand temporarily for search
        if (isSidebarCollapsed) setSidebarCollapsed(false);
        requestAnimationFrame(() => searchInputRef.current?.focus());
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [isSidebarCollapsed, setSidebarCollapsed]);

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
          'fixed left-0 top-16 h-[calc(100vh-64px)] shrink-0 bg-cbs-paper border-r border-cbs-steel-200 flex flex-col transition-transform duration-200 z-40 lg:z-0 lg:translate-x-0 lg:relative lg:top-0 cbs-no-print',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
          className,
        )}
        style={{ width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED }}
      >
        {/* ── Collapsed Rail Identity (§6) ─────────────────────
         * Per Tier-1 CBS convention: the Header chrome bar is the
         * single source of truth for operator context (branch, date,
         * identity, role). The sidebar is exclusively for navigation.
         *
         * In collapsed rail mode only: show initials avatar with a
         * hover tooltip so the operator can confirm identity without
         * expanding the sidebar. In expanded mode: nothing — the
         * Header already provides complete context. */}
        {collapsed && (
          <div className="border-b border-cbs-steel-200 bg-cbs-mist shrink-0 px-2 py-3 flex justify-center">
            <div className="relative group">
              <div className="h-8 w-8 bg-cbs-navy-700 rounded-sm flex items-center justify-center text-xs font-bold text-white shrink-0">
                {(user?.firstName?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || '?')}
                {(user?.lastName?.[0]?.toUpperCase() || user?.username?.[1]?.toUpperCase() || '')}
              </div>
              <div className="absolute left-full top-0 ml-2 hidden group-hover:block z-50 w-52 bg-cbs-paper border border-cbs-steel-200 rounded-sm shadow-md p-2.5 pointer-events-none">
                <div className="text-xs font-semibold text-cbs-ink truncate">
                  {user?.displayName || user?.firstName || user?.username || 'Operator'}
                </div>
                <div className="text-[10px] text-cbs-steel-500 uppercase tracking-wider mt-0.5">
                  {userRoles[0] || 'No Role'}
                </div>
                {user?.branchCode && (
                  <div className="text-[10px] text-cbs-steel-600 cbs-tabular mt-1">
                    {user.branchCode}{user.branchName ? ` — ${user.branchName}` : ''}
                  </div>
                )}
                {businessDate && (
                  <div className="text-[10px] text-cbs-steel-600 cbs-tabular mt-0.5">
                    {businessDate}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Navigation Search (§7) ────────────────────────────
         * Per Blueprint §7: Ctrl+K fuzzy search across all screens.
         * In collapsed mode: search icon that expands sidebar. */}
        {!collapsed ? (
          <div className="shrink-0 px-2 py-2 border-b border-cbs-steel-200">
            {isSearchOpen ? (
              <div className="relative">
                <Search size={14} strokeWidth={1.75} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cbs-steel-400 pointer-events-none" aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setSearchHighlight(0); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { setIsSearchOpen(false); setSearchQuery(''); }
                    if (e.key === 'ArrowDown' && searchResults.length > 0) { e.preventDefault(); setSearchHighlight((p) => Math.min(p + 1, searchResults.length - 1)); }
                    if (e.key === 'ArrowUp' && searchResults.length > 0) { e.preventDefault(); setSearchHighlight((p) => Math.max(p - 1, 0)); }
                    if (e.key === 'Enter' && searchResults[searchHighlight]) {
                      router.push(searchResults[searchHighlight].href);
                      setIsSearchOpen(false);
                      setSearchQuery('');
                    }
                  }}
                  placeholder="Search screens… (Esc to close)"
                  className="w-full h-8 pl-8 pr-2 text-xs bg-cbs-paper border border-cbs-steel-300 rounded-sm outline-none focus:border-cbs-navy-500 placeholder:text-cbs-steel-400"
                  aria-label="Search navigation screens"
                  role="combobox"
                  aria-expanded={searchResults.length > 0}
                  aria-controls="cbs-nav-search-results"
                  aria-activedescendant={searchResults.length > 0 ? `cbs-search-${searchHighlight}` : undefined}
                />
                {searchResults.length > 0 && (
                  <ul id="cbs-nav-search-results" role="listbox" className="absolute left-0 right-0 top-full mt-1 bg-cbs-paper border border-cbs-steel-200 rounded-sm shadow-md z-50 py-1 max-h-64 overflow-y-auto">
                    {searchResults.map((item, i) => (
                      <li key={item.href} id={`cbs-search-${i}`} role="option" aria-selected={i === searchHighlight}>
                        <Link
                          href={item.href}
                          className={clsx(
                            'block px-3 py-1.5 text-xs transition-colors',
                            i === searchHighlight ? 'bg-cbs-navy-50 text-cbs-navy-700' : 'text-cbs-steel-700 hover:bg-cbs-mist',
                          )}
                          onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }}
                        >
                          <span className="font-medium">{item.label}</span>
                          <span className="text-cbs-steel-400 ml-1.5">— {item.moduleLabel}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {searchQuery.trim() && searchResults.length === 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-cbs-paper border border-cbs-steel-200 rounded-sm shadow-md z-50 px-3 py-2 text-xs text-cbs-steel-500">
                    No screens found
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setIsSearchOpen(true); requestAnimationFrame(() => searchInputRef.current?.focus()); }}
                className="flex items-center gap-2 w-full h-8 px-2.5 text-xs text-cbs-steel-400 bg-cbs-paper border border-cbs-steel-200 rounded-sm hover:border-cbs-steel-300 transition-colors"
              >
                <Search size={14} strokeWidth={1.75} aria-hidden="true" />
                <span className="flex-1 text-left">Search…</span>
                <kbd className="text-[10px] text-cbs-steel-400 bg-cbs-steel-50 border border-cbs-steel-200 rounded-sm px-1 py-px font-mono">{isMac ? '⌘K' : 'Ctrl+K'}</kbd>
              </button>
            )}
          </div>
        ) : (
          <div className="shrink-0 px-2 py-2 border-b border-cbs-steel-200 flex justify-center">
            <button
              type="button"
              onClick={() => { setSidebarCollapsed(false); setIsSearchOpen(true); requestAnimationFrame(() => searchInputRef.current?.focus()); }}
              className="h-8 w-8 flex items-center justify-center rounded-sm text-cbs-steel-500 hover:bg-cbs-mist hover:text-cbs-steel-700 transition-colors"
              aria-label="Search navigation (Ctrl+K)"
            >
              <Search size={ICON_SIZE} strokeWidth={ICON_STROKE} />
            </button>
          </div>
        )}

        {/* ── Scrollable Navigation Tree ───────────────────────
         * Only the nav tree scrolls — user context and footer are
         * pinned. In collapsed mode, icons are centered with
         * hover-flyout tooltips showing sub-items. */}
        <nav aria-label="CBS module navigation" className={clsx('flex-1 overflow-y-auto py-2 space-y-px', collapsed ? 'px-1.5' : 'px-2')}>
          {MODULES.map((mod) => {
            if (!hasAccess(mod.roles)) return null;
            const isExp = expanded === mod.id;
            const modActive = mod.href ? isActive(mod.href) : mod.children?.some((c) => isActive(c.href));

            /* ── Collapsed rail: icon-only with tooltip flyout ── */
            if (collapsed) {
              const firstHref = mod.href || mod.children?.find((c) => hasAccess(c.roles))?.href || '#';
              return (
                <div key={mod.id} className="relative group">
                  <Link href={firstHref}
                    className={clsx(
                      'flex items-center justify-center h-10 w-full rounded-sm transition-colors',
                      modActive
                        ? 'bg-cbs-navy-50 text-cbs-navy-700 border-l-[3px] border-cbs-navy-700'
                        : 'text-cbs-steel-600 hover:bg-cbs-mist border-l-[3px] border-transparent',
                    )}
                    aria-current={mod.href && isExactPage(mod.href) ? 'page' : undefined}
                    aria-label={mod.label}
                  >
                    {mod.icon}
                  </Link>
                  {/* Tooltip flyout — module label + children */}
                  <div className="absolute left-full top-0 ml-1.5 hidden group-hover:block z-50 min-w-[180px] bg-cbs-paper border border-cbs-steel-200 rounded-sm shadow-md py-1">
                    <div className="px-3 py-1.5 text-xs font-semibold text-cbs-ink border-b border-cbs-steel-100">
                      {mod.label}
                    </div>
                    {mod.children ? mod.children.filter((c) => hasAccess(c.roles)).map((child) => (
                      <Link key={child.href} href={child.href}
                        className={clsx(
                          'block px-3 py-1.5 text-xs transition-colors',
                          isActive(child.href)
                            ? 'text-cbs-navy-700 font-semibold bg-cbs-navy-50'
                            : 'text-cbs-steel-600 hover:text-cbs-ink hover:bg-cbs-mist',
                        )}
                        aria-current={isExactPage(child.href) ? 'page' : undefined}
                      >
                        {child.label}
                      </Link>
                    )) : (
                      <Link href={mod.href || '#'}
                        className="block px-3 py-1.5 text-xs text-cbs-steel-600 hover:text-cbs-ink hover:bg-cbs-mist"
                      >
                        Open {mod.label}
                      </Link>
                    )}
                  </div>
                </div>
              );
            }

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
                  aria-current={mod.href && isExactPage(mod.href) ? 'page' : undefined}
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
                        aria-current={isExactPage(child.href) ? 'page' : undefined}
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

        {/* ── Footer: Collapse Toggle + Environment Badge (§9, §12)
         * Per Blueprint §9: collapse toggle always visible in footer.
         * Per Blueprint §12: environment badge is MANDATORY. */}
        <div className="shrink-0 border-t border-cbs-steel-200 bg-cbs-mist">
          {collapsed ? (
            /* Collapsed footer: collapse toggle + env badge stacked */
            <div className="flex flex-col items-center gap-1.5 py-2">
              <button
                type="button"
                onClick={toggleSidebarCollapse}
                className="h-7 w-7 flex items-center justify-center rounded-sm text-cbs-steel-500 hover:bg-cbs-steel-100 hover:text-cbs-steel-700 transition-colors"
                aria-label="Expand sidebar"
              >
                <ChevronsRight size={16} strokeWidth={1.75} />
              </button>
              <span className={clsx(
                'text-[8px] font-bold px-1 py-px rounded-sm uppercase tracking-wider leading-none',
                ENV_TONE[CBS_ENV],
              )}>
                {CBS_ENV}
              </span>
            </div>
          ) : (
            /* Expanded footer: version + env badge + collapse toggle */
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-[10px] text-cbs-steel-500 cbs-tabular">
                v{process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0'}
              </span>
              <div className="flex items-center gap-1.5">
                <span className={clsx(
                  'text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider',
                  ENV_TONE[CBS_ENV],
                )}>
                  {CBS_ENV}
                </span>
                <button
                  type="button"
                  onClick={toggleSidebarCollapse}
                  className="h-6 w-6 flex items-center justify-center rounded-sm text-cbs-steel-400 hover:bg-cbs-steel-100 hover:text-cbs-steel-700 transition-colors"
                  aria-label="Collapse sidebar"
                >
                  <ChevronsLeft size={14} strokeWidth={1.75} />
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

Sidebar.displayName = 'Sidebar';

export { Sidebar };
