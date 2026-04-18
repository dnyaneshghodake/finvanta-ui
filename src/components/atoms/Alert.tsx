/**
 * Alert component for CBS Banking Application
 * @file src/components/atoms/Alert.tsx
 */

import React from 'react';
import clsx from 'clsx';

/**
 * Alert component props
 */
export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}

/**
 * Alert component
 */
const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ type, title, message, dismissible = true, onDismiss, className, ...props }, ref) => {
    const [isVisible, setIsVisible] = React.useState(true);

    const handleDismiss = () => {
      setIsVisible(false);
      onDismiss?.();
    };

    if (!isVisible) return null;

    const bgColor = {
      success: 'bg-green-50 border-green-200',
      error: 'bg-red-50 border-red-200',
      warning: 'bg-yellow-50 border-yellow-200',
      info: 'bg-blue-50 border-blue-200',
    };

    const titleColor = {
      success: 'text-green-800',
      error: 'text-red-800',
      warning: 'text-yellow-800',
      info: 'text-blue-800',
    };

    const messageColor = {
      success: 'text-green-700',
      error: 'text-red-700',
      warning: 'text-yellow-700',
      info: 'text-blue-700',
    };

    return (
      <div
        ref={ref}
        className={clsx(
          'p-4 border rounded-lg flex items-start justify-between',
          bgColor[type],
          className
        )}
        {...props}
      >
        <div>
          <p className={clsx('font-medium', titleColor[type])}>{title}</p>
          {message && (
            <p className={clsx('text-sm mt-1', messageColor[type])}>{message}</p>
          )}
        </div>
        {dismissible && (
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 ml-4 flex-shrink-0"
          >
            <span className="text-xl">&times;</span>
          </button>
        )}
      </div>
    );
  }
);

Alert.displayName = 'Alert';

export { Alert };
