/**
 * CBS Skeleton — shimmer loading placeholders.
 * @file src/components/cbs/Skeleton.tsx
 *
 * Tier-1 CBS convention: loading states show grey placeholder
 * rectangles matching the target layout shape to prevent layout
 * shift. Never show a full-screen spinner for partial data loads.
 */
'use client';

export interface CbsSkeletonProps {
  variant?: 'text' | 'heading' | 'cell' | 'card';
  count?: number;
  className?: string;
}

const VARIANT_CLASS: Record<string, string> = {
  text: 'cbs-skeleton cbs-skeleton-text',
  heading: 'cbs-skeleton cbs-skeleton-heading',
  cell: 'cbs-skeleton cbs-skeleton-cell',
  card: 'cbs-skeleton cbs-skeleton-card',
};

export function CbsSkeleton({ variant = 'text', count = 1, className = '' }: CbsSkeletonProps) {
  const base = VARIANT_CLASS[variant] || VARIANT_CLASS.text;
  return (
    <div className={className} role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={base}
          style={variant === 'text' && i === count - 1 ? { width: '75%' } : undefined}
        />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Pre-built skeleton for a CBS data table (header + N rows). */
export function CbsTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="cbs-surface">
      <div className="cbs-surface-header">
        <CbsSkeleton variant="heading" />
      </div>
      <div className="p-3 space-y-2">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex gap-3">
            <div className="cbs-skeleton cbs-skeleton-cell flex-[2]" />
            <div className="cbs-skeleton cbs-skeleton-cell flex-[3]" />
            <div className="cbs-skeleton cbs-skeleton-cell flex-[1]" />
            <div className="cbs-skeleton cbs-skeleton-cell flex-[1]" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Pre-built skeleton for a CBS form (label + input pairs). */
export function CbsFormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="cbs-surface">
      <div className="cbs-surface-header">
        <CbsSkeleton variant="heading" />
      </div>
      <div className="cbs-surface-body grid md:grid-cols-2 gap-4">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="space-y-1">
            <div className="cbs-skeleton" style={{ width: '40%', height: 10 }} />
            <div className="cbs-skeleton cbs-skeleton-cell" />
          </div>
        ))}
      </div>
    </div>
  );
}
