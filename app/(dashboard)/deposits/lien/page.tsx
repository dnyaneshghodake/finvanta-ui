'use client';

/**
 * FINVANTA CBS — FD Lien Mark / Release (Phase 5.4).
 *
 * Marks or releases a lien on a fixed deposit.
 *   - Mark lien: POST /api/v1/fixed-deposits/{fd}/lien/mark
 *   - Release lien: POST /api/v1/fixed-deposits/{fd}/lien/release
 *
 * A lien prevents premature closure or withdrawal against the FD.
 * Typically marked for loan collateral or legal/regulatory holds.
 */

import { useState } from 'react';
import { apiClient } from '@/services/api/apiClient';
import { CorrelationRefBadge } from '@/components/cbs';
import { Button } from '@/components/atoms';
import Link from 'next/link';

export default function FdLienPage() {
  const [fdNumber, setFdNumber] = useState('');
  const [lienAmount, setLienAmount] = useState('');
  const [lienReason, setLienReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleAction = async (action: 'mark' | 'release') => {
    if (!fdNumber.trim()) { setError('FD number is required'); return; }
    if (action === 'mark' && !lienAmount.trim()) { setError('Lien amount is required for marking'); return; }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      // REST_API_COMPLETE_CATALOGUE §FD lien/mark expects `lienAmount` +
      // `loanAccountNumber`; lien/release has empty body.
      const body = action === 'mark'
        ? { lienAmount: Number(lienAmount), loanAccountNumber: lienReason.trim() || undefined }
        : {};
      const res = await apiClient.post(`/fixed-deposits/${fdNumber.trim()}/lien/${action}`, body);
      const corr = res.headers?.['x-correlation-id'] as string | undefined;
      setCorrelationId(corr || null);
      if (res.data?.status === 'SUCCESS') {
        setSuccess(`Lien ${action === 'mark' ? 'marked' : 'released'} on FD ${fdNumber}.`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Lien ${action} failed`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-cbs-ink">FD Lien Mark / Release</h1>
        <p className="text-xs text-cbs-steel-600 mt-0.5">
          Mark or release a lien on a fixed deposit. Liens prevent premature
          closure and are used for loan collateral or regulatory holds.
        </p>
      </div>

      {error && (
        <div className="border border-cbs-crimson-600 bg-cbs-crimson-50 text-cbs-crimson-700 p-3 text-sm">
          <div className="font-semibold">Operation failed</div>
          <div>{error}</div>
        </div>
      )}

      {success && (
        <div className="border border-cbs-olive-600 bg-cbs-olive-50 text-cbs-olive-700 p-3 text-sm">
          <div className="font-semibold">Lien operation successful</div>
          <div>{success}</div>
          {correlationId && <div className="mt-2"><CorrelationRefBadge value={correlationId} /></div>}
        </div>
      )}

      {!success && (
        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
              Lien Details
            </span>
          </div>
          <div className="cbs-surface-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <label className="cbs-field-label block mb-1">Lien Amount (for Mark)</label>
                <div className="flex cbs-input p-0 overflow-hidden">
                  <span className="inline-flex items-center px-3 bg-cbs-mist border-r border-cbs-steel-200 text-cbs-steel-700 text-xs font-semibold uppercase tracking-wider">
                    INR
                  </span>
                  <input
                    className="flex-1 cbs-amount bg-transparent outline-none px-2 h-[32px]"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={lienAmount}
                    onChange={(e) => setLienAmount(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="cbs-field-label block mb-1">Loan Account Number (for Mark)</label>
                <input
                  className="cbs-input cbs-tabular uppercase"
                  placeholder="e.g. LOAN0001"
                  value={lienReason}
                  onChange={(e) => setLienReason(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end border-t border-cbs-steel-200 pt-3">
              <Link href="/deposits" className="cbs-btn cbs-btn-secondary">Cancel</Link>
              <Button variant="danger" isLoading={submitting} onClick={() => handleAction('release')}>
                Release Lien
              </Button>
              <Button isLoading={submitting} onClick={() => handleAction('mark')}>
                Mark Lien
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}