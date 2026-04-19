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
    // Stable IDs for aria-describedby — WCAG 1.3.1
    const inputId = props.id || props.name || undefined;
    const errorId = inputId ? `${inputId}-error` : undefined;
    const helpId = inputId ? `${inputId}-help` : undefined;
    const describedBy = error ? errorId : helperText ? helpId : undefined;

    return (
      <div className={clsx(fullWidth && 'w-full')}>
        {label && (
          <label htmlFor={inputId} className="cbs-field-label block mb-1">
            {label}
            {props.required && <span className="text-cbs-crimson-700 ml-0.5" aria-hidden="true">*</span>}
            {props.required && <span className="sr-only"> (required)</span>}
          </label>
        )}

        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cbs-steel-400" aria-hidden="true">
              {icon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            type={type}
            disabled={disabled}
            className={clsx(
              'cbs-input',
              icon ? 'pl-10' : '',
              error && 'border-cbs-crimson-600 focus:border-cbs-crimson-600 focus:ring-cbs-crimson-100',
              className
            )}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            {...props}
          />
        </div>

        {error && <p id={errorId} className="text-xs text-cbs-crimson-700 mt-1" role="alert">{error}</p>}
        {helperText && !error && (
          <p id={helpId} className="text-xs text-cbs-steel-600 mt-1">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
