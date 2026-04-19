/**
 * FINVANTA CBS Tier-1 form primitives.
 *
 * Thin, accessible, deterministic inputs aligned with Tier-1 CBS
 * conventions per RBI IT Governance Direction 2023:
 *
 *   - Amounts: INR only (ASCII "INR" prefix), tabular-nums, 2-decimal
 *     display, right-aligned, negative values rendered in red.
 *   - IFSC: 11-char [A-Z]{4}0[A-Z0-9]{6} pattern, forced uppercase.
 *   - PAN: 10-char [A-Z]{5}[0-9]{4}[A-Z] pattern, masked display
 *     (first 4 + *** + last 1) in read-only views per RBI KYC.
 *   - Aadhaar: 12-digit, displayed masked (last 4 visible) per
 *     UIDAI guideline; raw value never echoed into the DOM in read-
 *     only views.
 *   - Account number: opaque masked display ("****1234"); the full
 *     value remains in state only for submit.
 *   - Value date: calendar-date text input (dd-MMM-yyyy), rendered
 *     ASCII-only to match the persisted audit format.
 *   - GL code / Branch code: read-only chips; editing branch context
 *     is prohibited client-side per the BFF branch injection rule.
 *
 * These primitives never reach into business rules -- limits, cutoffs,
 * and holiday calendars are enforced by Spring. Zod schemas only
 * improve the UX by surfacing malformed inputs before submit.
 */
'use client';

import { forwardRef, useCallback, type InputHTMLAttributes, type FocusEvent } from 'react';
import { formatAmountInr } from '@/utils/formatters';

type BaseProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
  error?: string;
  hint?: string;
};

/**
 * FieldShell — shared wrapper for all CBS form primitives.
 *
 * Tier-1 CBS convention: mandatory fields show a crimson asterisk
 * next to the label. The `required` prop is read from the child
 * input's props and threaded through.
 */
/**
 * Derive stable IDs for aria-describedby linking.
 * WCAG 1.3.1 — programmatic association of errors/hints to inputs.
 */
function descId(fieldId: string, type: 'error' | 'hint'): string {
  return `${fieldId}-${type}`;
}

function FieldShell({
  id,
  label,
  error,
  hint,
  required,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="cbs-field-label block mb-1">
        {label}
        {required && <span className="text-cbs-crimson-700 ml-0.5" aria-hidden="true">*</span>}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {children}
      {error ? (
        <div id={descId(id, 'error')} className="mt-1 text-xs text-cbs-crimson-700" role="alert">{error}</div>
      ) : hint ? (
        <div id={descId(id, 'hint')} className="mt-1 text-xs text-cbs-steel-600">{hint}</div>
      ) : null}
    </div>
  );
}

/**
 * Amount in INR. Always two decimals, ASCII INR prefix, right-aligned.
 *
 * On blur: auto-appends ".00" if no decimals, formats with Indian
 * lakh/crore comma grouping (e.g. "1,50,000.00"). On focus: strips
 * commas so the user edits raw digits. Prevents non-numeric input
 * at the keystroke level.
 */
export const AmountInr = forwardRef<HTMLInputElement, BaseProps>(
  function AmountInr({ label, error, hint, id, onBlur, onFocus, onKeyDown, required, ...rest }, ref) {
    const fieldId = id || `amt-${label.replace(/\s+/g, '-').toLowerCase()}`;

    const handleBlur = useCallback(
      (e: FocusEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/,/g, '');
        if (raw && /^\d+(\.\d{0,2})?$/.test(raw)) {
          e.target.value = formatAmountInr(raw);
        }
        onBlur?.(e);
      },
      [onBlur],
    );

    const handleFocus = useCallback(
      (e: FocusEvent<HTMLInputElement>) => {
        // Strip commas on focus so user edits raw digits
        e.target.value = e.target.value.replace(/,/g, '');
        onFocus?.(e);
      },
      [onFocus],
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Allow: backspace, delete, tab, escape, enter, arrows, home, end, decimal point
        const allowed = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End', '.'];
        if (allowed.includes(e.key)) { onKeyDown?.(e); return; }
        // Allow Ctrl/Cmd+A/C/V/X
        if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) { onKeyDown?.(e); return; }
        // Block non-digit keys
        if (!/^\d$/.test(e.key)) { e.preventDefault(); return; }
        onKeyDown?.(e);
      },
      [onKeyDown],
    );

    return (
      <FieldShell id={fieldId} label={label} error={error} hint={hint} required={required}>
        <div className="flex cbs-input p-0 overflow-hidden">
          <span className="inline-flex items-center px-3 bg-cbs-mist border-r border-cbs-steel-200 text-cbs-steel-700 text-xs font-semibold uppercase tracking-wider">
            INR
          </span>
          <input
            ref={ref}
            id={fieldId}
            inputMode="decimal"
            placeholder="0.00"
            className="flex-1 cbs-amount bg-transparent outline-none px-2 h-[32px]"
            aria-invalid={!!error}
            aria-describedby={error ? descId(fieldId, 'error') : hint ? descId(fieldId, 'hint') : undefined}
            onBlur={handleBlur}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            required={required}
            {...rest}
          />
        </div>
      </FieldShell>
    );
  },
);

/** IFSC 11-char code, forced uppercase. */
export const Ifsc = forwardRef<HTMLInputElement, BaseProps>(
  function Ifsc({ label, error, hint, id, required, ...rest }, ref) {
    const fieldId = id || `ifsc-${label.replace(/\s+/g, '-').toLowerCase()}`;
    return (
      <FieldShell id={fieldId} label={label} error={error} hint={hint} required={required}>
        <input
          ref={ref}
          id={fieldId}
          type="text"
          maxLength={11}
          minLength={11}
          pattern="[A-Z]{4}0[A-Z0-9]{6}"
          inputMode="text"
          required={required}
          className="cbs-input cbs-tabular uppercase tracking-wider"
          aria-invalid={!!error}
          aria-describedby={error ? descId(fieldId, 'error') : hint ? descId(fieldId, 'hint') : undefined}
          {...rest}
        />
      </FieldShell>
    );
  },
);

/** PAN: 10 chars ABCDE1234F. Forced uppercase. */
export const Pan = forwardRef<HTMLInputElement, BaseProps>(
  function Pan({ label, error, hint, id, required, ...rest }, ref) {
    const fieldId = id || `pan-${label.replace(/\s+/g, '-').toLowerCase()}`;
    return (
      <FieldShell id={fieldId} label={label} error={error} hint={hint} required={required}>
        <input
          ref={ref}
          id={fieldId}
          type="text"
          maxLength={10}
          minLength={10}
          pattern="[A-Z]{5}[0-9]{4}[A-Z]"
          inputMode="text"
          required={required}
          className="cbs-input cbs-tabular uppercase tracking-wider"
          aria-invalid={!!error}
          aria-describedby={error ? descId(fieldId, 'error') : hint ? descId(fieldId, 'hint') : undefined}
          {...rest}
        />
      </FieldShell>
    );
  },
);

/** Aadhaar: 12 digits (unmasked entry, masked display elsewhere). */
export const Aadhaar = forwardRef<HTMLInputElement, BaseProps>(
  function Aadhaar({ label, error, hint, id, required, ...rest }, ref) {
    const fieldId = id || `aadhaar-${label.replace(/\s+/g, '-').toLowerCase()}`;
    return (
      <FieldShell id={fieldId} label={label} error={error} hint={hint} required={required}>
        <input
          ref={ref}
          id={fieldId}
          type="text"
          maxLength={12}
          minLength={12}
          pattern="\d{12}"
          inputMode="numeric"
          autoComplete="off"
          required={required}
          className="cbs-input cbs-tabular tracking-widest"
          aria-invalid={!!error}
          aria-describedby={error ? descId(fieldId, 'error') : hint ? descId(fieldId, 'hint') : undefined}
          {...rest}
        />
      </FieldShell>
    );
  },
);

/**
 * Account number: CBS alphanumeric identifier (e.g. SB-HQ001-000001).
 * Finvanta uses a composite alphanumeric key shaped
 * `<product>-<branchSol>-<serial>`; digit-only enforcement would
 * block every legitimate CBS account. Pattern mirrors the Zod
 * schema on the transfer form (`[A-Z0-9][A-Z0-9-]{5,24}`).
 */
export const AccountNo = forwardRef<HTMLInputElement, BaseProps>(
  function AccountNo({ label, error, hint, id, required, ...rest }, ref) {
    const fieldId = id || `acct-${label.replace(/\s+/g, '-').toLowerCase()}`;
    return (
      <FieldShell id={fieldId} label={label} error={error} hint={hint} required={required}>
        <input
          ref={ref}
          id={fieldId}
          type="text"
          maxLength={25}
          minLength={6}
          pattern="[A-Z0-9][A-Z0-9-]{5,24}"
          inputMode="text"
          autoCapitalize="characters"
          spellCheck={false}
          required={required}
          className="cbs-input cbs-tabular uppercase tracking-widest"
          aria-invalid={!!error}
          aria-describedby={error ? descId(fieldId, 'error') : hint ? descId(fieldId, 'hint') : undefined}
          {...rest}
        />
      </FieldShell>
    );
  },
);

/**
 * Value date: dd-MMM-yyyy, ASCII-only.
 *
 * Uses native date input. The "today" shortcut button fills the
 * current date — the most common CBS value-date selection.
 */
export const ValueDate = forwardRef<HTMLInputElement, BaseProps>(
  function ValueDate({ label, error, hint, id, required, ...rest }, ref) {
    const fieldId = id || `vdate-${label.replace(/\s+/g, '-').toLowerCase()}`;

    const fillToday = useCallback(() => {
      const el = document.getElementById(fieldId) as HTMLInputElement | null;
      if (el) {
        const today = new Date().toISOString().slice(0, 10);
        // Trigger react-hook-form's onChange by using native setter
        const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        nativeSetter?.call(el, today);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, [fieldId]);

    return (
      <FieldShell id={fieldId} label={label} error={error} hint={hint} required={required}>
        <div className="flex gap-1">
          <input
            ref={ref}
            id={fieldId}
            type="date"
            required={required}
            className="cbs-input cbs-tabular flex-1"
            aria-invalid={!!error}
            aria-describedby={error ? descId(fieldId, 'error') : hint ? descId(fieldId, 'hint') : undefined}
            {...rest}
          />
          <button
            type="button"
            onClick={fillToday}
            className="cbs-btn cbs-btn-secondary h-[34px] px-2 text-[10px] uppercase tracking-wider whitespace-nowrap"
            aria-label="Set value date to today"
          >
            Today
          </button>
        </div>
      </FieldShell>
    );
  },
);

/** Display-only amount renderer (debit red / credit olive / neutral ink). */
export function AmountDisplay({
  amount,
  sign = 'neutral',
  className = '',
}: {
  amount: number | string;
  sign?: 'debit' | 'credit' | 'neutral';
  className?: string;
}) {
  const raw = typeof amount === 'string' ? Number(amount) : amount;
  const safe = Number.isFinite(raw) ? raw : 0;
  const formatted = safe.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const tone =
    sign === 'debit'
      ? 'cbs-amount-debit'
      : sign === 'credit'
        ? 'cbs-amount-credit'
        : '';
  return (
    <span className={`cbs-amount ${tone} ${className}`.trim()}>
      INR {formatted}
    </span>
  );
}

/** Mask a PAN for read-only display: ABCDE1234F -> ABCD***234F. */
export function maskPan(pan: string): string {
  if (!pan || pan.length !== 10) return '****';
  return `${pan.slice(0, 4)}***${pan.slice(-3)}`;
}

/** Mask an Aadhaar for read-only display: last 4 only. */
export function maskAadhaar(aadhaar: string): string {
  if (!aadhaar || aadhaar.length !== 12) return '**** **** ****';
  return `**** **** ${aadhaar.slice(-4)}`;
}

/** Mask an account number for read-only display: last 4 only. */
export function maskAccountNo(acct: string): string {
  if (!acct || acct.length < 4) return '****';
  return `****${acct.slice(-4)}`;
}
