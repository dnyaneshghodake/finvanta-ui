'use client';

/**
 * FINVANTA CBS — GL Inquiry (Phase 8.3).
 *
 * Fetches Chart of Accounts via GET /api/v1/gl/chart-of-accounts.
 * Shows GL code, account name, GL type, level, parent, debit/credit
 * split, and net balance. Header accounts are visually distinguished.
 * Amounts right-aligned in Indian numbering per CBS convention.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/services/api/apiClient';
import { Breadcrumb } from '@/components/cbs';
import { Spinner } from '@/components/atoms';

/**
 * Per REST_API_COMPLETE_CATALOGUE §GL chart-of-accounts, Spring returns:
 *   { glCode, glName, accountType, debitBalance, creditBalance, netBalance,
 *     headerAccount, parentGlCode, glLevel }
 */
interface SpringGlEntry {
  glCode: string;
  glName: string;
  accountType: string;
  debitBalance: number;
  creditBalance: number;
  netBalance: number;
  headerAccount?: boolean;
  parentGlCode?: string | null;
  glLevel?: number;
}

interface GlEntry {
  glCode: string;
  accountName: string;
  accountType: string;
  debitBalance: number;
  creditBalance: number;
  netBalance: number;
  isHeader: boolean;
  parentGlCode: string | null;
  glLevel: number;
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
    apiClient.get<{ status: string; data?: SpringGlEntry[] }>('/gl/chart-of-accounts')
      .then((res) => {
        if (cancelled) return;
        const raw = res.data?.data ?? [];
        setEntries(raw.map((e) => ({
          glCode: e.glCode,
          accountName: e.glName || e.glCode,
          accountType: e.accountType,
          debitBalance: e.debitBalance ?? 0,
          creditBalance: e.creditBalance ?? 0,
          netBalance: e.netBalance ?? (e.debitBalance - e.creditBalance),
          isHeader: e.headerAccount ?? false,
          parentGlCode: e.parentGlCode ?? null,
          glLevel: e.glLevel ?? 0,
        })));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Reports', href: '/reports/gl' },
        { label: 'GL Inquiry' },
      ]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-cbs-ink">GL Inquiry — Chart of Accounts</h1>
          <p className="text-xs text-cbs-steel-600 mt-0.5">
            General Ledger chart of accounts with debit / credit split and net balances.
          </p>
        </div>
        <Link href="/reports/trial-balance" className="cbs-btn cbs-btn-secondary">Trial Balance</Link>
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
                  <th>Lvl</th>
                  <th>GL Code</th>
                  <th>Account Name</th>
                  <th>Type</th>
                  <th>Parent</th>
                  <th className="text-right">Debit</th>
                  <th className="text-right">Credit</th>
                  <th className="text-right">Net Balance</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.glCode} className={e.isHeader ? 'bg-cbs-mist font-semibold' : ''}>
                    <td className="cbs-tabular text-cbs-steel-500 text-center">{e.glLevel}</td>
                    <td className="cbs-tabular font-semibold text-cbs-navy-700">
                      {/* Indent leaf accounts under their header */}
                      {e.glLevel > 1 && <span style={{ paddingLeft: `${(e.glLevel - 1) * 12}px` }} />}
                      {e.glCode}
                    </td>
                    <td className="text-cbs-ink">
                      {e.accountName}
                      {e.isHeader && <span className="ml-1 text-[10px] text-cbs-steel-500 uppercase">(Header)</span>}
                    </td>
                    <td>
                      <span className={`cbs-ribbon ${GL_TYPE_TONE[e.accountType] || 'text-cbs-steel-700 bg-cbs-mist border-cbs-steel-300'}`}>
                        {e.accountType}
                      </span>
                    </td>
                    <td className="cbs-tabular text-cbs-steel-600">{e.parentGlCode || '—'}</td>
                    <td className="cbs-amount">{fmt(e.debitBalance)}</td>
                    <td className="cbs-amount">{fmt(e.creditBalance)}</td>
                    <td className="cbs-amount font-medium">{fmt(e.netBalance)}</td>
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