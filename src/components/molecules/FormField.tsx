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
      <div className="space-y-2">
        {label && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">
              {label}
              {required && <span className="text-red-500">*</span>}
            </label>
            {tooltip && (
              <div className="relative group">
                <span className="text-gray-400 cursor-help">?</span>
                <div className="absolute hidden group-hover:block bg-gray-900 text-white text-xs rounded p-2 w-48 -left-24 top-6 z-10">
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
