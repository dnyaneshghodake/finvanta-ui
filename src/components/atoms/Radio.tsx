/**
 * Radio button group component for CBS Banking Application.
 * @file src/components/atoms/Radio.tsx
 *
 * CBS-styled radio group with fieldset/legend semantics. Used in:
 *   - Account type selection (Savings / Current / OD)
 *   - Transfer mode selection (NEFT / RTGS / IMPS)
 *   - Workflow action selection (Approve / Reject / Escalate)
 *
 * WCAG: fieldset + legend grouping, aria-invalid on the group,
 * individual radio labels, keyboard arrow-key navigation (native).
 */

'use client';

import React from 'react';
import clsx from 'clsx';

export interface RadioOption {
  /** The value submitted in forms. */
  value: string;
  /** Human-readable display label. */
  label: string;
  /** Whether the option is disabled. */
  disabled?: boolean;
}

export interface RadioGroupProps {
  /** Group label (rendered as fieldset legend). */
  label?: string;
  /** The shared name attribute for all radios in the group. */
  name: string;
  /** The currently selected value. */
  value?: string;
  /** Called when the selection changes. */
  onChange: (value: string) => void;
  /** The list of radio options. */
  options: RadioOption[];
  /** Validation error message. */
  error?: string;
  /** Helper text below the group. */
  helperText?: string;
  /** Layout direction. Default: vertical. */
  direction?: 'vertical' | 'horizontal';
  /** Whether a selection is required. */
  required?: boolean;
  /** Disable the entire group. */
  disabled?: boolean;
  /** Additional CSS class. */
  className?: string;
}

const RadioGroup: React.FC<RadioGroupProps> = ({
  label,
  name,
  value,
  onChange,
  options,
  error,
  helperText,
  direction = 'vertical',
  required = false,
  disabled = false,
  className,
}) => {
  const errorId = `${name}-error`;
  const helpId = `${name}-help`;
  const describedBy = error ? errorId : helperText ? helpId : undefined;

  return (
    <fieldset
      className={clsx('flex flex-col gap-1', className)}
      aria-invalid={!!error}
      aria-describedby={describedBy}
    >
      {label && (
        <legend className="cbs-field-label mb-1">
          {label}
          {required && <span className="text-cbs-crimson-700 ml-0.5" aria-hidden="true">*</span>}
          {required && <span className="sr-only"> (required)</span>}
        </legend>
      )}

      <div
        className={clsx(
          'flex gap-3',
          direction === 'vertical' ? 'flex-col' : 'flex-row flex-wrap',
        )}
        role="radiogroup"
      >
        {options.map((opt) => {
          const optId = `${name}-${opt.value}`;
          const isChecked = value === opt.value;
          const isDisabled = disabled || opt.disabled;

          return (
            <label
              key={opt.value}
              htmlFor={optId}
              className={clsx(
                'inline-flex items-center gap-2 text-sm cursor-pointer',
                isDisabled && 'opacity-55 cursor-not-allowed',
              )}
            >
              <input
                type="radio"
                id={optId}
                name={name}
                value={opt.value}
                checked={isChecked}
                disabled={isDisabled}
                onChange={() => onChange(opt.value)}
                className={clsx(
                  'h-4 w-4 border border-cbs-steel-300 text-cbs-navy-700',
                  'focus:ring-2 focus:ring-cbs-navy-100 focus:ring-offset-1',
                  'checked:border-cbs-navy-700',
                  'disabled:opacity-55 disabled:cursor-not-allowed',
                  error && 'border-cbs-crimson-600',
                )}
              />
              <span className="text-cbs-steel-700 select-none">{opt.label}</span>
            </label>
          );
        })}
      </div>

      {error && (
        <p id={errorId} className="text-xs text-cbs-crimson-700" role="alert">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={helpId} className="text-xs text-cbs-steel-600">
          {helperText}
        </p>
      )}
    </fieldset>
  );
};

RadioGroup.displayName = 'RadioGroup';

export { RadioGroup };
