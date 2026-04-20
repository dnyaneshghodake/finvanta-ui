/**
 * useDashboardWidget — independent per-widget fetch hook.
 * @file src/hooks/useDashboardWidget.ts
 *
 * Tier-1 CBS Progressive Secure Hydration pattern:
 * - Each widget fetches independently
 * - Each widget retries independently (max 2)
 * - Each widget has its own stale-time / refresh interval
 * - Failed widgets do NOT break the dashboard
 * - Silent background refresh (no loading flash on refetch)
 *
 * This replaces the monolithic `GET /dashboard/summary` pattern.
 */
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { logger } from '@/utils/logger';

/**
 * Dedicated axios instance for dashboard widgets.
 *
 * This does NOT use the shared `apiClient` because apiClient's 401
 * interceptor clears the auth store and redirects to /login. Dashboard
 * widget endpoints may not exist on the backend yet (returning 401/404),
 * and those failures must NOT trigger a logout — they should show the
 * widget error state instead. A failed widget must never break the
 * entire dashboard session.
 */
const widgetClient = axios.create({
  baseURL: '/api/cbs',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

export type WidgetStatus = 'loading' | 'success' | 'error';

export interface WidgetState<T> {
  data: T | null;
  status: WidgetStatus;
  error: string | null;
  /** Error code for IT support reference (e.g. "DSH-TXN-01"). */
  errorRef: string | null;
  /** True only on initial load; false on background refresh. */
  isInitialLoad: boolean;
  refetch: () => void;
}

export interface UseDashboardWidgetOptions {
  /** API path relative to BFF base (e.g. "/dashboard/txn-summary"). */
  endpoint: string;
  /** Widget error reference code for IT support. */
  errorRef: string;
  /** Stale time in ms before background refresh. 0 = no auto-refresh. */
  refreshInterval?: number;
  /** Max retry attempts on failure. Default 2. */
  maxRetries?: number;
  /** Whether the widget should fetch at all. Use for role gating. */
  enabled?: boolean;
}

/**
 * Independent widget data fetcher.
 *
 * Each widget on the dashboard uses this hook with its own endpoint,
 * refresh interval, and error reference. Widgets load in parallel,
 * fail independently, and refresh silently in the background.
 */
export function useDashboardWidget<T>(
  opts: UseDashboardWidgetOptions,
): WidgetState<T> {
  const {
    endpoint,
    errorRef,
    refreshInterval = 0,
    maxRetries = 2,
    enabled = true,
  } = opts;

  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<WidgetStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const isInitialLoadRef = useRef(true);
  const retriesRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  // `fetchDataRef` decouples the internal retry self-call from the
  // `fetchData` identifier so `fetchData` can reference itself without
  // tripping React Compiler's `react-hooks/immutability` rule (which
  // forbids naming a function inside its own definition).
  const fetchDataRef = useRef<((silent?: boolean) => Promise<void>) | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!enabled) return;
    if (!silent) setStatus('loading');
    try {
      const res = await widgetClient.get<{
        success?: boolean;
        status?: string;
        data?: T;
      }>(endpoint, {
        // Accept all HTTP statuses — we handle errors ourselves.
        // This prevents axios from throwing on 401/404/500 which
        // would otherwise be caught by apiClient's 401 interceptor
        // and trigger a session clear + logout.
        validateStatus: () => true,
      });
      if (!mountedRef.current) return;

      // ── Session expiry detection ──────────────────────────────
      // A 401 from the BFF proxy means the session has expired or
      // the JWT was rejected by Spring. Unlike 404/500 (widget-
      // specific failures), a 401 affects ALL widgets and requires
      // a full re-authentication. Redirect to login immediately.
      // Per CBS benchmark: Tier-1 CBS portal treats 401 on ANY call
      // as a session-termination signal regardless of the endpoint.
      if (res.status === 401) {
        const errorCode = (res.data as Record<string, unknown> | undefined)?.errorCode;
        // Per API_REFERENCE.md §17: all session-termination 401 codes
        // require redirect to login. 'UNAUTHORIZED' means the JWT was
        // rejected by Spring (expired/invalid). Without this, widgets
        // show "UNAUTHORIZED" error states instead of redirecting.
        if (
          errorCode === 'NO_SESSION' ||
          errorCode === 'REFRESH_TOKEN_REUSED' ||
          errorCode === 'UNAUTHORIZED' ||
          errorCode === 'INVALID_REFRESH_TOKEN' ||
          errorCode === 'ACCOUNT_INVALID' ||
          !errorCode
        ) {
          const reason = errorCode === 'REFRESH_TOKEN_REUSED'
            ? 'session_compromised'
            : errorCode === 'ACCOUNT_INVALID'
              ? 'account_invalid'
              : 'session_expired';
          window.location.href = `/login?reason=${reason}`;
          return;
        }
      }

      // Non-2xx means the widget endpoint failed (may not exist yet).
      // Show the widget error state — do NOT trigger a logout.
      if (res.status < 200 || res.status >= 300) {
        const envelope = res.data as
          | { message?: string; errorCode?: string }
          | undefined;
        const errMsg =
          envelope?.message || envelope?.errorCode || `HTTP ${res.status}`;
        throw new Error(String(errMsg));
      }

      const payload = res.data?.data ?? (res.data as unknown as T);
      if (payload != null) {
        setData(payload);
        setStatus('success');
        setError(null);
        setIsInitialLoad(false);
        isInitialLoadRef.current = false;
        retriesRef.current = 0;
      } else {
        throw new Error('Empty response');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : 'Failed to load';
      logger.warn(`Widget ${errorRef} fetch failed: ${msg}`);
      // Only retry on network errors (timeout, ECONNREFUSED), not on
      // HTTP error responses (401, 404, 500). When the backend returns
      // a clear error, retrying won't help — show the error state.
      const isNetworkError = !(err instanceof Error) || !err.message.startsWith('HTTP ');
      if (retriesRef.current < maxRetries && isInitialLoadRef.current && isNetworkError) {
        retriesRef.current += 1;
        setTimeout(() => { void fetchDataRef.current?.(silent); }, retriesRef.current * 1000);
        return;
      }
      setError(msg);
      setStatus('error');
      setIsInitialLoad(false);
      isInitialLoadRef.current = false;
    }
  // NOTE: isInitialLoad intentionally excluded from deps to prevent
  // double-fetch. The callback reads it via ref-like closure; the
  // initial value (true) is captured on mount and updated by setState.
  // Including it would cause fetchData to be recreated when
  // setIsInitialLoad(false) fires, triggering the useEffect again.
  }, [endpoint, errorRef, maxRetries, enabled]);

  // Keep `fetchDataRef` pointed at the latest `fetchData` for the
  // internal retry path (see declaration above).
  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  // Initial fetch. `fetchData` itself sets `status='loading'`
  // synchronously, which React Compiler flags as set-state-in-effect.
  // The alternative — computing initial state during render — is
  // impossible here because the fetch is async and bound to the
  // widget's lifecycle.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    mountedRef.current = true;
    if (enabled) {
      void fetchData(false);
    } else {
      // When the widget is role-gated off, mark the state machine as
      // settled so consumers don't see a perpetual loading skeleton.
      setStatus('success');
      setIsInitialLoad(false);
    }
    return () => { mountedRef.current = false; };
  }, [enabled, fetchData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Auto-refresh interval (silent — no loading flash).
  // Only refresh when the widget has data (status === 'success').
  // If the widget is in error state (e.g. endpoint doesn't exist yet),
  // don't spam the backend with repeated 401/404 requests every N seconds.
  // The user can manually retry via the Retry button on the error state.
  useEffect(() => {
    if (refreshInterval > 0 && enabled && status === 'success') {
      intervalRef.current = setInterval(() => {
        void fetchData(true);
      }, refreshInterval);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refreshInterval, enabled, status, fetchData]);

  const refetch = useCallback(() => {
    retriesRef.current = 0;
    void fetchData(false);
  }, [fetchData]);

  return { data, status, error, errorRef, isInitialLoad, refetch };
}
