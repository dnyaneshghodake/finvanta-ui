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
const badgeVariants = cva('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', {
  variants: {
    variant: {
      default: 'bg-gray-100 text-gray-800',
      primary: 'bg-blue-100 text-blue-800',
      success: 'bg-green-100 text-green-800',
      warning: 'bg-yellow-100 text-yellow-800',
      danger: 'bg-red-100 text-red-800',
      info: 'bg-cyan-100 text-cyan-800',
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
