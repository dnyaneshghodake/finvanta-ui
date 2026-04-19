/**
 * CBS Fieldset — form section grouping.
 * @file src/components/cbs/Fieldset.tsx
 *
 * Tier-1 CBS convention: complex forms group fields into labeled
 * sections (e.g. "Debit Leg", "Credit Leg", "Transaction Details").
 * The legend bar matches the cbs-surface-header visual pattern.
 *
 * Usage:
 *   <CbsFieldset legend="Debit Leg">
 *     <div className="grid md:grid-cols-2 gap-4">
 *       <AccountNo label="From Account" ... />
 *       <CbsSelect label="Branch" ... />
 *     </div>
 *   </CbsFieldset>
 */
'use client';

import type { ReactNode } from 'react';

export interface CbsFieldsetProps {
  legend: string;
  children: ReactNode;
  className?: string;
}

export function CbsFieldset({ legend, children, className = '' }: CbsFieldsetProps) {
  return (
    <fieldset className={`cbs-fieldset ${className}`.trim()}>
      <div className="cbs-fieldset-legend">{legend}</div>
      <div className="cbs-fieldset-body">{children}</div>
    </fieldset>
  );
}
