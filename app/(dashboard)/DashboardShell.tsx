'use client';

/**
 * Client-side dashboard shell.
 *
 * The parent `layout.tsx` is a Server Component that performs the
 * authoritative session check (via `readSession()` in server memory)
 * and issues a server-side redirect to `/login?reason=session_expired`
 * when no session is present. By the time this shell renders, the
 * session cookie has already been validated, so we can safely run
 * all the client-only machinery (Zustand store hydration, session
 * timeout timers, backend health polling, keyboard navigation, toast
 * overlays, etc.) without a "waiting to authenticate" flash.
 *
 * This split addresses Critical audit finding #8 — the previous
 * single-file client layout was doing its own redirect from inside
 * a `useEffect`, which meant an unauthenticated caller briefly saw
 * the dashboard shell before being bounced to /login. Moving the
 * redirect into the server layout closes that race window and also
 * lets the BFF emit the correct `session_expired` reason code.
 */
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Header, Sidebar } from '@/components/layout';
import { useAuthStore } from '@/store/authStore';
import { Spinner } from '@/components/atoms';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { useBackendHealth } from '@/hooks/useBackendHealth';
import { useCbsKeyboardNav } from '@/hooks/useCbsKeyboardNav';
import { SessionTimeoutWarning } from '@/components/molecules/SessionTimeoutWarning';
import { CbsToastContainer } from '@/components/cbs/ToastContainer';
import { PageErrorBoundary } from '@/components/cbs/CbsErrorBoundary';
import { KeyboardHelpOverlay } from '@/components/cbs/KeyboardHelpOverlay';
import { authService } from '@/services/api/authService';
import { logger } from '@/utils/logger';
import { formatCbsDate } from '@/utils/formatters';
import {
  DayStatusContext,
  type DayStatusContextValue,
} from '@/contexts/DayStatusContext';

/* ── Day-Status Operational Banner ──────────────────────────────
 * Per API_LOGIN_CONTRACT.md §14 Rule 6:
 *   DAY_OPEN     → normal operations
 *   EOD_RUNNING  → banner "EOD in progress" — disable postings
 *   DAY_CLOSED   → banner "Day closed" — read-only mode
 *   NOT_OPENED   → banner "Day not opened — contact admin"
 */
function DayStatusBanner() {
  const businessDay = useAuthStore((s) => s.businessDay);
  const dayStatus = businessDay?.dayStatus;

  if (!dayStatus || dayStatus === 'DAY_OPEN') return null;

  const config: Record<string, { label: string; message: string; tone: string }> = {
    EOD_RUNNING: {
      label: 'EOD In Progress',
      message: 'End-of-day processing is running. Transaction posting is temporarily disabled. Inquiry screens remain available.',
      tone: 'bg-cbs-gold-50 border-cbs-gold-600 text-cbs-gold-700',
    },
    DAY_CLOSED: {
      label: 'Day Closed',
      message: 'The business day is closed. All screens are in read-only mode. Transactions will be posted on the next business day.',
      tone: 'bg-cbs-crimson-50 border-cbs-crimson-600 text-cbs-crimson-700',
    },
    NOT_OPENED: {
      label: 'Day Not Opened',
      message: 'The business day has not been opened. Contact your branch administrator to perform the day-open ceremony before any operations.',
      tone: 'bg-cbs-crimson-50 border-cbs-crimson-600 text-cbs-crimson-700',
    },
  };

  const c = config[dayStatus];
  if (!c) return null;

  return (
    <div
      role="alert"
      className={`border-b px-4 py-2 flex items-center gap-3 text-sm cbs-no-print ${c.tone}`}
    >
      <span className="font-bold text-xs uppercase tracking-wider shrink-0">
        ⚠ {c.label}
      </span>
      <span>{c.message}</span>
    </div>
  );
}

/* ── Password Expiry Warning Banner ─────────────────────────────
 * Per API_LOGIN_CONTRACT.md §14 Rule 10:
 *   If passwordExpiryDate is within 7 days, show non-blocking banner.
 */
function PasswordExpiryBanner() {
  const user = useAuthStore((s) => s.user);
  const expiryDate = user?.passwordExpiryDate;

  const daysUntilExpiry = useMemo(() => {
    if (!expiryDate) return null;
    const expiry = new Date(expiryDate + 'T00:00:00');
    if (isNaN(expiry.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffMs = expiry.getTime() - today.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }, [expiryDate]);

  if (daysUntilExpiry === null || daysUntilExpiry > 7) return null;

  const isExpired = daysUntilExpiry <= 0;
  const tone = isExpired
    ? 'bg-cbs-crimson-50 border-cbs-crimson-600 text-cbs-crimson-700'
    : 'bg-cbs-gold-50 border-cbs-gold-600 text-cbs-gold-700';

  return (
    <div
      role="status"
      className={`border-b px-4 py-2 flex items-center gap-3 text-sm cbs-no-print ${tone}`}
    >
      <span className="font-bold text-xs uppercase tracking-wider shrink-0">
        🔑 {isExpired ? 'Password Expired' : 'Password Expiring'}
      </span>
      <span>
        {isExpired
          ? 'Your password has expired. Contact your branch administrator to reset it.'
          : `Your password expires on ${formatCbsDate(expiryDate!)}${daysUntilExpiry === 1 ? ' (tomorrow)' : ` (${daysUntilExpiry} days)`}. Contact your branch administrator to change it.`}
      </span>
    </div>
  );
}

/**
 * Authenticated dashboard shell — client-only sub-tree beneath the
 * server-rendered layout. See the top-of-file JSDoc for rationale.
 */
export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isHydrated, loadSession, logout } = useAuthStore();
  const [isInitialized, setIsInitialized] = useState(false);

  // Session timeout — 30 min inactivity (CBS_SESSION_IDLE_SECONDS), 2 min warning
  const { secondsRemaining, isWarningActive, resetTimer } = useSessionTimeout();

  // Backend health — polls Spring /actuator/health via BFF every 30s.
  const { backendStatus } = useBackendHealth(isAuthenticated);

  // CBS keyboard navigation (F1=Help, Alt+D=Dashboard, etc.)
  const { isHelpOpen, toggleHelp, activeKeyMap } = useCbsKeyboardNav();

  // Day-status context — controls posting-allowed flag for all children
  const businessDay = useAuthStore((s) => s.businessDay);
  const dayStatusValue = useMemo((): DayStatusContextValue => {
    const ds = businessDay?.dayStatus || null;
    if (!ds || ds === 'DAY_OPEN') {
      return { isPostingAllowed: true, dayStatus: ds, blockReason: null };
    }
    const reasons: Record<string, string> = {
      EOD_RUNNING: 'End-of-day processing is in progress',
      DAY_CLOSED: 'Business day is closed',
      NOT_OPENED: 'Business day has not been opened',
    };
    return {
      isPostingAllowed: false,
      dayStatus: ds,
      blockReason: reasons[ds] || 'Day status does not permit postings',
    };
  }, [businessDay?.dayStatus]);

  useEffect(() => {
    // Hydrate auth state from the server-side BFF session, then mark ready.
    void loadSession().finally(() => setIsInitialized(true));
  }, [loadSession]);

  useEffect(() => {
    // The server layout has already guaranteed a valid session cookie
    // was present at render time, but the client store may still be
    // empty (first paint) or a later store-reset (e.g. 401 interceptor)
    // may have cleared it. Redirect with the appropriate reason code.
    if (isInitialized && !isAuthenticated) {
      router.push('/login?reason=session_expired');
    }
  }, [isInitialized, isAuthenticated, router]);

  const handleStayLoggedIn = async () => {
    try {
      await authService.extendSession();
      resetTimer();
    } catch (err) {
      logger.warn('Session extend failed — server session may have expired', err);
    }
  };

  const handleLogoutNow = async () => {
    await logout();
    if (typeof window !== 'undefined') {
      window.location.href = '/login?reason=logged_out';
    }
  };

  // Still hydrating — show spinner, not a redirect
  if (!isInitialized || !isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" message="Initializing..." />
      </div>
    );
  }

  // Hydrated but not authenticated — waiting for redirect
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" message="Redirecting to login..." />
      </div>
    );
  }

  return (
    <DayStatusContext.Provider value={dayStatusValue}>
      <div className="flex flex-col h-screen bg-cbs-mist">
        <a
          href="#cbs-main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-cbs-navy-800 focus:text-white focus:text-sm focus:font-semibold focus:rounded focus:outline-none focus:ring-2 focus:ring-cbs-navy-400"
        >
          Skip to main content
        </a>
        <Header />

        {backendStatus === 'DOWN' && (
          <div
            role="alert"
            className="bg-cbs-crimson-50 border-b border-cbs-crimson-600 px-4 py-2 flex items-center gap-3 text-sm text-cbs-crimson-700 cbs-no-print"
          >
            <span className="font-bold text-xs uppercase tracking-wider shrink-0">
              ⚠ System Unavailable
            </span>
            <span>
              The banking server is not responding. Transactions cannot be
              processed until the connection is restored. If this persists,
              contact IT support.
            </span>
          </div>
        )}

        <DayStatusBanner />
        <PasswordExpiryBanner />

        <div className="flex flex-1 min-h-0">
          <Sidebar />
          <main id="cbs-main" className="flex-1 overflow-y-auto" tabIndex={-1}>
            <div className="p-3 sm:p-4 lg:p-6">
              <PageErrorBoundary moduleRef="MAIN">
                {children}
              </PageErrorBoundary>
            </div>
          </main>
        </div>

        <CbsToastContainer />

        <KeyboardHelpOverlay
          isOpen={isHelpOpen}
          onClose={toggleHelp}
          keyMap={activeKeyMap}
        />

        {isWarningActive && secondsRemaining !== null && (
          <SessionTimeoutWarning
            secondsRemaining={secondsRemaining}
            onStayLoggedIn={handleStayLoggedIn}
            onLogout={handleLogoutNow}
          />
        )}
      </div>
    </DayStatusContext.Provider>
  );
}

// Re-export useDayStatus for downstream imports that pulled it off
// the old layout file.
export { useDayStatus } from '@/contexts/DayStatusContext';
