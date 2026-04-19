'use client';

/**
 * FINVANTA CBS — GL Inquiry (Phase 8.3).
 *
 * Fetches Chart of Accounts via GET /api/v1/gl/chart-of-accounts.
 * Shows GL code, account name, GL type (ASSET/LIABILITY/INCOME/EXPENSE),
 * and current balance. Amounts right-aligned in Indian numbering.
 */

import { useEffect, useState } from 'react';
import { apiClient } from '@/services/api/apiClient';
import { StatusRibbon } from '@/components/cbs';
import { Spinner } from '@/components/atoms';

interface GlEntry {
  glCode: string;
  accountName: string;
  accountType: string;
  balance: number;
  currency?: string;
}

const GL_TYPE_TONE: Record<string, string> = {
  ASSET: 'text-cbs-navy-700 bg-cbs-navy-50 border-cbs-navy-200',
  LIABILITY: 'text-cbs-violet-700 bg-cbs-violet-50 border-cbs-violet-600',
  INCOME: 'text-cbs-olive-700 bg-cbs-olive-50 border-cbs-olive-600',
  EXPENSE: 'text-cbs-crimson-700 bg-cbs-crimson-50 border-cbs-crimson-600',
  EQUITY: 'text-cbs-gold-700 bg-cbs-gold-50 border-cbs-gold-600',
};

export default function GlInquiryPage() {
  const [entries, setEntries] = useState<GlEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiClient.get<{ status: string; data?: GlEntry[] }>('/gl/chart-of-accounts')
      .then((res) => { if (!cancelled) setEntries(res.data?.data ?? []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-cbs-ink">GL Inquiry — Chart of Accounts</h1>
        <p className="text-xs text-cbs-steel-600 mt-0.5">
          General Ledger chart of accounts with current balances.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Spinner size="md" message="Loading GL..." /></div>
      ) : entries.length === 0 ? (
        <div className="cbs-surface text-center py-8">
          <p className="text-sm text-cbs-steel-500">No GL entries found.</p>
        </div>
      ) : (
        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Chart of Accounts</span>
            <span className="text-xs text-cbs-steel-500 cbs-tabular">{entries.length} GL heads</span>
          </div>
          <div className="overflow-x-auto">
            <table className="cbs-grid-table">
              <thead>
                <tr>
                  <th>GL Code</th>
                  <th>Account Name</th>
                  <th>Type</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.glCode}>
                    <td className="cbs-tabular font-semibold text-cbs-navy-700">{e.glCode}</td>
                    <td className="text-cbs-ink">{e.accountName}</td>
                    <td>
                      <span className={`cbs-ribbon ${GL_TYPE_TONE[e.accountType] || 'text-cbs-steel-700 bg-cbs-mist border-cbs-steel-300'}`}>
                        {e.accountType}
                      </span>
                    </td>
                    <td className="cbs-amount font-medium">{fmt(e.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}