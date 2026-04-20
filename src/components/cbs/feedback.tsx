/**
 * FINVANTA CBS Tier-1 feedback primitives.
 *
 *   - StatusRibbon: maker-checker / posting workflow status chip.
 *   - ApprovalTrail: ordered list of workflow events (who, when, action).
 *   - AuditHashChip: monospaced 12-char prefix of the SHA-256 hash
 *     chain anchor for a posting; identity trust at a glance.
 *   - CorrelationRefBadge: short "Ref: <id>" chip so an operator can
 *     read it back to the support desk.
 */
'use client';

import { type ReactNode } from 'react';
import { formatCbsTimestamp } from '@/utils/formatters';

/**
 * CBS status values — covers workflow, account lifecycle (API §18),
 * and loan pipeline (API §18) statuses.
 */
export type CbsStatus =
  | 'PENDING_APPROVAL'
  | 'PENDING_VERIFICATION'
  | 'PENDING_ACTIVATION'
  | 'APPROVED'
  | 'POSTED'
  | 'REJECTED'
  | 'REVERSED'
  | 'ACTIVE'
  | 'DORMANT'
  | 'INOPERATIVE'
  | 'FROZEN'
  | 'CLOSED'
  | 'DECEASED'
  | 'DRAFT'
  | 'SUBMITTED'
  | 'VERIFIED'
  | 'DISBURSED'
  | 'WRITTEN_OFF';

const STATUS_TONE: Record<CbsStatus, string> = {
  PENDING_APPROVAL: 'text-cbs-gold-700 bg-cbs-gold-50 border-cbs-gold-600',
  PENDING_VERIFICATION: 'text-cbs-gold-700 bg-cbs-gold-50 border-cbs-gold-600',
  PENDING_ACTIVATION: 'text-cbs-gold-700 bg-cbs-gold-50 border-cbs-gold-600',
  APPROVED: 'text-cbs-olive-700 bg-cbs-olive-50 border-cbs-olive-600',
  POSTED: 'text-cbs-olive-700 bg-cbs-olive-50 border-cbs-olive-600',
  ACTIVE: 'text-cbs-olive-700 bg-cbs-olive-50 border-cbs-olive-600',
  DISBURSED: 'text-cbs-olive-700 bg-cbs-olive-50 border-cbs-olive-600',
  VERIFIED: 'text-cbs-navy-700 bg-cbs-navy-50 border-cbs-navy-200',
  SUBMITTED: 'text-cbs-violet-700 bg-cbs-violet-50 border-cbs-violet-600',
  REJECTED: 'text-cbs-crimson-700 bg-cbs-crimson-50 border-cbs-crimson-600',
  REVERSED: 'text-cbs-crimson-700 bg-cbs-crimson-50 border-cbs-crimson-600',
  FROZEN: 'text-cbs-crimson-700 bg-cbs-crimson-50 border-cbs-crimson-600',
  DECEASED: 'text-cbs-crimson-700 bg-cbs-crimson-50 border-cbs-crimson-600',
  WRITTEN_OFF: 'text-cbs-crimson-700 bg-cbs-crimson-50 border-cbs-crimson-600',
  DORMANT: 'text-cbs-gold-700 bg-cbs-gold-50 border-cbs-gold-600',
  INOPERATIVE: 'text-cbs-steel-700 bg-cbs-mist border-cbs-steel-400',
  CLOSED: 'text-cbs-steel-700 bg-cbs-mist border-cbs-steel-400',
  DRAFT: 'text-cbs-violet-700 bg-cbs-violet-50 border-cbs-violet-600',
};

export function StatusRibbon({ status }: { status: CbsStatus | string }) {
  const tone = STATUS_TONE[status as CbsStatus] || STATUS_TONE.DRAFT;
  return (
    <span className={`cbs-ribbon ${tone}`}>{String(status).replace(/_/g, ' ')}</span>
  );
}

export interface ApprovalTrailEntry {
  actor: string;
  role?: string;
  action:
    | 'MAKER_SUBMIT'
    | 'CHECKER_APPROVE'
    | 'CHECKER_REJECT'
    | 'VERIFIER_VERIFY'
    | 'VERIFIER_REJECT'
    | 'RECALL'
    | 'AUTO_POST'
    | string;
  at: string | number | Date;
  remarks?: string;
}

function actionTone(action: string): string {
  if (action.includes('APPROVE') || action.includes('POST') || action.includes('VERIFY')) {
    return 'text-cbs-olive-700';
  }
  if (action.includes('REJECT') || action.includes('RECALL')) {
    return 'text-cbs-crimson-700';
  }
  return 'text-cbs-steel-700';
}

export function ApprovalTrail({ entries }: { entries: ApprovalTrailEntry[] }) {
  if (!entries?.length) {
    return (
      <div className="text-xs text-cbs-steel-600 italic">
        No workflow events recorded yet.
      </div>
    );
  }
  return (
    <ol className="relative border-l-2 border-cbs-steel-200 pl-4 space-y-3">
      {entries.map((e, i) => {
        const when = e.at instanceof Date ? e.at : new Date(e.at);
        return (
          <li key={`${i}-${e.actor}-${String(e.at)}`} className="relative">
            <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-cbs-navy-700 border-2 border-white" />
            <div className={`text-xs font-semibold uppercase tracking-wider ${actionTone(e.action)}`}>
              {e.action.replace(/_/g, ' ')}
            </div>
            <div className="text-sm text-cbs-ink">
              {e.actor}
              {e.role ? <span className="text-cbs-steel-600"> &middot; {e.role}</span> : null}
            </div>
            <div className="text-xs cbs-tabular text-cbs-steel-600">
              {formatCbsTimestamp(when)}
            </div>
            {e.remarks ? (
              <div className="text-xs text-cbs-ink mt-0.5">&ldquo;{e.remarks}&rdquo;</div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function AuditHashChip({ hashPrefix }: { hashPrefix?: string | null }) {
  if (!hashPrefix) return null;
  const safe = hashPrefix.replace(/[^0-9a-fA-F]/g, '').slice(0, 12);
  return (
    <span
      className="inline-flex items-center gap-1 px-2 h-[22px] text-xs font-mono bg-cbs-mist border border-cbs-steel-300 text-cbs-steel-700"
      title="SHA-256 audit hash anchor (first 12 chars)"
    >
      <span className="text-[10px] uppercase tracking-wider text-cbs-steel-600">Hash</span>
      {safe}
    </span>
  );
}

export function CorrelationRefBadge({ value }: { value?: string | null }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 h-[22px] text-xs font-mono bg-cbs-navy-50 border border-cbs-navy-200 text-cbs-navy-700">
      <span className="text-[10px] uppercase tracking-wider text-cbs-navy-600">Ref</span>
      {value.slice(0, 12)}
    </span>
  );
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="cbs-field-label">{label}</div>
      <div className="cbs-field-value">{children}</div>
    </div>
  );
}
