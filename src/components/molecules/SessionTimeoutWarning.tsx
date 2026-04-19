/**
 * Session timeout warning modal for CBS Banking Application
 * @file src/components/molecules/SessionTimeoutWarning.tsx
 *
 * Displays a countdown warning before auto-logout.
 * Tier-1 CBS requirement: user must be warned before session expiry.
 */

'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

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
            <AlertTriangle size={20} strokeWidth={1.75} className="text-cbs-gold-700" />
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
