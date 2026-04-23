'use client';

/**
 * FINVANTA CBS — Account Inquiry (CASA Portfolio).
 * @file app/(dashboard)/accounts/page.tsx
 *
 * Per Tier-1 CBS convention: the account inquiry screen is a dense
 * sortable TABLE, not a card grid. Operators scan 20–50 accounts,
 * sort by balance/status, and act directly from the row (View,
 * Statement, Freeze).
 *
 * Card grids are appropriate for dashboard KPI widgets — not for
 * inquiry screens where data density and scanability are paramount.
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { Eye, FileText, Lock, ArrowLeftRight } from 'lucide-react';
import { useAccountStore } from '@/store/accountStore';
import { useUIStore } from '@/store/uiStore';
import { StatisticCard } from '@/components/molecules';
import { Button, RoleGate } from '@/components/atoms';
import {
  Breadcrumb, CbsTableSkeleton, StatusRibbon,
} from '@/components/cbs';
import { formatCurrency, formatAccountType, formatCbsDate } from '@/utils/formatters';
import { R, resolvePath, buildUrl } from '@/config/routes';
import { useDayStatus } from '@/contexts/DayStatusContext';

export default function AccountsPage() {
  const { accounts, fetchAccounts, isLoading } = useAccountStore();
  const { addToast } = useUIStore();
  const { isPostingAllowed } = useDayStatus();

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        await fetchAccounts();
      } catch {
        addToast({
          type: 'error',
          title: 'Error',
          message: 'Failed to load accounts',
          duration: 3000,
        });
      }
    };

    loadAccounts();
  }, [fetchAccounts, addToast]);

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const savingsAccounts = accounts.filter(acc => acc.accountType === 'SAVINGS').length;
  const currentAccounts = accounts.filter(acc => acc.accountType === 'CURRENT').length;

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <Breadcrumb items={[
        { label: R.dashboard.home.label, href: R.dashboard.home.path as string },
        { label: R.accounts.list.label },
      ]} />

      {/* Page Header — text-lg (18px) per DESIGN_SYSTEM.md §5 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-cbs-ink">Account Inquiry</h1>
          <p className="text-xs text-cbs-steel-600 mt-0.5">Branch deposit account portfolio.</p>
        </div>
        <div className="flex gap-2">
          <Link href={R.transfers.internal.path as string} className="cbs-btn cbs-btn-secondary">Transfer</Link>
          <Link href={R.accounts.create.path as string} className="cbs-btn cbs-btn-primary">+ New Account</Link>
        </div>
      </div>

      {isLoading ? (
        <CbsTableSkeleton rows={6} />
      ) : (
        <>
          {/* KPI Summary Row — cards are appropriate here (dashboard density) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatisticCard
              label="Total Balance"
              value={formatCurrency(totalBalance)}
              color="navy"
            />
            <StatisticCard
              label="Savings Accounts"
              value={savingsAccounts}
              color="olive"
            />
            <StatisticCard
              label="Current Accounts"
              value={currentAccounts}
              color="gold"
            />
          </div>

          {/* Account Table — CBS inquiry convention: dense sortable table
           *  with inline actions, not a card grid. Operators scan 20–50
           *  accounts and act directly from the row. */}
          {accounts.length === 0 ? (
            <div className="cbs-surface text-center py-10">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-cbs-ink">No Accounts</h3>
                <p className="text-xs text-cbs-steel-600">No deposit accounts found for this branch.</p>
                <Link href={R.accounts.create.path as string}>
                  <Button size="sm">Open Account</Button>
                </Link>
              </div>
            </div>
          ) : (
            <section className="cbs-surface">
              <div className="cbs-surface-header">
                <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
                  Account Portfolio
                </span>
                <span className="text-xs text-cbs-steel-500 cbs-tabular">
                  {accounts.length} account{accounts.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="cbs-grid-table">
                  <thead>
                    <tr>
                      <th>Account Number</th>
                      <th>Type</th>
                      <th>Customer</th>
                      <th className="text-right">Balance</th>
                      <th className="text-right">Available</th>
                      <th>Status</th>
                      <th>Branch</th>
                      <th>Opened</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((acct) => (
                      <tr key={acct.id}>
                        <td>
                          <Link
                            href={resolvePath(R.accounts.view as import('@/config/routes').RouteEntry, acct.id)}
                            className="cbs-tabular font-semibold text-cbs-navy-700 hover:underline"
                          >
                            {acct.accountNumber}
                          </Link>
                        </td>
                        <td className="text-xs text-cbs-steel-700">
                          {formatAccountType(acct.accountType)}
                        </td>
                        <td className="text-cbs-ink">
                          {acct.customerName || acct.customerNumber || '—'}
                        </td>
                        <td className="cbs-amount">
                          {formatCurrency(acct.balance, acct.currency)}
                        </td>
                        <td className="cbs-amount text-cbs-olive-700">
                          {formatCurrency(acct.availableBalance, acct.currency)}
                        </td>
                        <td>
                          <StatusRibbon status={acct.status} />
                        </td>
                        <td className="cbs-tabular text-cbs-steel-700">
                          {acct.branchCode || '—'}
                        </td>
                        <td className="cbs-tabular text-xs text-cbs-steel-600">
                          {formatCbsDate(acct.openedDate)}
                        </td>
                        <td className="text-right">
                          <div className="inline-flex items-center gap-1">
                            <Link
                              href={resolvePath(R.accounts.view as import('@/config/routes').RouteEntry, acct.id)}
                              className="cbs-btn cbs-btn-secondary h-[26px] px-2 text-xs"
                              title="View Detail"
                            >
                              <Eye size={12} strokeWidth={1.75} />
                            </Link>
                            <Link
                              href={resolvePath(R.accounts.statement as import('@/config/routes').RouteEntry, acct.id)}
                              className="cbs-btn cbs-btn-secondary h-[26px] px-2 text-xs"
                              title="Statement"
                            >
                              <FileText size={12} strokeWidth={1.75} />
                            </Link>
                            <RoleGate roles={['MAKER', 'TELLER', 'OFFICER', 'ADMIN']}>
                              <Link
                                href={buildUrl(R.transfers.internal.path as string, { fromAccount: acct.accountNumber })}
                                className={`cbs-btn cbs-btn-secondary h-[26px] px-2 text-xs ${!isPostingAllowed ? 'opacity-40 pointer-events-none' : ''}`}
                                title="Transfer"
                                aria-disabled={!isPostingAllowed}
                              >
                                <ArrowLeftRight size={12} strokeWidth={1.75} />
                              </Link>
                            </RoleGate>
                            <RoleGate roles={['MAKER', 'CHECKER', 'ADMIN']}>
                              <Link
                                href={buildUrl(R.accounts.freeze.path as string, { accountNumber: acct.accountNumber })}
                                className={`cbs-btn cbs-btn-secondary h-[26px] px-2 text-xs ${!isPostingAllowed ? 'opacity-40 pointer-events-none' : ''}`}
                                title="Freeze / Unfreeze"
                                aria-disabled={!isPostingAllowed}
                              >
                                <Lock size={12} strokeWidth={1.75} />
                              </Link>
                            </RoleGate>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
