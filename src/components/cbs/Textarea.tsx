/**
 * CBS Textarea — narration / remarks fields with character counter.
 * @file src/components/cbs/Textarea.tsx
 *
 * Tier-1 CBS convention: narration fields are multi-line, capped at
 * 140 chars (narration) or 500 chars (remarks). A live character
 * counter is always visible. ASCII-only enforcement is optional.
 */
'use client';

import { forwardRef, useState, type TextareaHTMLAttributes, type ChangeEvent } from 'react';

type BaseProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'children'> & {
  label: string;
  error?: string;
  hint?: string;
  showCount?: boolean;
};

export const CbsTextarea = forwardRef<HTMLTextAreaElement, BaseProps>(
  function CbsTextarea({ label, error, hint, showCount = true, id, maxLength = 140, onChange, className = '', ...rest }, ref) {
    const fieldId = id || `ta-${label.replace(/\s+/g, '-').toLowerCase()}`;
    const [charCount, setCharCount] = useState(0);

    const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
      setCharCount(e.target.value.length);
      onChange?.(e);
    };

    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor={fieldId} className="cbs-field-label">
            {label}
          </label>
          {showCount && maxLength && (
            <span className={`text-[10px] cbs-tabular ${charCount > (maxLength * 0.9) ? 'text-cbs-crimson-700 font-semibold' : 'text-cbs-steel-500'}`}>
              {charCount}/{maxLength}
            </span>
          )}
        </div>
        <textarea
          ref={ref}
          id={fieldId}
          maxLength={maxLength}
          onChange={handleChange}
          className={`cbs-textarea ${error ? 'border-cbs-crimson-600' : ''} ${className}`.trim()}
          aria-invalid={!!error}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          {...rest}
        />
        {error ? (
          <div id={`${fieldId}-error`} className="mt-1 text-xs text-cbs-crimson-700" role="alert">{error}</div>
        ) : hint ? (
          <div id={`${fieldId}-hint`} className="mt-1 text-xs text-cbs-steel-600">{hint}</div>
        ) : null}
      </div>
    );
  },
);
