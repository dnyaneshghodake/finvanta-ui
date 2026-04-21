/**
 * FormField composite component for CBS Banking Application.
 * @file src/components/molecules/FormField.tsx
 *
 * L3 composite that wraps ANY input element with a consistent
 * label + error + helper text layout. This separates presentation
 * from the input component itself.
 *
 * CBS convention: all form fields in operational screens use the
 * same layout — 11px uppercase label above, inline error below,
 * optional helper text. This component enforces that consistency
 * without requiring each input atom to reimplement it.
 *
 * BACKWARD COMPAT: The old FormField extended InputProps and
 * rendered an <Input> internally. The new version accepts `children`
 * so it can wrap Input, Select, RadioGroup, AmountField, or any
 * other input. For callers that still pass InputProps directly,
 * the `inputProps` escape hatch renders an <Input> automatically.
 *
 * Usage (new — preferred):
 *   <FormField label="Account Type" error={errors.type} required>
 *     <Select name="type" options={types} ... />
 *   </FormField>
 *
 * Usage (legacy compat):
 *   <FormField label="Name" name="name" error={errors.name} />
 */

'use client';

import React from 'react';
import clsx from 'clsx';
import { Input, type InputProps } from '@/components/atoms/Input';

export interface FormFieldProps {
  /** Field label text. */
  label?: string;
  /** Whether the field is required (shows * indicator). */
  required?: boolean;
  /** Validation error message. */
  error?: string;
  /** Helper text below the field. */
  helperText?: string;
  /** Tooltip text (shown on hover). */
  tooltip?: string;
  /** HTML id for the label's htmlFor. Should match the input's id. */
  htmlFor?: string;
  /** Additional CSS class for the wrapper. */
  className?: string;
  /** The input element(s) to render (new API). */
  children?: React.ReactNode;
  /**
   * Legacy compat: if no children are provided and inputProps are
   * passed, an <Input> is rendered automatically. This preserves
   * backward compatibility with existing form code.
   */
  inputProps?: Omit<InputProps, 'label' | 'error' | 'helperText'> & { ref?: React.Ref<HTMLInputElement> };
}

const FormField: React.FC<FormFieldProps> = ({
  label,
  required = false,
  error,
  helperText,
  tooltip,
  htmlFor,
  className,
  children,
  inputProps,
}) => {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  const helpId = htmlFor ? `${htmlFor}-help` : undefined;

  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      {label && (
        <div className="flex items-center gap-1.5">
          <label htmlFor={htmlFor} className="cbs-field-label">
            {label}
            {required && (
              <span className="text-cbs-crimson-700 ml-0.5" aria-hidden="true">*</span>
            )}
            {required && <span className="sr-only"> (required)</span>}
          </label>
          {tooltip && (
            <div className="relative group">
              <span className="text-cbs-steel-400 cursor-help text-xs" aria-label="Help">?</span>
              <div
                role="tooltip"
                className="absolute hidden group-hover:block bg-cbs-ink text-white text-xs rounded-sm p-2 w-48 -left-24 top-5 z-10"
              >
                {tooltip}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Render children (new API) or fallback to Input (legacy compat) */}
      {children || (inputProps && (
        <Input
          {...inputProps}
          error={error}
          helperText={helperText}
          required={required}
        />
      ))}

      {/* Only render error/helper here if using children (new API).
        * When using inputProps, the Input component handles its own error/helper. */}
      {children && error && (
        <p id={errorId} className="text-xs text-cbs-crimson-700" role="alert">
          {error}
        </p>
      )}
      {children && helperText && !error && (
        <p id={helpId} className="text-xs text-cbs-steel-600">
          {helperText}
        </p>
      )}
    </div>
  );
};

FormField.displayName = 'FormField';

export { FormField };
