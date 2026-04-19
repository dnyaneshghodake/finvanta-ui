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
          <label className="cbs-field-label block mb-1">
            {label}
            {props.required && <span className="text-cbs-crimson-700 ml-0.5">*</span>}
          </label>
        )}

        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cbs-steel-400">
              {icon}
            </div>
          )}

          <input
            ref={ref}
            type={type}
            disabled={disabled}
            className={clsx(
              'cbs-input',
              icon ? 'pl-10' : '',
              error && 'border-cbs-crimson-600 focus:border-cbs-crimson-600 focus:ring-cbs-crimson-100',
              className
            )}
            aria-invalid={!!error}
            {...props}
          />
        </div>

        {error && <p className="text-xs text-cbs-crimson-700 mt-1">{error}</p>}
        {helperText && !error && (
          <p className="text-xs text-cbs-steel-600 mt-1">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
