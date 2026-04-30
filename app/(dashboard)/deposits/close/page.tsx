'use client';

/**
 * FINVANTA CBS — FD Premature Close (Phase 5.3).
 *
 * MAKER/CHECKER action: closes an FD before maturity.
 * Calls POST /api/v1/fixed-deposits/{fd}/premature-close.
 *
 * Penalty interest is calculated server-side by the product engine.
 * The UI shows the FD details and requests confirmation — it does
 * NOT compute the penalty or net payout amount.
 */

import { useState } from 'react';
import { apiClient } from '@/services/api/apiClient';
import { CorrelationRefBadge, Breadcrumb } from '@/components/cbs';
import { Button } from '@/components/atoms';
import Link from 'next/link';

export default function FdPrematureClosePage() {
  const [fdNumber, setFdNumber] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleClose = async () => {
    if (!fdNumber.trim()) { setError('FD number is required'); return; }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      // REST_API_COMPLETE_CATALOGUE §FD premature-close expects `reason` (not `remarks`)
      const res = await apiClient.post(`/fixed-deposits/${fdNumber.trim()}/premature-close`, {
        reason: remarks.trim() || undefined,
      });
      const corr = res.headers?.['x-correlation-id'] as string | undefined;
      setCorrelationId(corr || null);
      if (res.data?.status === 'SUCCESS') {
        setSuccess(`FD ${fdNumber} premature close submitted for approval.`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Premature close failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Fixed Deposits', href: '/deposits' },
        { label: 'Premature Close' },
      ]} />

      <div>
        <h1 className="text-lg font-semibold text-cbs-ink">FD Premature Close</h1>
        <p className="text-xs text-cbs-steel-600 mt-0.5">
          Close a fixed deposit before maturity. Penalty interest is
          calculated server-side by the product engine.
        </p>
      </div>

      {error && (
        <div className="border border-cbs-crimson-600 bg-cbs-crimson-50 text-cbs-crimson-700 p-3 text-sm">
          <div className="font-semibold">Premature close failed</div>
          <div>{error}</div>
        </div>
      )}

      {success && (
        <div className="border border-cbs-olive-600 bg-cbs-olive-50 text-cbs-olive-700 p-3 text-sm">
          <div className="font-semibold">Submitted successfully</div>
          <div>{success}</div>
          {correlationId && <div className="mt-2"><CorrelationRefBadge value={correlationId} /></div>}
        </div>
      )}

      {!success && (
        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
              Premature Close Details
            </span>
          </div>
          <div className="cbs-surface-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="cbs-field-label block mb-1">FD Number *</label>
                <input
                  className="cbs-input cbs-tabular"
                  placeholder="Enter FD number"
                  value={fdNumber}
                  onChange={(e) => setFdNumber(e.target.value)}
                />
              </div>
              <div>
                <label className="cbs-field-label block mb-1">Remarks</label>
                <input
                  className="cbs-input"
                  placeholder="Reason for premature closure"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>
            </div>

            <div className="border border-cbs-gold-600 bg-cbs-gold-50 text-cbs-gold-700 p-3 text-xs">
              <span className="font-semibold">Warning:</span> Premature closure
              may attract penalty interest as per the product terms. The net
              payout will be calculated server-side after deducting applicable penalties.
            </div>

            <div className="flex gap-2 justify-end border-t border-cbs-steel-200 pt-3">
              <Link href="/deposits" className="cbs-btn cbs-btn-secondary">Cancel</Link>
              <Button variant="danger" isLoading={submitting} onClick={handleClose}>
                Submit Premature Close
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}