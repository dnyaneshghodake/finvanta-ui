/**
 * Button component for CBS Banking Application
 * @file src/components/atoms/Button.tsx
 */

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import clsx from 'clsx';

/**
 * Button variants using CVA
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center font-semibold transition-colors duration-120 rounded-sm focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-55 disabled:cursor-not-allowed border border-transparent',
  {
    variants: {
      variant: {
        primary: 'bg-cbs-navy-700 text-white hover:bg-cbs-navy-800 border-cbs-navy-800 focus:ring-cbs-navy-500',
        secondary: 'bg-cbs-paper text-cbs-navy-700 hover:bg-cbs-steel-50 border-cbs-steel-300 focus:ring-cbs-steel-400',
        danger: 'bg-cbs-crimson-600 text-white hover:bg-cbs-crimson-700 border-cbs-crimson-700 focus:ring-cbs-crimson-600',
        success: 'bg-cbs-olive-600 text-white hover:bg-cbs-olive-700 border-cbs-olive-700 focus:ring-cbs-olive-600',
        ghost: 'bg-transparent text-cbs-steel-700 hover:bg-cbs-mist focus:ring-cbs-steel-400',
      },
      size: {
        sm: 'h-[28px] px-2.5 text-xs',
        md: 'h-[34px] px-3.5 text-sm',
        lg: 'h-[40px] px-5 text-sm',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

/**
 * Button component props
 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Button component
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      isLoading = false,
      fullWidth = false,
      icon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={isLoading || disabled}
        className={clsx(
          buttonVariants({ variant, size }),
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Processing...
          </>
        ) : (
          <>
            {icon && <span className="mr-2">{icon}</span>}
            {children}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
