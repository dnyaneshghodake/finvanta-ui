'use client';

import { useEffect } from 'react';
import { useAccountStore } from '@/store/accountStore';
import { useUIStore } from '@/store/uiStore';
import { StatisticCard, AccountCard, TransactionRow } from '@/components/molecules';
import { Card, Button, Spinner } from '@/components/atoms';
import { formatCurrency } from '@/utils/formatters';
import Link from 'next/link';

/**
 * Dashboard page
 */
export default function DashboardPage() {
  const { accounts, transactions, fetchAccounts, fetchTransactions, selectedAccount, isLoading } = useAccountStore();
  const { addToast } = useUIStore();

  useEffect(() => {
    const loadData = async () => {
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

    loadData();
  }, [fetchAccounts, addToast]);

  useEffect(() => {
    if (selectedAccount) {
      fetchTransactions(selectedAccount.id);
    }
  }, [selectedAccount, fetchTransactions]);

  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
  const totalAvailable = accounts.reduce((sum, account) => sum + account.availableBalance, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold text-cbs-ink">Dashboard</h1>
        <p className="text-xs text-cbs-steel-600 mt-0.5">Branch operations overview.</p>
      </div>

      {/* Statistics Grid */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner size="lg" message="Loading your accounts..." />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatisticCard
              label="Total Balance"
              value={formatCurrency(totalBalance)}
              color="blue"
            />
            <StatisticCard
              label="Available Balance"
              value={formatCurrency(totalAvailable)}
              color="green"
            />
            <StatisticCard
              label="Active Accounts"
              value={accounts.length}
              color="blue"
            />
            <StatisticCard
              label="Recent Transactions"
              value={transactions.length}
              color="yellow"
            />
          </div>

          {/* Accounts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Accounts List */}
            <div className="lg:col-span-1">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-cbs-ink uppercase tracking-wider">Your Accounts</h2>
                <Link href="/accounts/new">
                  <Button size="sm" variant="secondary">
                    + New Account
                  </Button>
                </Link>
              </div>

              <div className="space-y-2">
                {accounts.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    isSelected={selectedAccount?.id === account.id}
                    onClick={() => {
                      useAccountStore.setState({ selectedAccount: account });
                      fetchTransactions(account.id);
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Transactions */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-cbs-ink uppercase tracking-wider">Recent Transactions</h2>
                {selectedAccount && (
                  <Link href={`/accounts/${selectedAccount.id}/transactions`}>
                    <Button size="sm" variant="ghost">
                      View All →
                    </Button>
                  </Link>
                )}
              </div>

              <Card>
                {transactions.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-sm text-cbs-steel-500">No transactions yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-cbs-steel-100">
                    {transactions.slice(0, 5).map((transaction) => (
                      <TransactionRow key={transaction.id} transaction={transaction} />
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>

          {/* Quick Actions */}
          <Card>
            <div>
              <h3 className="text-sm font-semibold text-cbs-ink uppercase tracking-wider mb-3">Quick Actions</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Link href="/transfers">
                  <Button fullWidth variant="primary" size="sm">
                    Transfer
                  </Button>
                </Link>
                <Link href="/beneficiaries">
                  <Button fullWidth variant="secondary" size="sm">
                    Beneficiaries
                  </Button>
                </Link>
                <Link href="/accounts">
                  <Button fullWidth variant="secondary" size="sm">
                    Accounts
                  </Button>
                </Link>
                <Link href="/profile">
                  <Button fullWidth variant="secondary" size="sm">
                    Profile
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
