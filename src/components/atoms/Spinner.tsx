/**
 * Spinner component for CBS Banking Application
 * @file src/components/atoms/Spinner.tsx
 */

import React from 'react';
import clsx from 'clsx';

/**
 * Spinner component props
 */
export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  message?: string;
}

/**
 * Spinner component
 */
const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  fullScreen = false,
  message,
  className,
  ...props
}) => {
  const spinnerContent = (
    <div className={clsx('inline-flex flex-col items-center', className)} {...props}>
      <svg
        className={clsx(
          'animate-spin text-blue-600',
          size === 'sm' && 'h-4 w-4',
          size === 'md' && 'h-8 w-8',
          size === 'lg' && 'h-12 w-12'
        )}
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
      {message && <p className="mt-2 text-sm text-gray-600">{message}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white bg-opacity-75 z-50">
        {spinnerContent}
      </div>
    );
  }

  return spinnerContent;
};

Spinner.displayName = 'Spinner';

export { Spinner };
