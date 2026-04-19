/**
 * Session timeout warning modal for CBS Banking Application
 * @file src/components/molecules/SessionTimeoutWarning.tsx
 *
 * Displays a countdown warning before auto-logout.
 * Tier-1 CBS requirement: user must be warned before session expiry.
 */

'use client';

import React from 'react';

export interface SessionTimeoutWarningProps {
  secondsRemaining: number;
  onStayLoggedIn: () => void;
  onLogout: () => void;
}

const SessionTimeoutWarning: React.FC<SessionTimeoutWarningProps> = ({
  secondsRemaining,
  onStayLoggedIn,
  onLogout,
}) => {
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;

  return (
    <div className="fixed inset-0 bg-cbs-ink/60 z-[100] flex items-center justify-center">
      <div className="cbs-surface shadow-md p-5 max-w-sm w-full mx-4">
        <div className="text-center">
          {/* Warning Icon */}
          <div className="mx-auto flex items-center justify-center h-10 w-10 rounded-sm bg-cbs-gold-50 border border-cbs-gold-600 mb-3">
            <svg className="h-5 w-5 text-cbs-gold-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>

          <h2 className="text-lg font-semibold text-cbs-ink mb-1">
            Session Expiring
          </h2>
          <p className="text-sm text-cbs-steel-600 mb-3">
            Your session will expire due to inactivity in
          </p>

          {/* Countdown — CBS crimson, monospaced tabular */}
          <div className="text-3xl cbs-tabular font-bold text-cbs-crimson-700 mb-4">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>

          <p className="text-xs text-cbs-steel-500 mb-4">
            Any unsaved changes will be lost.
          </p>

          <div className="flex gap-2">
            <button
              className="cbs-btn cbs-btn-primary flex-1"
              onClick={onStayLoggedIn}
            >
              Stay Logged In
            </button>
            <button
              className="cbs-btn cbs-btn-secondary flex-1"
              onClick={onLogout}
            >
              Logout Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

SessionTimeoutWarning.displayName = 'SessionTimeoutWarning';

export { SessionTimeoutWarning };
