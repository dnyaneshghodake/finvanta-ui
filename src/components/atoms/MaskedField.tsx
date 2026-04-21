/**
 * Masked PII display field for CBS Banking Application.
 * @file src/components/atoms/MaskedField.tsx
 *
 * Renders sensitive data (Aadhaar, PAN, account numbers) in masked
 * form with copy-prevention. An optional "reveal" toggle allows
 * authorised operators to view the full value temporarily.
 *
 * Security controls:
 *   - Copy/cut/paste disabled on the masked element (oncopy/oncut).
 *   - user-select: none prevents drag-select.
 *   - Screen readers announce "masked" to prevent accidental
 *     PII disclosure via assistive technology.
 *   - Reveal auto-hides after `revealDurationMs` (default 5s)
 *     to prevent walk-away exposure.
 *
 * Per RBI Master Direction on Digital Payment Security Controls
 * 2021 §7 and UIDAI Act 2016 §29.
 *
 * Zero business logic: this component only renders. The masking
 * function and reveal permission check are passed in by the caller.
 *
 * Usage:
 *   <MaskedField
 *     label="Aadhaar"
 *     maskedValue={maskAadhaar(customer.aadhaar)}
 *     fullValue={customer.aadhaar}
 *     allowReveal={hasRole('MANAGER')}
 *   />
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import { Eye, EyeOff } from 'lucide-react';

export interface MaskedFieldProps {
  /** Field label displayed above the value. */
  label: string;
  /** The masked representation (e.g. "XXXX XXXX 9012"). */
  maskedValue: string;
  /** The full unmasked value. Only used when reveal is toggled. */
  fullValue?: string;
  /** Whether the operator is allowed to reveal the full value. */
  allowReveal?: boolean;
  /** Auto-hide duration in ms after reveal. Default: 5000. */
  revealDurationMs?: number;
  /** Additional CSS class. */
  className?: string;
}

const MaskedField: React.FC<MaskedFieldProps> = ({
  label,
  maskedValue,
  fullValue,
  allowReveal = false,
  revealDurationMs = 5000,
  className,
}) => {
  const [isRevealed, setIsRevealed] = useState(false);

  // Auto-hide after revealDurationMs to prevent walk-away exposure.
  useEffect(() => {
    if (!isRevealed) return;
    const timer = setTimeout(() => setIsRevealed(false), revealDurationMs);
    return () => clearTimeout(timer);
  }, [isRevealed, revealDurationMs]);

  const handleToggle = useCallback(() => {
    setIsRevealed((prev) => !prev);
  }, []);

  // Block clipboard operations on the masked field.
  const blockCopy = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
  }, []);

  const displayValue = isRevealed && fullValue ? fullValue : maskedValue;
  const canReveal = allowReveal && fullValue;

  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      <span className="cbs-field-label">{label}</span>
      <div className="flex items-center gap-2">
        <span
          className="cbs-field-value cbs-tabular select-none"
          style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
          onCopy={blockCopy}
          onCut={blockCopy}
          aria-label={isRevealed ? `${label}: ${displayValue}` : `${label}: masked`}
        >
          {displayValue}
        </span>
        {canReveal && (
          <button
            type="button"
            onClick={handleToggle}
            className="p-1 rounded hover:bg-cbs-mist text-cbs-steel-500 hover:text-cbs-ink transition-colors"
            aria-label={isRevealed ? `Hide ${label}` : `Reveal ${label}`}
            title={isRevealed ? 'Hide' : 'Reveal'}
          >
            {isRevealed ? (
              <EyeOff size={14} strokeWidth={1.75} />
            ) : (
              <Eye size={14} strokeWidth={1.75} />
            )}
          </button>
        )}
      </div>
    </div>
  );
};

MaskedField.displayName = 'MaskedField';

export { MaskedField };
