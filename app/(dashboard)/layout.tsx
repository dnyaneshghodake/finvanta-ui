'use client';

import { useEffect, useState } from 'react';
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
      {/* Persistent, non-dismissible alert when Spring is unreachable.
          Tier-1 CBS requirement: operators must always know whether the
          core banking engine is available before attempting any posting.
          This prevents confusion between "my session expired" and
          "the server is in maintenance". */}
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
