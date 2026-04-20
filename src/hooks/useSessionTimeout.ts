/**
 * Session timeout hook for CBS Banking Application
 * @file src/hooks/useSessionTimeout.ts
 *
 * Implements inactivity-based auto-logout with countdown warning.
 * Tier-1 CBS requirement: sessions must auto-expire after configurable
 * inactivity period. A warning modal appears before logout.
 *
 * Monitors: mousemove, mousedown, keypress, scroll, touchstart
 *
 * Internals: `isWarningActive` is intentionally tracked via a ref for
 * the activity handler gate so that entering the warning phase does
 * NOT re-run the wiring effect and cancel the countdown. The public
 * `isWarningActive` state is still exposed for UI rendering but is
 * kept in lock-step with the ref.
 */
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { logger } from '@/utils/logger';

/**
 * Default inactivity timeout: 30 minutes (in ms).
 * Must match CBS_SESSION_IDLE_SECONDS in .env.development (1800s).
 * The backend dev env also uses 30 minutes.
 */
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/** Warning shown 2 minutes before logout */
const WARNING_BEFORE_MS = 2 * 60 * 1000;

/** Events that count as user activity */
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keypress',
  'scroll',
  'touchstart',
];

interface UseSessionTimeoutReturn {
  /** Seconds remaining before auto-logout (only set during warning phase) */
  secondsRemaining: number | null;
  /** Whether the warning countdown is active */
  isWarningActive: boolean;
  /** Call to reset the timer (e.g. user clicks "Stay logged in") */
  resetTimer: () => void;
}

export const useSessionTimeout = (
  timeoutMs: number = SESSION_TIMEOUT_MS,
  warningBeforeMs: number = WARNING_BEFORE_MS
): UseSessionTimeoutReturn => {
  const { isAuthenticated, logout } = useAuthStore();
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [isWarningActive, setIsWarningActive] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logoutTimeRef = useRef<number>(0);
  const isWarningActiveRef = useRef<boolean>(false);

  const setWarningActive = useCallback((active: boolean) => {
    isWarningActiveRef.current = active;
    setIsWarningActive(active);
  }, []);

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    timeoutRef.current = null;
    warningRef.current = null;
    countdownRef.current = null;
  }, []);

  const handleLogout = useCallback(async () => {
    clearAllTimers();
    setWarningActive(false);
    setSecondsRemaining(null);
    logger.warn('Session expired due to inactivity');

    try {
      await logout();
    } finally {
      if (typeof window !== 'undefined') {
        window.location.href = '/login?reason=session_expired';
      }
    }
  }, [clearAllTimers, logout, setWarningActive]);

  const startCountdown = useCallback(() => {
    setWarningActive(true);
    logoutTimeRef.current = Date.now() + warningBeforeMs;

    countdownRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((logoutTimeRef.current - Date.now()) / 1000));
      setSecondsRemaining(remaining);

      if (remaining <= 0) {
        handleLogout();
      }
    }, 1000);
  }, [warningBeforeMs, handleLogout, setWarningActive]);

  const resetTimer = useCallback(() => {
    if (!isAuthenticated) return;

    clearAllTimers();
    setWarningActive(false);
    setSecondsRemaining(null);

    // Set warning timer (fires warningBeforeMs before logout)
    warningRef.current = setTimeout(() => {
      startCountdown();
    }, timeoutMs - warningBeforeMs);

    // Set hard logout timer
    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, timeoutMs);
  }, [
    isAuthenticated,
    timeoutMs,
    warningBeforeMs,
    clearAllTimers,
    startCountdown,
    handleLogout,
    setWarningActive,
  ]);

  useEffect(() => {
    if (!isAuthenticated) {
      clearAllTimers();
      return;
    }

    // Start timer on mount
    resetTimer();

    // Reset timer on user activity — but not during warning phase.
    // Gate via ref so entering the warning phase does NOT re-run this
    // effect (which would clear the countdown and restart the cycle).
    const handleActivity = () => {
      if (!isWarningActiveRef.current) {
        resetTimer();
      }
    };

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      clearAllTimers();
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [isAuthenticated, resetTimer, clearAllTimers]);

  return { secondsRemaining, isWarningActive, resetTimer };
};
