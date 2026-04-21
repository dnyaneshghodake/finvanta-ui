/**
 * Lazy module loader for CBS code splitting.
 * @file src/components/cbs/LazyModule.tsx
 *
 * §14 Performance: heavy dashboard modules (loans, admin, reports)
 * should be code-split so they are not included in the initial JS
 * bundle. This utility wraps `next/dynamic` with a CBS-standard
 * loading skeleton and error boundary.
 *
 * Why not use `next/dynamic` directly in pages?
 *   - Consistent loading UX across all modules
 *   - Automatic error boundary wrapping
 *   - CBS skeleton (not spinner) during load
 *   - SSR disabled by default for client-heavy modules
 *   - Typed factory function for IDE autocompletion
 *
 * Usage:
 *   // In a page file:
 *   const LoanInquiry = lazyModule(
 *     () => import('@/modules/loans/LoanInquiry'),
 *     { moduleRef: 'LOANS-INQ' }
 *   );
 *
 *   export default function LoansPage() {
 *     return <LoanInquiry />;
 *   }
 */

'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Spinner } from '@/components/atoms/Spinner';
import { PageErrorBoundary } from '@/components/cbs/CbsErrorBoundary';

interface LazyModuleOptions {
  /** Module reference for error boundary (e.g. "LOANS-INQ"). */
  moduleRef?: string;
  /** Loading message. Default: "Loading module...". */
  loadingMessage?: string;
  /** Whether to enable SSR. Default: false for client modules. */
  ssr?: boolean;
}

/**
 * Create a lazily-loaded module component with CBS loading UX.
 *
 * @param factory  Dynamic import factory (e.g. `() => import('./MyModule')`)
 * @param options  CBS loading and error options
 * @returns A Next.js dynamic component with loading skeleton and error boundary
 */
export function lazyModule<P extends object>(
  factory: () => Promise<{ default: React.ComponentType<P> }>,
  options: LazyModuleOptions = {},
): React.ComponentType<P> {
  const {
    moduleRef = 'MODULE',
    loadingMessage = 'Loading module...',
    ssr = false,
  } = options;

  const LazyComponent = dynamic(factory, {
    ssr,
    loading: () => (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <Spinner size="md" />
        <p className="text-xs text-cbs-steel-500">{loadingMessage}</p>
      </div>
    ),
  });

  // Wrap in error boundary so a crash in the lazy module doesn't
  // take down the entire dashboard shell.
  const WrappedComponent: React.FC<P> = (props) => (
    <PageErrorBoundary moduleRef={moduleRef}>
      <LazyComponent {...props} />
    </PageErrorBoundary>
  );

  WrappedComponent.displayName = `LazyModule(${moduleRef})`;

  return WrappedComponent;
}
