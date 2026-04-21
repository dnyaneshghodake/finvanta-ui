/**
 * Checkbox component for CBS Banking Application.
 * @file src/components/atoms/Checkbox.tsx
 *
 * CBS-styled checkbox with label and error support. Used in:
 *   - Declaration checkboxes (account opening, loan application)
 *   - Filter panels (transaction type, status)
 *   - Bulk selection in workflow queues
 *
 * WCAG: label association, aria-invalid, aria-describedby.
 */

'use client';

import React from 'react';
import clsx from 'clsx';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Checkbox label text. */
  label: string;
  /** Validation error message. */
  error?: string;
  /** Helper text below the checkbox. */
  helperText?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, error, helperText, disabled, id, name, ...props }, ref) => {
    const inputId = id || name || undefined;
    const errorId = inputId ? `${inputId}-error` : undefined;
    const helpId = inputId ? `${inputId}-help` : undefined;
    const describedBy = error ? errorId : helperText ? helpId : undefined;

    return (
      <div className={clsx('flex flex-col gap-0.5', className)}>
        <label
          htmlFor={inputId}
          className={clsx(
            'inline-flex items-center gap-2 text-sm cursor-pointer',
            disabled && 'opacity-55 cursor-not-allowed',
          )}
        >
          <input
            ref={ref}
            type="checkbox"
            id={inputId}
            name={name}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            className={clsx(
              'h-4 w-4 rounded-sm border border-cbs-steel-300 text-cbs-navy-700',
              'focus:ring-2 focus:ring-cbs-navy-100 focus:ring-offset-1',
              'checked:bg-cbs-navy-700 checked:border-cbs-navy-700',
              'disabled:opacity-55 disabled:cursor-not-allowed',
              error && 'border-cbs-crimson-600',
            )}
            {...props}
          />
          <span className="text-cbs-steel-700 select-none">{label}</span>
        </label>

        {error && (
          <p id={errorId} className="text-xs text-cbs-crimson-700 ml-6" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helpId} className="text-xs text-cbs-steel-600 ml-6">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Checkbox.displayName = 'Checkbox';

export { Checkbox };
