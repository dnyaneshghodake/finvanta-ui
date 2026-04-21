/**
 * Tooltip component for CBS Banking Application.
 * @file src/components/atoms/Tooltip.tsx
 *
 * Lightweight CSS-only tooltip using the group-hover pattern.
 * No JavaScript positioning library — CBS screens run on branch
 * terminals where bundle size matters and tooltips are simple
 * contextual hints, not rich popovers.
 *
 * WCAG: role="tooltip", aria-describedby linking, visible on
 * focus (not just hover) for keyboard accessibility.
 *
 * Usage:
 *   <Tooltip content="Account number in CBS format">
 *     <InfoIcon />
 *   </Tooltip>
 */

'use client';

import React, { useId } from 'react';
import clsx from 'clsx';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  /** Tooltip text content. */
  content: string;
  /** Position relative to the trigger. Default: top. */
  position?: TooltipPosition;
  /** Additional CSS class for the wrapper. */
  className?: string;
  /** The trigger element. */
  children: React.ReactNode;
}

const POSITION_CLASSES: Record<TooltipPosition, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
  left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
  right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
};

const Tooltip: React.FC<TooltipProps> = ({
  content,
  position = 'top',
  className,
  children,
}) => {
  const tooltipId = useId();

  return (
    <span
      className={clsx('relative inline-flex group', className)}
      aria-describedby={tooltipId}
    >
      {children}
      <span
        id={tooltipId}
        role="tooltip"
        className={clsx(
          'absolute hidden group-hover:block group-focus-within:block',
          'bg-cbs-ink text-white text-xs rounded-sm px-2 py-1',
          'whitespace-nowrap pointer-events-none',
          'z-50',
          POSITION_CLASSES[position],
        )}
      >
        {content}
      </span>
    </span>
  );
};

Tooltip.displayName = 'Tooltip';

export { Tooltip };
