'use client';

/**
 * CBS Global Error Boundary — unhandled runtime errors.
 * @file app/error.tsx
 *
 * Next.js renders this page when an unhandled error occurs outside
 * of a React Error Boundary. This is the last-resort catch-all.
 *
 * Per RBI IT Governance 2023 §8:
 *   - No stack traces or file paths exposed to the operator
 *   - Error reference ID for IT support correlation
 *   - Clear recovery action (retry or navigate to dashboard)
 *   - Error details shown only in development mode
 *
 * This MUST be a Client Component ('use client') because Next.js
 * passes the error and reset function as props.
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const errorRef = `ERR-${Date.now().toString(36).toUpperCase()}`;

  useEffect(() => {
    // Log to console in dev; in production this would go to
    // a telemetry service (Sentry, ELK, etc.)
    console.error('[GLOBAL_ERROR]', errorRef, error);
  }, [error, errorRef]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-cbs-mist p-6">
      <div className="max-w-lg w-full text-center space-y-6">
        {/* Error icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-cbs-crimson-50 rounded-full flex items-center justify-center">
            <AlertTriangle size={32} className="text-cbs-crimson-600" />
          </div>
        </div>

        {/* Error message */}
        <div className="space-y-2">
          <h1 className="text-lg font-semibold text-cbs-ink">
            Something Went Wrong
          </h1>
          <p className="text-sm text-cbs-steel-600">
            An unexpected error occurred. Your session and data are
            safe — you can retry the operation or return to the
            dashboard.
          </p>
        </div>

        {/* Dev-only error detail */}
        {process.env.NODE_ENV !== 'production' && error?.message && (
          <pre className="text-xs text-cbs-crimson-700 bg-cbs-crimson-50 p-3 rounded-sm text-left overflow-x-auto border border-cbs-crimson-200">
            {error.message}
          </pre>
        )}

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="cbs-btn cbs-btn-primary flex items-center gap-1.5"
          >
            <RefreshCw size={14} />
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="cbs-btn cbs-btn-secondary flex items-center gap-1.5"
          >
            <Home size={14} />
            Dashboard
          </Link>
        </div>

        {/* Error reference for IT support */}
        <div className="space-y-1">
          <p className="text-[10px] text-cbs-steel-500 cbs-tabular">
            Error Ref: {errorRef}
            {error?.digest ? ` · Digest: ${error.digest}` : ''}
          </p>
          <p className="text-[10px] text-cbs-steel-400">
            If this issue persists, contact IT support with the
            reference above.
          </p>
        </div>
      </div>
    </div>
  );
}
