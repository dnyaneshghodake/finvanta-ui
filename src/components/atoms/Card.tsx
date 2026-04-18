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
          'rounded-lg p-4 transition-all duration-200',
          variant === 'default' && 'bg-white border border-gray-200',
          variant === 'elevated' && 'bg-white shadow-lg',
          variant === 'outlined' && 'bg-transparent border-2 border-gray-300',
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
