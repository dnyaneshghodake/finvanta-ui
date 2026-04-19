'use client';

/**
 * FINVANTA CBS - Maker-Checker Workflow Queue.
 *
 * Checker inbox: every pending maker action is listed with its
 * entity, amount summary, maker, and allowed actions per the backend's
 * `allowedActions[]` contract. Approvals / rejections are optimistic-
 * lock guarded (@Version) -- a 409 VERSION_CONFLICT surfaces as an
 * inline error so the checker can refresh.
 */

import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import {
  workflowService,
  type WorkflowItem,
} from '@/services/api/workflowService';
import { StatusRibbon, CorrelationRefBadge } from '@/components/cbs';

export default function WorkflowPage() {
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await workflowService.listPending({ size: 50 });
      const raw = res?.data;
      const content = Array.isArray(raw)
        ? raw
        : (raw as { content?: WorkflowItem[] } | undefined)?.content || [];
      setItems(content);
    } catch (err) {
      if (isAxiosError(err)) setError(err.response?.data?.error?.message || err.message);
      else setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  const onDecision = async (
    item: WorkflowItem,
    action: 'approve' | 'reject' | 'recall',
  ) => {
    const remarks = window.prompt(
      action === 'approve'
        ? 'Approval remarks (optional):'
        : action === 'reject'
          ? 'Rejection remarks (required):'
          : 'Recall remarks (optional):',
      '',
    );
    if (action === 'reject' && !remarks) return;
    setBusyId(item.id);
    setError(null);
    try {
      if (action === 'approve') {
        await workflowService.approve({ id: item.id, version: item.version, remarks: remarks || undefined });
      } else if (action === 'reject') {
        await workflowService.reject({ id: item.id, version: item.version, remarks: remarks || undefined });
      } else {
        await workflowService.recall({ id: item.id, version: item.version, remarks: remarks || undefined });
      }
      await load();
    } catch (err) {
      if (isAxiosError(err)) {
        const code = err.response?.data?.error?.code || err.response?.data?.errorCode;
        if (code === 'VERSION_CONFLICT') {
          setError(
            `Record ${item.id} changed since you loaded it. Refreshing -- please retry.`,
          );
          await load();
        } else {
          setError(err.response?.data?.error?.message || err.message);
        }
      } else {
        setError(err instanceof Error ? err.message : 'Unexpected error');
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-cbs-ink">Maker-Checker Queue</h1>
          <p className="text-xs text-cbs-steel-600">
            Pending actions awaiting your review. Self-approval is prevented
            server-side per RBI dual-authorisation.
          </p>
        </div>
        <button type="button" className="cbs-btn cbs-btn-secondary" onClick={load}>
          Refresh
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="border border-cbs-crimson-600 bg-cbs-crimson-50 text-cbs-crimson-700 p-3 text-sm"
        >
          {error}
        </div>
      )}

      <section className="cbs-surface">
        <div className="cbs-surface-header">
          <div className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
            Pending approvals
          </div>
          <span className="text-xs cbs-tabular text-cbs-steel-600">
            {loading ? 'Loading...' : `${items.length} item(s)`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="cbs-grid-table">
            <thead>
              <tr>
                <th>Entity</th>
                <th>Action</th>
                <th>Maker</th>
                <th>Submitted</th>
                <th>Status</th>
                <th className="text-right">Decision</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-cbs-steel-600 italic">
                    No pending items.
                  </td>
                </tr>
              )}
              {items.map((it) => {
                const allowed = it.allowedActions || [];
                return (
                  <tr key={it.id}>
                    <td>
                      <div className="font-medium">
                        {it.entityType} #{it.entityId}
                      </div>
                      {it.payloadSummary && (
                        <div className="text-xs text-cbs-steel-600 cbs-tabular">
                          {Object.entries(it.payloadSummary)
                            .slice(0, 3)
                            .map(([k, v]) => `${k}: ${String(v)}`)
                            .join('  |  ')}
                        </div>
                      )}
                    </td>
                    <td className="cbs-tabular text-xs">{it.action}</td>
                    <td>
                      <div>{it.makerName || it.makerId}</div>
                      <div className="text-xs text-cbs-steel-600">{it.makerId}</div>
                    </td>
                    <td className="cbs-tabular text-xs">
                      {it.submittedAt
                        ? new Date(it.submittedAt).toISOString().replace('T', ' ').slice(0, 19)
                        : '--'}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <StatusRibbon status={it.status} />
                        {it.auditHashPrefix && (
                          <CorrelationRefBadge value={it.auditHashPrefix} />
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex gap-1 justify-end">
                        <button
                          type="button"
                          disabled={!allowed.includes('APPROVE') || busyId === it.id}
                          className="cbs-btn cbs-btn-primary"
                          onClick={() => onDecision(it, 'approve')}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={!allowed.includes('REJECT') || busyId === it.id}
                          className="cbs-btn cbs-btn-danger"
                          onClick={() => onDecision(it, 'reject')}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          disabled={!allowed.includes('RECALL') || busyId === it.id}
                          className="cbs-btn cbs-btn-secondary"
                          onClick={() => onDecision(it, 'recall')}
                        >
                          Recall
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
