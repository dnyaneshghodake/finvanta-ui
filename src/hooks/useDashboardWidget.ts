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
import { apiClient } from '@/services/api/apiClient';
import { logger } from '@/utils/logger';

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
  const retriesRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async (silent = false) => {
    if (!enabled) return;
    if (!silent) setStatus('loading');
    try {
      const res = await apiClient.get<{
        success?: boolean;
        status?: string;
        data?: T;
      }>(endpoint);
      if (!mountedRef.current) return;
      const payload = res.data?.data ?? (res.data as unknown as T);
      if (payload != null) {
        setData(payload);
        setStatus('success');
        setError(null);
        setIsInitialLoad(false);
        retriesRef.current = 0;
      } else {
        throw new Error('Empty response');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : 'Failed to load';
      logger.warn(`Widget ${errorRef} fetch failed: ${msg}`);
      if (retriesRef.current < maxRetries && isInitialLoad) {
        retriesRef.current += 1;
        // Exponential backoff: 1s, 2s
        setTimeout(() => { void fetchData(silent); }, retriesRef.current * 1000);
        return;
      }
      setError(msg);
      setStatus('error');
      setIsInitialLoad(false);
    }
  }, [endpoint, errorRef, maxRetries, enabled, isInitialLoad]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    if (enabled) {
      void fetchData(false);
    } else {
      setStatus('success');
      setIsInitialLoad(false);
    }
    return () => { mountedRef.current = false; };
  }, [enabled, fetchData]);

  // Auto-refresh interval (silent — no loading flash)
  useEffect(() => {
    if (refreshInterval > 0 && enabled && status !== 'loading') {
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
