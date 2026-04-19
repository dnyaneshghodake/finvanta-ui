'use client';

/**
 * FINVANTA CBS — Trial Balance Report (Phase 8.1).
 *
 * Fetches trial balance via GET /api/v1/gl/trial-balance.
 * Shows GL code, account name, debit total, credit total, and net balance.
 * Amounts are right-aligned in Indian numbering with 2 decimal places.
 * Debit/credit totals must match — any mismatch is flagged in crimson.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/services/api/apiClient';
import { Spinner } from '@/components/atoms';

/**
 * Per REST_API_COMPLETE_CATALOGUE §GL trial-balance, Spring returns:
 *   data: { totalDebit, totalCredit, variance, balanced, accountCount,
 *           accounts: [{ glCode, glName, debitBalance, creditBalance, ... }] }
 */
interface SpringTrialBalance {
  totalDebit: number;
  totalCredit: number;
  variance: number;
  balanced: boolean;
  accountCount: number;
  accounts: SpringGlEntry[];
}

interface SpringGlEntry {
  glCode: string;
  glName: string;
  accountType?: string;
  debitBalance: number;
  creditBalance: number;
  netBalance?: number;
}

/** Normalised entry for the UI table. */
interface TrialBalanceEntry {
  glCode: string;
  accountName: string;
  debitTotal: number;
  creditTotal: number;
}

export default function TrialBalancePage() {
  const [entries, setEntries] = useState<TrialBalanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState('');
  const [serverBalanced, setServerBalanced] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const today = new Date().toISOString().split('T')[0];
    setAsOfDate(today);
    apiClient.get<{ status: string; data?: SpringTrialBalance | SpringGlEntry[] }>('/gl/trial-balance', { params: { date: today } })
      .then((res) => {
        if (cancelled) return;
        const raw = res.data?.data;
        if (!raw) { setEntries([]); return; }
        // Handle both shapes: wrapped { accounts: [...] } and flat array
        if (Array.isArray(raw)) {
          // Legacy flat array shape
          setEntries(raw.map((e: SpringGlEntry) => ({
            glCode: e.glCode,
            accountName: e.glName || '',
            debitTotal: e.debitBalance ?? 0,
            creditTotal: e.creditBalance ?? 0,
          })));
        } else {
          // REST_API_COMPLETE_CATALOGUE shape
          setServerBalanced(raw.balanced);
          setEntries((raw.accounts ?? []).map((e) => ({
            glCode: e.glCode,
            accountName: e.glName || '',
            debitTotal: e.debitBalance ?? 0,
            creditTotal: e.creditBalance ?? 0,
          })));
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const totalDebit = entries.reduce((s, e) => s + e.debitTotal, 0);
  const totalCredit = entries.reduce((s, e) => s + e.creditTotal, 0);
  const isBalanced = serverBalanced && Math.abs(totalDebit - totalCredit) < 0.01;

  const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-cbs-ink">Trial Balance</h1>
          <p className="text-xs text-cbs-steel-600 mt-0.5">
            General Ledger trial balance as of {asOfDate || 'today'}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/reports/gl" className="cbs-btn cbs-btn-secondary">GL Inquiry</Link>
          <div className={`cbs-ribbon ${isBalanced ? 'text-cbs-olive-700 bg-cbs-olive-50 border-cbs-olive-600' : 'text-cbs-crimson-700 bg-cbs-crimson-50 border-cbs-crimson-600'}`}>
            {isBalanced ? 'BALANCED' : 'MISMATCH'}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Spinner size="md" message="Loading trial balance..." /></div>
      ) : (
        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Trial Balance</span>
            <span className="text-xs text-cbs-steel-500 cbs-tabular">{entries.length} GL heads</span>
          </div>
          <div className="overflow-x-auto">
            <table className="cbs-grid-table">
              <thead>
                <tr>
                  <th>GL Code</th>
                  <th>Account Name</th>
                  <th className="text-right">Debit (Dr)</th>
                  <th className="text-right">Credit (Cr)</th>
                  <th className="text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const net = e.debitTotal - e.creditTotal;
                  return (
                    <tr key={e.glCode}>
                      <td className="cbs-tabular font-semibold text-cbs-navy-700">{e.glCode}</td>
                      <td className="text-cbs-ink">{e.accountName}</td>
                      <td className="cbs-amount">{fmt(e.debitTotal)}</td>
                      <td className="cbs-amount">{fmt(e.creditTotal)}</td>
                      <td className={`cbs-amount font-semibold ${net > 0 ? 'cbs-amount-debit' : net < 0 ? 'cbs-amount-credit' : ''}`}>
                        {fmt(Math.abs(net))} {net > 0 ? 'Dr' : net < 0 ? 'Cr' : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-cbs-steel-300">
                  <td colSpan={2} className="font-semibold text-cbs-ink text-right">TOTAL</td>
                  <td className="cbs-amount font-bold text-cbs-ink">{fmt(totalDebit)}</td>
                  <td className="cbs-amount font-bold text-cbs-ink">{fmt(totalCredit)}</td>
                  <td className={`cbs-amount font-bold ${!isBalanced ? 'text-cbs-crimson-700' : 'text-cbs-olive-700'}`}>
                    {isBalanced ? '— Balanced —' : `Diff: ${fmt(Math.abs(totalDebit - totalCredit))}`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}