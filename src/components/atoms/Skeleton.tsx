/**
 * Skeleton loading placeholder for CBS Banking Application.
 * @file src/components/atoms/Skeleton.tsx
 *
 * Wraps the CSS-only `.cbs-skeleton` shimmer classes with a typed
 * React component. Used for content placeholders while data loads.
 *
 * CBS convention: skeleton loading is preferred over spinners for
 * data-dense screens (account lists, transaction tables) because
 * it preserves the layout shape and reduces perceived load time.
 *
 * Usage:
 *   <Skeleton variant="text" />
 *   <Skeleton variant="heading" />
 *   <Skeleton variant="cell" count={5} />
 *   <Skeleton variant="card" />
 *   <Skeleton width="200px" height="40px" />
 */

'use client';

import React from 'react';
import clsx from 'clsx';

export type SkeletonVariant = 'text' | 'heading' | 'cell' | 'card' | 'custom';

export interface SkeletonProps {
  /** Predefined shape variant. Default: text. */
  variant?: SkeletonVariant;
  /** Number of skeleton lines to render. Default: 1. */
  count?: number;
  /** Custom width (only for variant="custom"). */
  width?: string;
  /** Custom height (only for variant="custom"). */
  height?: string;
  /** Whether to render as a circle (avatar placeholder). */
  circle?: boolean;
  /** Additional CSS class. */
  className?: string;
}

const VARIANT_CLASS: Record<SkeletonVariant, string> = {
  text: 'cbs-skeleton cbs-skeleton-text',
  heading: 'cbs-skeleton cbs-skeleton-heading',
  cell: 'cbs-skeleton cbs-skeleton-cell',
  card: 'cbs-skeleton cbs-skeleton-card',
  custom: 'cbs-skeleton',
};

const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  count = 1,
  width,
  height,
  circle = false,
  className,
}) => {
  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <>
      {items.map((i) => (
        <div
          key={i}
          className={clsx(
            VARIANT_CLASS[variant],
            circle && 'rounded-full',
            className,
          )}
          style={{
            ...(width ? { width } : {}),
            ...(height ? { height } : {}),
            ...(circle ? { width: width || '32px', height: height || '32px' } : {}),
          }}
          role="presentation"
          aria-hidden="true"
        />
      ))}
    </>
  );
};

Skeleton.displayName = 'Skeleton';

export { Skeleton };
