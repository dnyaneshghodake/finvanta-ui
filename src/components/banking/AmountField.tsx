/**
 * CBS Amount Field — Tier-1 grade financial amount input.
 * @file src/components/banking/AmountField.tsx
 *
 * Banking-domain-aware input for monetary values. Enforces:
 *   - Monospace tabular-nums font (CBS mandatory for amounts)
 *   - Right-aligned display (CBS convention)
 *   - Indian lakh/crore grouping on blur (1,23,456.78)
 *   - Configurable decimal precision (default: 2 for INR)
 *   - Currency symbol prefix
 *   - Prevents non-numeric input (letters, special chars)
 *   - Maximum value enforcement (operator transaction limits)
 *   - aria-describedby for currency context
 *
 * CBS benchmark: Finacle AMOUNT fields use monospace right-aligned
 * display with auto-grouping. T24 CURRENCY.MARKET uses the same
 * pattern. This component replicates that behaviour in React.
 *
 * Zero business logic: validation rules (min/max, limits) are
 * passed in via props. The parent component owns limit enforcement.
 *
 * Usage:
 *   <AmountField
 *     label="Transfer Amount"
 *     currency="INR"
 *     value={amount}
 *     onChange={setAmount}
 *     max={operatorLimit}
 *     error={errors.amount}
 *   />
 */

'use client';

import React, { useState, useCallback, useRef } from 'react';
import clsx from 'clsx';
import { cbsConstants } from '@/tokens';

export interface AmountFieldProps {
  /** Field label. */
  label?: string;
  /** ISO 4217 currency code. Default: INR. */
  currency?: string;
  /** Decimal precision. Default: 2 (INR). */
  precision?: number;
  /** Current numeric value. */
  value: number | null;
  /** Called with the parsed numeric value on change. */
  onChange: (value: number | null) => void;
  /** Maximum allowed value (e.g. operator per-txn limit). */
  max?: number;
  /** Minimum allowed value. Default: 0. */
  min?: number;
  /** Validation error message. */
  error?: string;
  /** Helper text below the field. */
  helperText?: string;
  /** Placeholder text. */
  placeholder?: string;
  /** Disable the field. */
  disabled?: boolean;
  /** Read-only display mode. */
  readOnly?: boolean;
  /** Whether the field is required. */
  required?: boolean;
  /** HTML name attribute. */
  name?: string;
  /** HTML id attribute. */
  id?: string;
  /** Additional CSS class for the wrapper. */
  className?: string;
}

/**
 * Format a numeric value with Indian lakh/crore grouping.
 * 123456.78 → "1,23,456.78"
 */
function formatIndian(value: number, precision: number): string {
  const fixed = value.toFixed(precision);
  const [intPart, decPart] = fixed.split('.');
  if (intPart.length <= 3) {
    return decPart ? `${intPart}.${decPart}` : intPart;
  }
  let formatted = intPart.slice(-3);
  let remaining = intPart.slice(0, -3);
  while (remaining.length > 2) {
    formatted = remaining.slice(-2) + ',' + formatted;
    remaining = remaining.slice(0, -2);
  }
  if (remaining.length > 0) {
    formatted = remaining + ',' + formatted;
  }
  return decPart ? `${formatted}.${decPart}` : formatted;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

const AmountField: React.FC<AmountFieldProps> = ({
  label,
  currency = cbsConstants.defaultCurrency,
  precision = cbsConstants.defaultPrecision,
  value,
  onChange,
  max,
  min = 0,
  error,
  helperText,
  placeholder = '0.00',
  disabled = false,
  readOnly = false,
  required = false,
  name,
  id,
  className,
}) => {
  // Display value: formatted on blur, raw on focus.
  const [displayValue, setDisplayValue] = useState<string>(
    value != null ? formatIndian(value, precision) : '',
  );
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync displayValue when parent changes value externally (form
  // reset, programmatic correction, selecting a different record).
  // Only syncs when the field is NOT focused — during editing the
  // operator's keystrokes own the display value.
  const prevValueRef = useRef(value);
  if (!isFocused && value !== prevValueRef.current) {
    prevValueRef.current = value;
    setDisplayValue(value != null ? formatIndian(value, precision) : '');
  }

  const inputId = id || name || undefined;
  const errorId = inputId ? `${inputId}-error` : undefined;
  const helpId = inputId ? `${inputId}-help` : undefined;
  const currencyId = inputId ? `${inputId}-currency` : undefined;
  const describedBy = [
    currencyId,
    error ? errorId : helperText ? helpId : undefined,
  ].filter(Boolean).join(' ') || undefined;

  const symbol = CURRENCY_SYMBOLS[currency] || currency;

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    // Show raw number on focus for editing.
    if (value != null) {
      setDisplayValue(value.toFixed(precision));
    }
  }, [value, precision]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    // Parse and format on blur.
    const cleaned = displayValue.replace(/[^0-9.]/g, '');
    if (!cleaned || cleaned === '.') {
      setDisplayValue('');
      onChange(null);
      return;
    }
    let num = parseFloat(cleaned);
    if (!Number.isFinite(num)) {
      setDisplayValue('');
      onChange(null);
      return;
    }
    // Clamp to min/max.
    if (min != null && num < min) num = min;
    if (max != null && num > max) num = max;
    // Round to precision.
    num = parseFloat(num.toFixed(precision));
    setDisplayValue(formatIndian(num, precision));
    onChange(num);
  }, [displayValue, onChange, precision, min, max]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow digits, one decimal point, and commas (for paste).
    const filtered = raw.replace(/[^0-9.,]/g, '');
    setDisplayValue(filtered);
  }, []);

  // Prevent non-numeric keystrokes (letters, special chars).
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow: backspace, delete, tab, escape, enter, arrows, home, end.
    const allowed = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
      'ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (allowed.includes(e.key)) return;
    // Allow Ctrl/Cmd+A, C, V, X.
    if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) return;
    // Allow digits and one decimal point.
    if (/^[0-9]$/.test(e.key)) return;
    if (e.key === '.' && !displayValue.includes('.')) return;
    e.preventDefault();
  }, [displayValue]);

  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={inputId} className="cbs-field-label">
          {label}
          {required && <span className="text-cbs-crimson-700 ml-0.5" aria-hidden="true">*</span>}
          {required && <span className="sr-only"> (required)</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {/* Currency symbol */}
        <span
          id={currencyId}
          className="absolute left-2.5 text-cbs-steel-500 text-sm font-medium pointer-events-none select-none"
          aria-label={`Currency: ${currency}`}
        >
          {symbol}
        </span>

        <input
          ref={inputRef}
          id={inputId}
          name={name}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={clsx(
            'cbs-input cbs-input-mono text-right pl-8',
            error && 'border-cbs-crimson-600 focus:border-cbs-crimson-600 focus:ring-cbs-crimson-100',
            isFocused && 'font-normal',
            !isFocused && 'font-medium',
          )}
          autoComplete="off"
        />
      </div>

      {error && (
        <p id={errorId} className="text-xs text-cbs-crimson-700" role="alert">{error}</p>
      )}
      {helperText && !error && (
        <p id={helpId} className="text-xs text-cbs-steel-600">{helperText}</p>
      )}
      {max != null && !error && (
        <p className="text-[10px] text-cbs-steel-400 cbs-tabular">
          Limit: {symbol}{formatIndian(max, precision)}
        </p>
      )}
    </div>
  );
};

AmountField.displayName = 'AmountField';

export { AmountField };
