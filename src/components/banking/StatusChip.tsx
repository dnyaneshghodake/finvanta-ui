/**
 * CBS Status Chip — domain-aware status badge for banking entities.
 * @file src/components/banking/StatusChip.tsx
 *
 * Renders account status, transaction status, workflow status, and
 * KYC status with CBS-standard colour coding. Unlike the generic
 * Badge atom, StatusChip understands banking status semantics and
 * maps them to the correct visual tone automatically.
 *
 * CBS convention (per API_REFERENCE.md §18):
 *   ACTIVE / COMPLETED / APPROVED     → olive (success)
 *   PENDING / PENDING_ACTIVATION      → gold (warning)
 *   FROZEN / DORMANT / INOPERATIVE    → navy (info/caution)
 *   CLOSED / DECEASED / FAILED        → crimson (error)
 *   REJECTED / REVERSED               → crimson (error)
 *   PENDING_APPROVAL / ESCALATED      → violet (workflow)
 *
 * Zero business logic: receives a status string and renders it.
 *
 * Usage:
 *   <StatusChip status="ACTIVE" />
 *   <StatusChip status="FROZEN" />
 *   <StatusChip status={transaction.status} />
 */

'use client';

import React from 'react';
import clsx from 'clsx';

export interface StatusChipProps {
  /** The status code (e.g. "ACTIVE", "FROZEN", "PENDING"). */
  status: string;
  /** Optional human-readable override label. */
  label?: string;
  /** Show a leading dot indicator. Default: true. */
  dot?: boolean;
  /** Additional CSS class. */
  className?: string;
}

type StatusTone = 'success' | 'warning' | 'error' | 'info' | 'workflow' | 'neutral';

const TONE_CLASSES: Record<StatusTone, string> = {
  success: 'bg-cbs-olive-50 text-cbs-olive-700 border-cbs-olive-600',
  warning: 'bg-cbs-gold-50 text-cbs-gold-700 border-cbs-gold-600',
  error: 'bg-cbs-crimson-50 text-cbs-crimson-700 border-cbs-crimson-600',
  info: 'bg-cbs-navy-50 text-cbs-navy-700 border-cbs-navy-200',
  workflow: 'bg-cbs-violet-50 text-cbs-violet-700 border-cbs-violet-600',
  neutral: 'bg-cbs-mist text-cbs-steel-700 border-cbs-steel-300',
};

const DOT_CLASSES: Record<StatusTone, string> = {
  success: 'bg-cbs-olive-600',
  warning: 'bg-cbs-gold-600',
  error: 'bg-cbs-crimson-600',
  info: 'bg-cbs-navy-400',
  workflow: 'bg-cbs-violet-600',
  neutral: 'bg-cbs-steel-400',
};

/**
 * Map a CBS status string to a visual tone.
 * Handles account, transaction, workflow, and KYC statuses.
 */
function resolveTone(status: string): StatusTone {
  const s = (status || '').toUpperCase().replace(/[\s-]/g, '_');

  // Success states
  if (['ACTIVE', 'COMPLETED', 'APPROVED', 'POSTED', 'VERIFIED',
    'DISBURSED', 'SETTLED', 'DAY_OPEN'].includes(s)) {
    return 'success';
  }

  // Warning / pending states
  if (['PENDING', 'PENDING_ACTIVATION', 'PROCESSING', 'INITIATED',
    'DRAFT', 'EOD_RUNNING', 'BOD_IN_PROGRESS', 'NOT_OPENED'].includes(s)) {
    return 'warning';
  }

  // Error / terminal states
  if (['CLOSED', 'DECEASED', 'FAILED', 'REJECTED', 'REVERSED',
    'CANCELLED', 'EXPIRED', 'LOCKED', 'DAY_CLOSED'].includes(s)) {
    return 'error';
  }

  // Info / caution states
  if (['FROZEN', 'DORMANT', 'INOPERATIVE', 'DEBIT_FROZEN',
    'CREDIT_FROZEN', 'TOTAL_FREEZE', 'INACTIVE', 'ON_HOLD',
    'SUSPENDED'].includes(s)) {
    return 'info';
  }

  // Workflow states
  if (['PENDING_APPROVAL', 'ESCALATED', 'RECALLED', 'UNDER_REVIEW',
    'SLA_BREACHED', 'MAKER_SUBMITTED'].includes(s)) {
    return 'workflow';
  }

  return 'neutral';
}

/**
 * Format a status code for human display.
 * "PENDING_ACTIVATION" → "Pending Activation"
 */
function formatLabel(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\b(Od|Id|Kyc|Aml|Nri|Pmjdy|Upi|Neft|Rtgs|Imps)\b/gi,
      (m) => m.toUpperCase());
}

const StatusChip: React.FC<StatusChipProps> = ({
  status,
  label,
  dot = true,
  className,
}) => {
  const tone = resolveTone(status);
  const displayLabel = label || formatLabel(status);

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] font-semibold border uppercase tracking-wider whitespace-nowrap',
        TONE_CLASSES[tone],
        className,
      )}
      role="status"
      aria-label={`Status: ${displayLabel}`}
    >
      {dot && (
        <span
          className={clsx('inline-block h-1.5 w-1.5 rounded-full shrink-0', DOT_CLASSES[tone])}
          aria-hidden="true"
        />
      )}
      {displayLabel}
    </span>
  );
};

StatusChip.displayName = 'StatusChip';

export { StatusChip };
