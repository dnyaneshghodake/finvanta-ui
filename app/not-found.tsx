/**
 * CBS 404 — Page Not Found.
 * @file app/not-found.tsx
 *
 * Per RBI IT Governance 2023 §8: error pages must not leak system
 * internals (stack traces, file paths, framework versions). The
 * page shows a branded CBS message with navigation back to the
 * dashboard and a correlation-style reference for IT support.
 *
 * This is a Server Component — no client-side state needed.
 */
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cbs-mist p-6">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Brand mark */}
        <div className="flex justify-center">
          <div className="h-10 w-10 bg-cbs-navy-800 text-white flex items-center justify-center text-sm font-bold rounded-sm">
            FV
          </div>
        </div>

        {/* Error display */}
        <div className="space-y-2">
          <div className="text-5xl font-bold cbs-tabular text-cbs-navy-700">404</div>
          <h1 className="text-lg font-semibold text-cbs-ink">
            Page Not Found
          </h1>
          <p className="text-sm text-cbs-steel-600">
            The screen you requested does not exist or has been moved.
            If you reached this page from a bookmark, the URL may have
            changed.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="cbs-btn cbs-btn-primary"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/login"
            className="cbs-btn cbs-btn-secondary"
          >
            Sign In
          </Link>
        </div>

        {/* IT support hint */}
        <p className="text-[10px] text-cbs-steel-400 cbs-tabular">
          If this issue persists, contact IT support with the URL you
          were trying to access.
        </p>
      </div>
    </div>
  );
}
