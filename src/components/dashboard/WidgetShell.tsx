/**
 * WidgetShell — universal skeleton / error / data wrapper for dashboard widgets.
 * @file src/components/dashboard/WidgetShell.tsx
 *
 * Tier-1 CBS pattern: every widget renders in exactly one of three states:
 *   1. Skeleton (initial load — same dimensions as real content, no CLS)
 *   2. Error (with IT reference code + Retry action)
 *   3. Data (real content)
 *
 * Never shows a blank white area. Never shows "Something went wrong".
 */
'use client';

import type { ReactNode } from 'react';
import type { WidgetStatus } from '@/hooks/useDashboardWidget';
import { RefreshCw } from 'lucide-react';

/* ── Skeleton Primitives (fixed dimensions = zero CLS) ────────── */

/** KPI metric card skeleton — h-[80px] matches real KpiCard. */
export function KpiSkeleton() {
  return (
    <div className="cbs-surface p-3 h-[80px]" role="status" aria-label="Loading">
      <div className="cbs-skeleton" style={{ width: '55%', height: 10 }} />
      <div className="cbs-skeleton mt-3" style={{ width: '40%', height: 22 }} />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Action card skeleton — h-[52px] matches real ActionCard. */
export function ActionSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 border border-cbs-steel-200 rounded-sm h-[52px]" role="status" aria-label="Loading">
      <div className="cbs-skeleton rounded-sm" style={{ width: 20, height: 20 }} />
      <div className="cbs-skeleton flex-1" style={{ height: 12 }} />
      <div className="cbs-skeleton" style={{ width: 28, height: 22 }} />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Announcement list skeleton — h-[120px]. */
export function AnnouncementSkeleton() {
  return (
    <div className="space-y-2 h-[120px]" role="status" aria-label="Loading">
      {[0, 1].map((i) => (
        <div key={i} className="flex items-start gap-2 px-3 py-2 border border-cbs-steel-100 rounded-sm">
          <div className="cbs-skeleton rounded-sm shrink-0" style={{ width: 14, height: 14 }} />
          <div className="flex-1 space-y-1">
            <div className="cbs-skeleton" style={{ width: '60%', height: 12 }} />
            <div className="cbs-skeleton" style={{ width: '90%', height: 10 }} />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Quick operations skeleton — h-[72px]. */
export function QuickOpsSkeleton() {
  return (
    <div className="cbs-surface" role="status" aria-label="Loading">
      <div className="cbs-surface-header">
        <div className="cbs-skeleton" style={{ width: '30%', height: 14 }} />
      </div>
      <div className="cbs-surface-body grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="cbs-skeleton rounded-sm" style={{ height: 28 }} />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/* ── Widget Error State ───────────────────────────────────────── */

export interface WidgetErrorProps {
  message: string;
  errorRef: string | null;
  onRetry: () => void;
}

/**
 * CBS-grade widget error — never "Something went wrong".
 * Shows: descriptive message, IT reference code, Retry button.
 */
export function WidgetError({ message, errorRef, onRetry }: WidgetErrorProps) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 border border-cbs-crimson-200 bg-cbs-crimson-50 rounded-sm text-xs">
      <div className="min-w-0">
        <div className="text-cbs-crimson-700 font-semibold truncate">{message}</div>
        {errorRef && (
          <div className="text-cbs-crimson-600 cbs-tabular mt-0.5">
            Ref: {errorRef} · Contact IT
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 flex items-center gap-1 text-cbs-crimson-700 hover:text-cbs-crimson-800 font-semibold"
        aria-label="Retry loading"
      >
        <RefreshCw size={12} strokeWidth={2} />
        Retry
      </button>
    </div>
  );
}

/* ── Generic Widget Shell ─────────────────────────────────────── */

export interface WidgetShellProps {
  status: WidgetStatus;
  error: string | null;
  errorRef: string | null;
  isInitialLoad: boolean;
  skeleton: ReactNode;
  onRetry: () => void;
  children: ReactNode;
}

/**
 * Wraps any dashboard widget with the 3-state pattern:
 * skeleton → error → data. On background refresh (isInitialLoad=false),
 * keeps showing stale data instead of flashing a skeleton.
 */
export function WidgetShell({
  status,
  error,
  errorRef,
  isInitialLoad,
  skeleton,
  onRetry,
  children,
}: WidgetShellProps) {
  // Initial load: show skeleton
  if (status === 'loading' && isInitialLoad) return <>{skeleton}</>;
  // Error with no prior data: show error state
  if (status === 'error' && isInitialLoad) {
    return (
      <WidgetError
        message={error || 'Unable to load widget'}
        errorRef={errorRef}
        onRetry={onRetry}
      />
    );
  }
  // Success, or background refresh with stale data: show children
  return <>{children}</>;
}
