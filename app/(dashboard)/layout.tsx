'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header, Sidebar } from '@/components/layout';
import { useAuthStore } from '@/store/authStore';
import { Spinner } from '@/components/atoms';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { SessionTimeoutWarning } from '@/components/molecules/SessionTimeoutWarning';

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
  const { isAuthenticated, loadUserFromStorage, logout } = useAuthStore();
  const [isInitialized, setIsInitialized] = useState(false);

  // Session timeout — 15 min inactivity, 2 min warning
  const { secondsRemaining, isWarningActive, resetTimer } = useSessionTimeout();

  useEffect(() => {
    // Hydrate auth state from localStorage, then mark as ready
    loadUserFromStorage();
    setIsInitialized(true);
  }, [loadUserFromStorage]);

  useEffect(() => {
    // Only redirect after hydration is complete
    if (isInitialized && !isAuthenticated) {
      router.push('/login');
    }
  }, [isInitialized, isAuthenticated, router]);

  const handleStayLoggedIn = () => {
    resetTimer();
  };

  const handleLogoutNow = async () => {
    await logout();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  // Still hydrating — show spinner, not a redirect
  if (!isInitialized) {
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
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>

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
