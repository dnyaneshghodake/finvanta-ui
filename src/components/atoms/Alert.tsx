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

    const tone = {
      success: { bg: 'bg-cbs-olive-50 border-cbs-olive-600', title: 'text-cbs-olive-700', msg: 'text-cbs-olive-700' },
      error:   { bg: 'bg-cbs-crimson-50 border-cbs-crimson-600', title: 'text-cbs-crimson-700', msg: 'text-cbs-crimson-700' },
      warning: { bg: 'bg-cbs-gold-50 border-cbs-gold-600', title: 'text-cbs-gold-700', msg: 'text-cbs-gold-700' },
      info:    { bg: 'bg-cbs-navy-50 border-cbs-navy-600', title: 'text-cbs-navy-700', msg: 'text-cbs-navy-700' },
    }[type];

    return (
      <div
        ref={ref}
        className={clsx(
          'p-3 border rounded-sm flex items-start justify-between text-sm',
          tone.bg,
          className
        )}
        {...props}
      >
        <div>
          <p className={clsx('font-semibold', tone.title)}>{title}</p>
          {message && (
            <p className={clsx('text-sm mt-0.5', tone.msg)}>{message}</p>
          )}
        </div>
        {dismissible && (
          <button
            onClick={handleDismiss}
            className="text-cbs-steel-400 hover:text-cbs-steel-700 ml-3 flex-shrink-0"
          >
            <span className="text-lg leading-none">&times;</span>
          </button>
        )}
      </div>
    );
  }
);

Alert.displayName = 'Alert';

export { Alert };
