/**
 * Textarea component for CBS Banking Application.
 * @file src/components/atoms/Textarea.tsx
 *
 * Wraps the CSS-only `.cbs-textarea` class with a typed React
 * component. Used for narration fields, remarks, rejection reasons,
 * and audit comments throughout the CBS.
 *
 * CBS convention: narration fields are mandatory on all financial
 * postings (per RBI audit trail requirements). Max length is
 * typically 120 chars for transaction narration, 500 for remarks.
 */

'use client';

import React from 'react';
import clsx from 'clsx';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Field label displayed above the textarea. */
  label?: string;
  /** Validation error message. */
  error?: string;
  /** Helper text below the field. */
  helperText?: string;
  /** Stretch to full width. */
  fullWidth?: boolean;
  /** Show a character counter. Requires maxLength to be set. */
  showCount?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      fullWidth = false,
      showCount = false,
      disabled,
      value,
      maxLength,
      ...props
    },
    ref,
  ) => {
    const textareaId = props.id || props.name || undefined;
    const errorId = textareaId ? `${textareaId}-error` : undefined;
    const helpId = textareaId ? `${textareaId}-help` : undefined;
    const describedBy = error ? errorId : helperText ? helpId : undefined;

    const charCount = typeof value === 'string' ? value.length : 0;

    return (
      <div className={clsx(fullWidth && 'w-full')}>
        {label && (
          <label htmlFor={textareaId} className="cbs-field-label block mb-1">
            {label}
            {props.required && <span className="text-cbs-crimson-700 ml-0.5" aria-hidden="true">*</span>}
            {props.required && <span className="sr-only"> (required)</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          disabled={disabled}
          value={value}
          maxLength={maxLength}
          className={clsx(
            'cbs-textarea',
            error && 'border-cbs-crimson-600 focus:border-cbs-crimson-600 focus:ring-cbs-crimson-100',
            className,
          )}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          {...props}
        />

        <div className="flex items-center justify-between mt-1">
          <div>
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
          </div>
          {showCount && maxLength && (
            <span
              className={clsx(
                'text-[10px] cbs-tabular',
                charCount > maxLength * 0.9
                  ? 'text-cbs-crimson-700'
                  : 'text-cbs-steel-400',
              )}
              aria-live="polite"
            >
              {charCount}/{maxLength}
            </span>
          )}
        </div>
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';

export { Textarea };
