/**
 * Global error boundary for CBS Banking Application
 * @file src/components/atoms/ErrorBoundary.tsx
 *
 * RBI compliance: no internal stack traces or technical error details
 * are exposed to users. Errors are logged server-side via the logger.
 */

import React, { Component, ErrorInfo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { logger } from '@/utils/logger';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional fallback UI. Defaults to a safe, generic error screen. */
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorId: string | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorId: null };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    const errorId = `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    return { hasError: true, errorId };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log full error details internally — never expose to user
    logger.error('Unhandled UI error', {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, errorId: null });
  };

  handleGoHome = (): void => {
    if (typeof window !== 'undefined') {
      window.location.href = '/dashboard';
    }
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-cbs-mist p-4">
          <div className="cbs-surface max-w-sm w-full p-6 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-sm bg-cbs-crimson-50 border border-cbs-crimson-600 mb-4">
              <AlertTriangle size={24} strokeWidth={1.75} className="text-cbs-crimson-700" />
            </div>

            <h1 className="text-lg font-semibold text-cbs-ink mb-1">
              Something went wrong
            </h1>
            <p className="text-sm text-cbs-steel-600 mb-2">
              An unexpected error occurred. Please try again or contact support.
            </p>
            {this.state.errorId && (
              <p className="text-xs text-cbs-steel-500 mb-4 cbs-tabular">
                Ref: {this.state.errorId}
              </p>
            )}

            <div className="flex gap-2 justify-center">
              <button
                onClick={this.handleRetry}
                className="cbs-btn cbs-btn-primary"
              >
                Try Again
              </button>
              <button
                onClick={this.handleGoHome}
                className="cbs-btn cbs-btn-secondary"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export { ErrorBoundary };
