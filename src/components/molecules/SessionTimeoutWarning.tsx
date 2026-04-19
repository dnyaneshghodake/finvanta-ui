/**
 * Session timeout warning modal for CBS Banking Application
 * @file src/components/molecules/SessionTimeoutWarning.tsx
 *
 * Displays a countdown warning before auto-logout.
 * Tier-1 CBS requirement: user must be warned before session expiry.
 */

'use client';

import React from 'react';
import { Button } from '@/components/atoms/Button';

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
    <div className="fixed inset-0 bg-black bg-opacity-60 z-[100] flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4">
        <div className="text-center">
          {/* Warning Icon */}
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
            <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Session Expiring
          </h2>
          <p className="text-gray-600 mb-4">
            Your session will expire due to inactivity in
          </p>

          {/* Countdown */}
          <div className="text-4xl font-mono font-bold text-red-600 mb-6">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>

          <p className="text-sm text-gray-500 mb-6">
            Any unsaved changes will be lost. Click below to continue your session.
          </p>

          <div className="flex gap-3">
            <Button
              variant="primary"
              fullWidth
              onClick={onStayLoggedIn}
            >
              Stay Logged In
            </Button>
            <Button
              variant="ghost"
              fullWidth
              onClick={onLogout}
            >
              Logout Now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

SessionTimeoutWarning.displayName = 'SessionTimeoutWarning';

export { SessionTimeoutWarning };
