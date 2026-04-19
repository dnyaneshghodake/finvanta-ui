/**
 * FormField component for CBS Banking Application
 * @file src/components/molecules/FormField.tsx
 */

import React from 'react';
import { Input, InputProps } from '@/components/atoms/Input';

/**
 * FormField component props
 */
export interface FormFieldProps extends Omit<InputProps, 'ref'> {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  helperText?: string;
  tooltip?: string;
}

/**
 * FormField component for use in forms with react-hook-form
 */
const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  (
    {
      label,
      required,
      hint,
      error,
      helperText,
      tooltip,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <div className="space-y-1">
        {label && (
          <div className="flex items-center gap-1.5">
            <label className="cbs-field-label">
              {label}
              {required && <span className="text-cbs-crimson-700">*</span>}
            </label>
            {tooltip && (
              <div className="relative group">
                <span className="text-cbs-steel-400 cursor-help text-xs">?</span>
                <div className="absolute hidden group-hover:block bg-cbs-ink text-white text-xs rounded-sm p-2 w-48 -left-24 top-5 z-10">
                  {tooltip}
                </div>
              </div>
            )}
          </div>
        )}

        <Input
          ref={ref}
          error={error}
          helperText={helperText || hint}
          className={className}
          required={required}
          {...props}
        />
      </div>
    );
  }
);

FormField.displayName = 'FormField';

export { FormField };
