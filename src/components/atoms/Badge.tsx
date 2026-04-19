/**
 * Badge component for CBS Banking Application
 * @file src/components/atoms/Badge.tsx
 */

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import clsx from 'clsx';

/**
 * Badge variants
 */
const badgeVariants = cva('inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-semibold border', {
  variants: {
    variant: {
      default: 'bg-cbs-mist text-cbs-steel-700 border-cbs-steel-300',
      primary: 'bg-cbs-navy-50 text-cbs-navy-700 border-cbs-navy-200',
      success: 'bg-cbs-olive-50 text-cbs-olive-700 border-cbs-olive-600',
      warning: 'bg-cbs-gold-50 text-cbs-gold-700 border-cbs-gold-600',
      danger: 'bg-cbs-crimson-50 text-cbs-crimson-700 border-cbs-crimson-600',
      info: 'bg-cbs-violet-50 text-cbs-violet-700 border-cbs-violet-600',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

/**
 * Badge component props
 */
export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
  children: React.ReactNode;
}

/**
 * Badge component
 */
const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, dot = false, children, ...props }, ref) => {
    return (
      <span ref={ref} className={clsx(badgeVariants({ variant }), className)} {...props}>
        {dot && (
          <span className="inline-block mr-1 h-1.5 w-1.5 rounded-full bg-current" />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
