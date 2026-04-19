/**
 * Client-side providers wrapper for CBS Banking Application
 * @file src/components/providers/ClientProviders.tsx
 *
 * Wraps the entire app with client-side providers:
 * - ErrorBoundary (global error catching, RBI-safe)
 *
 * This is a 'use client' boundary so it can be composed
 * inside the server-rendered root layout.
 */

'use client';

import React from 'react';
import { ErrorBoundary } from '@/components/atoms/ErrorBoundary';

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
}
