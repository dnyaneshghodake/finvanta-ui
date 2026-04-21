/**
 * Select dropdown component for CBS Banking Application.
 * @file src/components/atoms/Select.tsx
 *
 * Wraps the CSS-only `.cbs-select` class with a typed React
 * component providing label, error, helper text, and full ARIA
 * support. Matches the Input atom API for consistency.
 *
 * CBS convention: dropdowns use native <select> for reliability
 * on branch-issued terminals (older browsers, kiosk mode).
 * Custom listbox components are reserved for search-ahead fields.
 */

'use client';

import React from 'react';
import clsx from 'clsx';

export interface SelectOption {
  /** The value submitted in forms. */
  value: string;
  /** Human-readable display label. */
  label: string;
  /** Whether the option is disabled. */
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  /** Field label displayed above the select. */
  label?: string;
  /** Validation error message. */
  error?: string;
  /** Helper text below the field. */
  helperText?: string;
  /** Stretch to full width. */
  fullWidth?: boolean;
  /** Placeholder option (disabled, shown when no value selected). */
  placeholder?: string;
  /** The list of options. */
  options: SelectOption[];
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      fullWidth = false,
      placeholder,
      options,
      disabled,
      ...props
    },
    ref,
  ) => {
    const selectId = props.id || props.name || undefined;
    const errorId = selectId ? `${selectId}-error` : undefined;
    const helpId = selectId ? `${selectId}-help` : undefined;
    const describedBy = error ? errorId : helperText ? helpId : undefined;

    return (
      <div className={clsx(fullWidth && 'w-full')}>
        {label && (
          <label htmlFor={selectId} className="cbs-field-label block mb-1">
            {label}
            {props.required && <span className="text-cbs-crimson-700 ml-0.5" aria-hidden="true">*</span>}
            {props.required && <span className="sr-only"> (required)</span>}
          </label>
        )}

        <select
          ref={ref}
          id={selectId}
          disabled={disabled}
          className={clsx(
            'cbs-select',
            error && 'border-cbs-crimson-600 focus:border-cbs-crimson-600 focus:ring-cbs-crimson-100',
            className,
          )}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>

        {error && (
          <p id={errorId} className="text-xs text-cbs-crimson-700 mt-1" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helpId} className="text-xs text-cbs-steel-600 mt-1">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Select.displayName = 'Select';

export { Select };
