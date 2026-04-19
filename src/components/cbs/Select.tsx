/**
 * CBS Select — styled dropdown for CBS forms.
 * @file src/components/cbs/Select.tsx
 *
 * Tier-1 CBS convention: every dropdown uses the same 34px height,
 * 13px font, steel border, and custom chevron as text inputs.
 *
 * Usage:
 *   <CbsSelect
 *     label="Currency"
 *     options={[
 *       { value: 'INR', label: 'INR — Indian Rupee' },
 *       { value: 'USD', label: 'USD — US Dollar' },
 *     ]}
 *     {...register('currency')}
 *   />
 */
'use client';

import { forwardRef, type SelectHTMLAttributes } from 'react';

export interface CbsSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

type BaseSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  label: string;
  options: CbsSelectOption[];
  placeholder?: string;
  error?: string;
  hint?: string;
};

export const CbsSelect = forwardRef<HTMLSelectElement, BaseSelectProps>(
  function CbsSelect({ label, options, placeholder, error, hint, id, className = '', ...rest }, ref) {
    const fieldId = id || `sel-${label.replace(/\s+/g, '-').toLowerCase()}`;
    return (
      <div>
        <label htmlFor={fieldId} className="cbs-field-label block mb-1">
          {label}
        </label>
        <select
          ref={ref}
          id={fieldId}
          className={`cbs-select ${error ? 'border-cbs-crimson-600' : ''} ${className}`.trim()}
          aria-invalid={!!error}
          {...rest}
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
        {error ? (
          <div className="mt-1 text-xs text-cbs-crimson-700">{error}</div>
        ) : hint ? (
          <div className="mt-1 text-xs text-cbs-steel-600">{hint}</div>
        ) : null}
      </div>
    );
  },
);
