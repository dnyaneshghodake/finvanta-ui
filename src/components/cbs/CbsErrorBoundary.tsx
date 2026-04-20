'use client';

/**
 * CBS Error Boundary — Tier-1 crash recovery for banking UI.
 * @file src/components/cbs/CbsErrorBoundary.tsx
 *
 * Three levels per CBS convention:
 *   1. PageErrorBoundary  — wraps entire page routes
 *   2. WidgetErrorBoundary — wraps individual dashboard widgets
 *   3. TransactionErrorBoundary — wraps financial operation forms
 *      with "Transaction may have been submitted" safety warning
 *
 * Per RBI IT Governance 2023 §8: crash recovery must never lose
 * the operator's context (branch, business date, session). The
 * boundary preserves the layout chrome and offers structured recovery.
 *
 * CBS benchmark: Finacle Connect uses module-level error isolation;
 * a crash in the Loan module does not affect the Deposit module.
 * T24 Browser wraps each enquiry/input screen independently.
 */

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────── */

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Unique module/widget identifier for IT support (e.g. "DSH-PORT"). */
  moduleRef?: string;
  /** Severity level controls the recovery UI. */
  level?: 'page' | 'widget' | 'transaction';
  /** Optional fallback component override. */
  fallback?: ReactNode;
  /** Callback when error is caught (for telemetry). */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

/* ── Core ErrorBoundary Class ──────────────────────────────────── */

class CbsErrorBoundaryInner extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorId: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorId: `ERR-${Date.now().toString(36).toUpperCase()}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console in dev; in production this would go to Sentry/ELK
    console.error(
      `[CbsErrorBoundary] ${this.props.moduleRef || 'unknown'} crashed:`,
      error,
      errorInfo.componentStack,
    );
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorId: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const { level = 'page', moduleRef } = this.props;
    const { error, errorId } = this.state;

    // Transaction-level: warn that the operation may have been submitted
    if (level === 'transaction') {
      return (
        <div className="border-2 border-cbs-crimson-600 bg-cbs-crimson-50 rounded-lg p-6 space-y-4" role="alert">
          <div className="flex items-start gap-3">
            <AlertTriangle size={24} className="text-cbs-crimson-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-bold text-cbs-crimson-700">
                Transaction Processing Error
              </h3>
              <p className="text-sm text-cbs-crimson-700 mt-1">
                An error occurred during processing. <strong>Your transaction may have been
                submitted.</strong> Please check the transaction status before retrying to
                avoid duplicate postings.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-cbs-crimson-200">
            <a
              href="/workflow"
              className="cbs-btn cbs-btn-primary text-sm"
            >
              Check Transaction Status
            </a>
            <button
              type="button"
              onClick={this.handleRetry}
              className="cbs-btn cbs-btn-secondary text-sm flex items-center gap-1.5"
            >
              <RefreshCw size={14} />
              Retry Form
            </button>
          </div>
          {errorId && (
            <p className="text-[10px] text-cbs-crimson-600 cbs-tabular">
              Ref: {errorId}{moduleRef ? ` · ${moduleRef}` : ''} · Contact IT if this persists
            </p>
          )}
        </div>
      );
    }

    // Widget-level: compact error with retry
    if (level === 'widget') {
      return (
        <div className="flex items-center justify-between gap-3 p-3 border border-cbs-crimson-200 bg-cbs-crimson-50 rounded-sm text-xs" role="alert">
          <div className="min-w-0">
            <div className="text-cbs-crimson-700 font-semibold">Widget unavailable</div>
            {errorId && (
              <div className="text-cbs-crimson-600 cbs-tabular mt-0.5">
                Ref: {errorId}{moduleRef ? ` · ${moduleRef}` : ''}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            className="shrink-0 flex items-center gap-1 text-cbs-crimson-700 hover:text-cbs-crimson-800 font-semibold"
          >
            <RefreshCw size={12} strokeWidth={2} />
            Retry
          </button>
        </div>
      );
    }

    // Page-level: full error screen with navigation
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-6" role="alert">
        <div className="w-16 h-16 bg-cbs-crimson-50 rounded-full flex items-center justify-center">
          <AlertTriangle size={32} className="text-cbs-crimson-600" />
        </div>
        <div className="text-center space-y-2 max-w-md">
          <h2 className="text-lg font-semibold text-cbs-ink">Module Unavailable</h2>
          <p className="text-sm text-cbs-steel-600">
            This screen encountered an unexpected error. Your session and
            data are safe — you can retry or return to the dashboard.
          </p>
          {error?.message && process.env.NODE_ENV !== 'production' && (
            <pre className="text-xs text-cbs-crimson-700 bg-cbs-crimson-50 p-3 rounded-sm text-left overflow-x-auto mt-3">
              {error.message}
            </pre>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={this.handleRetry}
            className="cbs-btn cbs-btn-primary flex items-center gap-1.5"
          >
            <RefreshCw size={14} />
            Retry
          </button>
          <a href="/dashboard" className="cbs-btn cbs-btn-secondary flex items-center gap-1.5">
            <Home size={14} />
            Dashboard
          </a>
        </div>
        {errorId && (
          <p className="text-[10px] text-cbs-steel-500 cbs-tabular">
            Error Ref: {errorId}{moduleRef ? ` · Module: ${moduleRef}` : ''} · Contact IT Support
          </p>
        )}
      </div>
    );
  }
}

/* ── Convenience Wrappers ──────────────────────────────────────── */

/** Page-level boundary — wraps entire route pages. */
export function PageErrorBoundary({
  children,
  moduleRef,
  onError,
}: {
  children: ReactNode;
  moduleRef?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}) {
  return (
    <CbsErrorBoundaryInner level="page" moduleRef={moduleRef} onError={onError}>
      {children}
    </CbsErrorBoundaryInner>
  );
}

/** Widget-level boundary — wraps individual dashboard widgets. */
export function WidgetErrorBoundary({
  children,
  moduleRef,
}: {
  children: ReactNode;
  moduleRef?: string;
}) {
  return (
    <CbsErrorBoundaryInner level="widget" moduleRef={moduleRef}>
      {children}
    </CbsErrorBoundaryInner>
  );
}

/**
 * Transaction-level boundary — wraps financial operation forms.
 * Shows "transaction may have been submitted" safety warning.
 */
export function TransactionErrorBoundary({
  children,
  moduleRef,
  onError,
}: {
  children: ReactNode;
  moduleRef?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}) {
  return (
    <CbsErrorBoundaryInner level="transaction" moduleRef={moduleRef} onError={onError}>
      {children}
    </CbsErrorBoundaryInner>
  );
}

export { CbsErrorBoundaryInner as CbsErrorBoundary };
