/**
 * Input component for CBS Banking Application
 * @file src/components/atoms/Input.tsx
 */

import React from 'react';
import clsx from 'clsx';

/**
 * Input component props
 */
export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

/**
 * Input component
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      icon,
      fullWidth = false,
      type = 'text',
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <div className={clsx(fullWidth && 'w-full')}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              {icon}
            </div>
          )}

          <input
            ref={ref}
            type={type}
            disabled={disabled}
            className={clsx(
              'w-full px-3 py-2 border rounded-lg transition-colors duration-200',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
              icon ? 'pl-10' : '',
              error
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-500',
              disabled && 'bg-gray-100 cursor-not-allowed opacity-50',
              className
            )}
            {...props}
          />
        </div>

        {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
        {helperText && !error && (
          <p className="text-gray-500 text-sm mt-1">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
