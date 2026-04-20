'use client';

/**
 * CBS Audit Trail Viewer — Tier-1 compliance component.
 * @file src/components/cbs/AuditTrailViewer.tsx
 *
 * Per RBI IT Governance 2023 §8.5 and RBI Cyber Security Framework:
 * every CBS record must have a visible audit trail showing who created,
 * verified, approved, and when. This component renders the workflow
 * history for any entity (account, loan, customer, transaction).
 *
 * CBS benchmark:
 *   Tier-1 CBS: HFINLOG (Financial Log) — accessible from any transaction
 *   Tier-1 CBS:     STMT.ENTRY audit — shows maker/checker/timestamp chain
 *   Tier-1 CBS: CSTB_AUDIT_TRAIL — full field-level change history
 *
 * Usage:
 *   <AuditTrailViewer entityType="ACCOUNT" entityId="CASA0001" />
 *   <AuditTrailViewer entityType="LOAN_APPLICATION" entityId="42" />
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/services/api/apiClient';
import { formatCbsTimestamp } from '@/utils/formatters';
import { Clock, User, CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────── */

export interface AuditEntry {
  id: number;
  entityType: string;
  entityId: string;
  actionType: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'AUTO_APPROVED' | 'ESCALATED';
  makerUserId: string;
  checkerUserId?: string;
  makerRemarks?: string;
  checkerRemarks?: string;
  submittedAt: string;
  actionedAt?: string;
  slaBreached: boolean;
  slaDeadline?: string;
  fieldChanges?: FieldChange[];
}

export interface FieldChange {
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
}

interface AuditTrailViewerProps {
  entityType: string;
  entityId: string;
  /** Compact mode for inline display (e.g. inside account detail). */
  compact?: boolean;
  /** Maximum entries to show initially. Default: 10. */
  maxEntries?: number;
}

/* ── Status styling ────────────────────────────────────────────── */

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; tone: string; label: string }> = {
  PENDING: {
    icon: <Clock size={14} className="text-cbs-gold-700" />,
    tone: 'border-cbs-gold-600 bg-cbs-gold-50 text-cbs-gold-700',
    label: 'Pending',
  },
  APPROVED: {
    icon: <CheckCircle size={14} className="text-cbs-olive-700" />,
    tone: 'border-cbs-olive-600 bg-cbs-olive-50 text-cbs-olive-700',
    label: 'Approved',
  },
  REJECTED: {
    icon: <XCircle size={14} className="text-cbs-crimson-700" />,
    tone: 'border-cbs-crimson-600 bg-cbs-crimson-50 text-cbs-crimson-700',
    label: 'Rejected',
  },
  AUTO_APPROVED: {
    icon: <CheckCircle size={14} className="text-cbs-olive-700" />,
    tone: 'border-cbs-olive-600 bg-cbs-olive-50 text-cbs-olive-700',
    label: 'Auto-Approved',
  },
  ESCALATED: {
    icon: <AlertTriangle size={14} className="text-cbs-crimson-700" />,
    tone: 'border-cbs-crimson-600 bg-cbs-crimson-50 text-cbs-crimson-700',
    label: 'Escalated',
  },
};

/* ── Component ─────────────────────────────────────────────────── */

export function AuditTrailViewer({
  entityType,
  entityId,
  compact = false,
  maxEntries = 10,
}: AuditTrailViewerProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);

  const loadAuditTrail = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{
        status?: string;
        data?: AuditEntry[];
      }>(`/workflow/history/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`, {
        validateStatus: () => true,
      });
      if (res.status >= 200 && res.status < 300 && res.data?.data) {
        setEntries(res.data.data.slice(0, maxEntries));
      } else if (res.status === 404) {
        setEntries([]);
      } else {
        setError('Failed to load audit trail');
      }
    } catch {
      setError('Unable to connect to audit service');
    } finally {
      setIsLoading(false);
    }
  }, [entityType, entityId, maxEntries]);

  // Standard fetch-on-mount: `loadAuditTrail` calls `setIsLoading(true)`.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void loadAuditTrail();
  }, [loadAuditTrail]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-2" role="status" aria-label="Loading audit trail">
        {[0, 1, 2].map((i) => (
          <div key={i} className="cbs-skeleton rounded-sm h-12" />
        ))}
        <span className="sr-only">Loading audit trail…</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-between gap-3 p-3 border border-cbs-crimson-200 bg-cbs-crimson-50 rounded-sm text-xs">
        <span className="text-cbs-crimson-700">{error}</span>
        <button
          type="button"
          onClick={() => void loadAuditTrail()}
          className="text-cbs-crimson-700 font-semibold hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  // Empty state
  if (entries.length === 0) {
    return (
      <div className="text-center py-6 text-xs text-cbs-steel-500">
        No audit trail entries for this record.
      </div>
    );
  }

  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'} role="log" aria-label="Audit trail">
      {entries.map((entry) => {
        const config = STATUS_CONFIG[entry.status] || STATUS_CONFIG.PENDING;
        const isExpanded = expandedEntry === entry.id;

        return (
          <div
            key={entry.id}
            className={`border rounded-sm transition-colors ${
              entry.slaBreached ? 'border-cbs-crimson-300' : 'border-cbs-steel-200'
            }`}
          >
            {/* Header row */}
            <button
              type="button"
              onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
              className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-cbs-mist transition-colors"
              aria-expanded={isExpanded}
            >
              {config.icon}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-cbs-ink">
                    {entry.actionType.replace(/_/g, ' ')}
                  </span>
                  <span className={`cbs-ribbon text-[10px] ${config.tone}`}>
                    {config.label}
                  </span>
                  {entry.slaBreached && (
                    <span className="cbs-ribbon text-[10px] border-cbs-crimson-600 bg-cbs-crimson-50 text-cbs-crimson-700">
                      SLA BREACHED
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[10px] text-cbs-steel-500 cbs-tabular mt-0.5">
                  <span className="flex items-center gap-1">
                    <User size={10} />
                    Maker: {entry.makerUserId}
                  </span>
                  {entry.checkerUserId && (
                    <span className="flex items-center gap-1">
                      <User size={10} />
                      Checker: {entry.checkerUserId}
                    </span>
                  )}
                  <span>{formatCbsTimestamp(entry.submittedAt)}</span>
                </div>
              </div>
              {isExpanded ? <ChevronUp size={14} className="text-cbs-steel-400" /> : <ChevronDown size={14} className="text-cbs-steel-400" />}
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="px-3 pb-3 pt-1 border-t border-cbs-steel-100 space-y-2">
                {entry.makerRemarks && (
                  <div className="text-xs">
                    <span className="text-cbs-steel-500 font-semibold">Maker Remarks: </span>
                    <span className="text-cbs-ink">{entry.makerRemarks}</span>
                  </div>
                )}
                {entry.checkerRemarks && (
                  <div className="text-xs">
                    <span className="text-cbs-steel-500 font-semibold">Checker Remarks: </span>
                    <span className="text-cbs-ink">{entry.checkerRemarks}</span>
                  </div>
                )}
                {entry.actionedAt && (
                  <div className="text-[10px] text-cbs-steel-500 cbs-tabular">
                    Actioned: {formatCbsTimestamp(entry.actionedAt)}
                  </div>
                )}
                {/* Field-level changes (Tier-1 CBS-style diff) */}
                {entry.fieldChanges && entry.fieldChanges.length > 0 && (
                  <div className="mt-2">
                    <div className="text-[10px] font-semibold text-cbs-steel-500 uppercase tracking-wider mb-1">
                      Field Changes
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[10px] text-cbs-steel-500 uppercase">
                          <th className="text-left py-0.5 pr-2">Field</th>
                          <th className="text-left py-0.5 pr-2">Old Value</th>
                          <th className="text-left py-0.5">New Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entry.fieldChanges.map((fc, i) => (
                          <tr key={i} className="border-t border-cbs-steel-100">
                            <td className="py-1 pr-2 text-cbs-steel-700 font-medium">{fc.fieldName}</td>
                            <td className="py-1 pr-2 cbs-tabular text-cbs-crimson-700 line-through">
                              {fc.oldValue || '—'}
                            </td>
                            <td className="py-1 cbs-tabular text-cbs-olive-700 font-medium">
                              {fc.newValue || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
