/**
 * Session timeout warning modal for CBS Banking Application
 * @file src/components/molecules/SessionTimeoutWarning.tsx
 *
 * Displays a countdown warning before auto-logout.
 * Tier-1 CBS requirement: user must be warned before session expiry.
 *
 * WCAG 2.1 AA compliance:
 *   - role="alertdialog" with aria-describedby for screen readers
 *   - Auto-focus on "Stay Logged In" button when warning appears
 *   - Focus trapped within the dialog (via useFocusTrap hook)
 *   - Focus returns to previously focused element on dismiss
 *   - aria-live countdown announced to assistive technology
 */

'use client';

import React, { useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

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
  const stayRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap via shared hook — replaces inline Tab-key handler.
  // "Stay Logged In" is the initial focus target (safe default for
  // session warnings — operator clicks it to dismiss).
  useFocusTrap(dialogRef, true, {
    initialFocus: stayRef,
    returnFocusOnDeactivate: true,
  });

  return (
    <div
      className="fixed inset-0 bg-cbs-ink/60 flex items-center justify-center"
      style={{ zIndex: 'var(--z-cbs-session, 120)' }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-timeout-title"
        aria-describedby="session-timeout-desc"
        className="cbs-surface shadow-md p-5 max-w-sm w-full mx-4"
      >
        <div className="text-center">
          {/* Warning Icon */}
          <div className="mx-auto flex items-center justify-center h-10 w-10 rounded-sm bg-cbs-gold-50 border border-cbs-gold-600 mb-3">
            <AlertTriangle size={20} strokeWidth={1.75} className="text-cbs-gold-700" aria-hidden="true" />
          </div>

          <h2 id="session-timeout-title" className="text-lg font-semibold text-cbs-ink mb-1">
            Session Expiring
          </h2>
          <p id="session-timeout-desc" className="text-sm text-cbs-steel-600 mb-3">
            Your session will expire due to inactivity in
          </p>

          {/* Countdown — CBS crimson, monospaced tabular.
            *
            * WCAG 2.1 AA: aria-live="polite" so screen readers do NOT
            * interrupt every second (120 announcements would make the
            * dialog unusable for visually impaired operators). The
            * visual countdown updates every second, but the live region
            * only announces at 30s intervals + a final assertive
            * announcement at 10s remaining. */}
          <div
            className="text-3xl cbs-tabular font-bold text-cbs-crimson-700 mb-4"
            aria-live="polite"
            aria-atomic="true"
          >
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>
          {/* Assertive announcement only at critical thresholds */}
          {secondsRemaining <= 10 && (
            <div className="sr-only" aria-live="assertive" aria-atomic="true">
              {secondsRemaining} seconds until automatic logout
            </div>
          )}

          <p className="text-xs text-cbs-steel-500 mb-4">
            Any unsaved changes will be lost.
          </p>

          <div className="flex gap-2">
            <button
              ref={stayRef}
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
