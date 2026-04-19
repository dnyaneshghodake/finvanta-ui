/**
 * Card component for CBS Banking Application
 * @file src/components/atoms/Card.tsx
 */

import React from 'react';
import clsx from 'clsx';

/**
 * Card component props
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined';
  children: React.ReactNode;
}

/**
 * Card component
 */
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          'rounded-sm p-3 transition-colors duration-100',
          variant === 'default' && 'bg-cbs-paper border border-cbs-steel-200',
          variant === 'elevated' && 'bg-cbs-paper shadow-sm border border-cbs-steel-200',
          variant === 'outlined' && 'bg-transparent border-2 border-cbs-steel-300',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export { Card };
