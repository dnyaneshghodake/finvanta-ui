'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useAccountStore } from '@/store/accountStore';
import { useUIStore } from '@/store/uiStore';
import { AccountCard, StatisticCard } from '@/components/molecules';
import { Card, Button, Spinner } from '@/components/atoms';
import { formatCurrency } from '@/utils/formatters';

/**
 * Accounts page
 */
export default function AccountsPage() {
  const { accounts, fetchAccounts, isLoading } = useAccountStore();
  const { addToast } = useUIStore();

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        await fetchAccounts();
      } catch (error) {
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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-cbs-ink">Accounts</h1>
          <p className="text-xs text-cbs-steel-600 mt-0.5">Branch deposit account portfolio.</p>
        </div>
        <Link href="/accounts/new">
          <Button size="sm" variant="secondary">+ New Account</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" message="Loading your accounts..." />
        </div>
      ) : (
        <>
          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatisticCard
              label="Total Balance"
              value={formatCurrency(totalBalance)}
              color="blue"
            />
            <StatisticCard
              label="Savings Accounts"
              value={savingsAccounts}
              color="green"
            />
            <StatisticCard
              label="Current Accounts"
              value={currentAccounts}
              color="yellow"
            />
          </div>

          {accounts.length === 0 ? (
            <div className="cbs-surface text-center py-10">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-cbs-ink">No Accounts</h3>
                <p className="text-xs text-cbs-steel-600">No deposit accounts found for this branch.</p>
                <Link href="/accounts/new">
                  <Button size="sm">Open Account</Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {accounts.map((account) => (
                <Link key={account.id} href={`/accounts/${account.id}`}>
                  <AccountCard account={account} />
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
