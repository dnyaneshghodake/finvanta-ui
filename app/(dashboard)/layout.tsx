'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Header, Sidebar } from '@/components/layout';
import { useAuthStore } from '@/store/authStore';
import { Spinner } from '@/components/atoms';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { useBackendHealth } from '@/hooks/useBackendHealth';
import { SessionTimeoutWarning } from '@/components/molecules/SessionTimeoutWarning';
import { CbsToastContainer } from '@/components/cbs/ToastContainer';
import { authService } from '@/services/api/authService';
import { logger } from '@/utils/logger';
import { formatCbsDate } from '@/utils/formatters';

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
 * Authenticated layout for all dashboard pages.
 *
 * Enforces:
 * - Auth hydration before rendering
 * - Redirect to /login if not authenticated
 * - Session inactivity timeout with countdown warning
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isHydrated, loadSession, logout } = useAuthStore();
  const [isInitialized, setIsInitialized] = useState(false);

  // Session timeout — 15 min inactivity, 2 min warning
  const { secondsRemaining, isWarningActive, resetTimer } = useSessionTimeout();

  // Backend health — polls Spring /actuator/health via BFF every 30s.
  // Shows a persistent banner when the banking server is unreachable
  // so operators know the issue is server-side, not their session.
  const { backendStatus } = useBackendHealth(isAuthenticated);

  useEffect(() => {
    // Hydrate auth state from the server-side BFF session, then mark ready.
    void loadSession().finally(() => setIsInitialized(true));
  }, [loadSession]);

  useEffect(() => {
    // Only redirect after hydration is complete
    if (isInitialized && !isAuthenticated) {
      router.push('/login');
    }
  }, [isInitialized, isAuthenticated, router]);

  const handleStayLoggedIn = async () => {
    try {
      // Extend the server-side session first (pushes fv_sid expiresAt
      // forward, capped at the absolute TTL ceiling anchored to
      // issuedAt). Without this the server session expires even though
      // the client timer was reset, causing surprise 401s.
      await authService.extendSession();
    } catch (err) {
      logger.warn('Session extend failed — server session may have expired', err);
    }
    // Reset the client-side inactivity timer regardless so the
    // warning overlay dismisses immediately for good UX.
    resetTimer();
  };

  const handleLogoutNow = async () => {
    await logout();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
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
    <div className="flex flex-col h-screen bg-cbs-mist">
      <Header />

      {/* ── Backend-down banner ── */}
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

      {/* ── Day-status operational banner (API_LOGIN_CONTRACT.md §14 Rule 6) ── */}
      {/* dayStatus controls the entire UI. NOT_OPENED and EOD_RUNNING
          disable transaction buttons. DAY_CLOSED is read-only mode.
          The server enforces this too — the banner is a UX convenience. */}
      <DayStatusBanner />

      {/* ── Password expiry warning (API_LOGIN_CONTRACT.md §14 Rule 10) ── */}
      {/* Per RBI IT Governance: if within 7 days of expiry, show
          non-blocking banner so the operator contacts their admin. */}
      <PasswordExpiryBanner />

      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main id="cbs-main" className="flex-1 overflow-y-auto" tabIndex={-1}>
          <div className="p-3 sm:p-4 lg:p-6">{children}</div>
        </main>
      </div>

      {/* Toast notifications — positioned top-right below header */}
      <CbsToastContainer />

      {/* Session timeout warning overlay */}
      {isWarningActive && secondsRemaining !== null && (
        <SessionTimeoutWarning
          secondsRemaining={secondsRemaining}
          onStayLoggedIn={handleStayLoggedIn}
          onLogout={handleLogoutNow}
        />
      )}
    </div>
  );
}
