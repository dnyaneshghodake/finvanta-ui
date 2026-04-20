'use client';

/**
 * FINVANTA CBS — Maker-Checker Workflow Queue (Tier-1 Grade).
 * CBS benchmark: Tier-1 CBS approval workflow.
 * Per RBI IT Governance 2023 §8.2: maker-checker with audit trail.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useUIStore } from '@/store/uiStore';
import { Breadcrumb, CbsTableSkeleton } from '@/components/cbs';
import { AuditTrailViewer } from '@/components/cbs/AuditTrailViewer';
import { workflowService, type WorkflowItem, type DecisionRequest } from '@/services/api/workflowService';
import { canApprove } from '@/security/roleGuard';
import { useCbsKeyboard } from '@/hooks/useCbsKeyboard';
import { formatCbsTimestamp } from '@/utils/formatters';
import { CheckCircle, XCircle, Clock, ChevronRight, Search, Loader2, X } from 'lucide-react';

const STATUS_TONE: Record<string, string> = {
  PENDING_APPROVAL: 'text-cbs-gold-700 bg-cbs-gold-50 border-cbs-gold-600',
  APPROVED: 'text-cbs-olive-700 bg-cbs-olive-50 border-cbs-olive-600',
  REJECTED: 'text-cbs-crimson-700 bg-cbs-crimson-50 border-cbs-crimson-600',
  RECALLED: 'text-cbs-steel-700 bg-cbs-mist border-cbs-steel-300',
};

const ENTITY_TYPES = [
  { value: '', label: 'All' }, { value: 'ACCOUNT', label: 'Account' },
  { value: 'LOAN_APPLICATION', label: 'Loan' }, { value: 'TRANSFER', label: 'Transfer' },
];

export default function WorkflowPage() {
  const { addToast } = useUIStore();
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState<WorkflowItem | null>(null);
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const r = await workflowService.listPending({ page: 0, size: 50, ...(filter ? { entityType: filter } : {}) });
      if (r.success && r.data) { setItems(r.data.items); setTotal(r.data.total); }
      else { setItems([]); setTotal(0); }
    } catch { setItems([]); }
    finally { setIsLoading(false); }
  }, [filter]);

  // Standard fetch-on-mount: `load()` calls `setIsLoading(true)`.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const list = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(i => i.entityType.toLowerCase().includes(q) || String(i.entityId).includes(q) || i.makerId.toLowerCase().includes(q));
  }, [items, search]);

  useCbsKeyboard(useMemo(() => ({ F5: () => { void load(); }, Escape: () => { setSel(null); } }), [load]));

  const act = async (a: 'approve' | 'reject') => {
    if (!sel) return;
    if (!remarks.trim() && a === 'reject') { addToast({ type: 'error', title: 'Required', message: 'Rejection needs remarks.', duration: 4000 }); return; }
    setBusy(true);
    try {
      const req: DecisionRequest = { id: sel.id, version: sel.version, remarks: remarks.trim() || undefined };
      const r = a === 'approve' ? await workflowService.approve(req) : await workflowService.reject(req);
      if (r.success) { addToast({ type: 'success', title: a === 'approve' ? 'Approved' : 'Rejected', message: `Done.`, duration: 3000 }); setSel(null); setRemarks(''); void load(); }
      else if (r.errorCode === 'VERSION_CONFLICT') { addToast({ type: 'error', title: 'Stale', message: 'Refreshing...', duration: 3000 }); void load(); setSel(null); }
      else { addToast({ type: 'error', title: 'Failed', message: r.message || 'Error', duration: 3000 }); }
    } catch { addToast({ type: 'error', title: 'Error', message: 'Network error.', duration: 3000 }); }
    finally { setBusy(false); }
  };

  const canAct = sel ? canApprove(sel.makerId) : false;

  return (
    <div className="space-y-4">
      <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Workflow Queue' }]} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-cbs-ink">Maker-Checker Approval Queue</h1>
          <p className="text-xs text-cbs-steel-600 mt-0.5">Self-approval blocked per RBI. <span className="cbs-kbd ml-2">F5</span> Refresh</p>
        </div>
        <span className="flex items-center gap-1 text-xs text-cbs-gold-700"><Clock size={12} /> {total} pending</span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cbs-steel-400" />
          <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="cbs-input pl-8 w-full" />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="cbs-input w-auto">
          {ENTITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div className="flex gap-4">
        <div className={`flex-1 min-w-0 ${sel ? 'hidden md:block md:w-1/2' : ''}`}>
          {isLoading ? <CbsTableSkeleton rows={8} /> : list.length === 0 ? (
            <section className="cbs-surface text-center py-10">
              <CheckCircle size={32} className="text-cbs-olive-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-cbs-ink">Queue Clear</h3>
            </section>
          ) : (
            <section className="cbs-surface">
              <div className="cbs-surface-header">
                <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Pending</span>
                <span className="text-xs text-cbs-steel-500 cbs-tabular">{list.length}/{total}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="cbs-grid-table">
                  <thead><tr>
                    <th scope="col">Entity</th><th scope="col">ID</th><th scope="col">Action</th>
                    <th scope="col">Maker</th><th scope="col">Submitted</th><th scope="col">Status</th>
                  </tr></thead>
                  <tbody>
                    {list.map(i => (
                      <tr key={i.id} onClick={() => { setSel(i); setRemarks(''); }}
                        className={`cursor-pointer ${sel?.id === i.id ? 'bg-cbs-navy-50' : 'hover:bg-cbs-mist'}`}
                        role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') setSel(i); }}>
                        <td className="text-xs">{i.entityType.replace(/_/g, ' ')}</td>
                        <td className="cbs-tabular text-cbs-navy-700 font-semibold">{i.entityId}</td>
                        <td className="text-xs">{i.action.replace(/_/g, ' ')}</td>
                        <td className="text-xs text-cbs-steel-700">{i.makerName || i.makerId}</td>
                        <td className="cbs-tabular text-xs text-cbs-steel-600">{formatCbsTimestamp(i.submittedAt)}</td>
                        <td><span className={`cbs-ribbon text-[10px] ${STATUS_TONE[i.status] || ''}`}>{i.status.replace(/_/g, ' ')}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
        {sel && (
          <div className="w-full md:w-1/2 lg:w-[440px] shrink-0">
            <section className="cbs-surface sticky top-4">
              <div className="cbs-surface-header bg-cbs-navy-800 rounded-t-sm">
                <span className="text-sm font-bold text-white uppercase tracking-wider">Review</span>
                <button type="button" onClick={() => setSel(null)} className="text-cbs-navy-300 hover:text-white p-1" aria-label="Close"><X size={14} /></button>
              </div>
              <div className="p-4 space-y-4">
                <dl className="space-y-2 text-xs">
                  <div className="flex justify-between"><dt className="text-cbs-steel-500">Entity</dt><dd className="font-semibold">{sel.entityType.replace(/_/g, ' ')} {sel.entityId}</dd></div>
                  <div className="flex justify-between"><dt className="text-cbs-steel-500">Action</dt><dd>{sel.action.replace(/_/g, ' ')}</dd></div>
                  <div className="flex justify-between"><dt className="text-cbs-steel-500">Maker</dt><dd>{sel.makerName || sel.makerId}</dd></div>
                  <div className="flex justify-between"><dt className="text-cbs-steel-500">Submitted</dt><dd className="cbs-tabular">{formatCbsTimestamp(sel.submittedAt)}</dd></div>
                </dl>
                {sel.payloadSummary && Object.keys(sel.payloadSummary).length > 0 && (
                  <div className="border-t border-cbs-steel-100 pt-3">
                    <h4 className="text-[10px] font-bold text-cbs-steel-500 uppercase mb-2">Changes</h4>
                    <dl className="space-y-1 text-xs">
                      {Object.entries(sel.payloadSummary).map(([k, v]) => (
                        <div key={k} className="flex justify-between"><dt className="text-cbs-steel-500">{k.replace(/_/g, ' ')}</dt><dd className="cbs-tabular font-medium">{String(v ?? '—')}</dd></div>
                      ))}
                    </dl>
                  </div>
                )}
                <div className="border-t border-cbs-steel-100 pt-3">
                  <h4 className="text-[10px] font-bold text-cbs-steel-500 uppercase mb-2">Audit Trail</h4>
                  <AuditTrailViewer entityType={sel.entityType} entityId={String(sel.entityId)} compact maxEntries={5} />
                </div>
                {!canAct && sel.status === 'PENDING_APPROVAL' && (
                  <div className="p-3 border border-cbs-gold-600 bg-cbs-gold-50 rounded-sm text-xs text-cbs-gold-700 flex items-start gap-2">
                    <XCircle size={14} className="shrink-0 mt-0.5" />
                    <span>Self-approval blocked. Another checker must action this.</span>
                  </div>
                )}
                {canAct && sel.status === 'PENDING_APPROVAL' && (
                  <div className="border-t border-cbs-steel-100 pt-3 space-y-3">
                    <label className="text-[10px] font-bold text-cbs-steel-500 uppercase" htmlFor="wf-rem">Remarks</label>
                    <textarea id="wf-rem" value={remarks} onChange={e => setRemarks(e.target.value)}
                      className="cbs-input w-full h-16 resize-none" placeholder="Audit trail…" disabled={busy} />
                    <div className="flex gap-2">
                      {sel.allowedActions?.includes('APPROVE') && (
                        <button type="button" onClick={() => void act('approve')} disabled={busy}
                          className="cbs-btn cbs-btn-primary flex-1 flex items-center justify-center gap-1.5 disabled:opacity-50">
                          {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Approve
                        </button>
                      )}
                      {sel.allowedActions?.includes('REJECT') && (
                        <button type="button" onClick={() => void act('reject')} disabled={busy}
                          className="cbs-btn cbs-btn-secondary flex-1 flex items-center justify-center gap-1.5 text-cbs-crimson-700 disabled:opacity-50">
                          {busy ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Reject
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
