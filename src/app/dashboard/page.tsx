/**
 * @deprecated Moved to app/(dashboard)/dashboard/page.tsx
 */
'use client';

import { useEffect } from 'react';
import { useAccountStore } from '@/store/accountStore';
import { useUIStore } from '@/store/uiStore';
import { StatisticCard, AccountCard, TransactionRow } from '@/components/molecules';
import { Card, Button, Spinner } from '@/components/atoms';
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
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back! Here's your banking overview.</p>
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
              value={`₹${(totalBalance / 100000).toFixed(1)}L`}
              color="blue"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              trend={{ direction: 'up', percentage: 5 }}
            />
            <StatisticCard
              label="Available Balance"
              value={`₹${(totalAvailable / 100000).toFixed(1)}L`}
              color="green"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatisticCard
              label="Active Accounts"
              value={accounts.length}
              color="blue"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2.25a1 1 0 001-1V9h3.75a1 1 0 001-1V5a1 1 0 011 1v4a1 1 0 001 1H17z" />
                </svg>
              }
            />
            <StatisticCard
              label="Recent Transactions"
              value={transactions.length}
              color="yellow"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              }
            />
          </div>

          {/* Accounts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Accounts List */}
            <div className="lg:col-span-1">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Your Accounts</h2>
                <Link href="/accounts/new">
                  <Button size="sm" variant="primary">
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Recent Transactions</h2>
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
                  <div className="text-center py-8">
                    <p className="text-gray-500">No transactions yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
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
              <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Link href="/transfers">
                  <Button fullWidth variant="primary" size="sm" className="h-full flex flex-col items-center justify-center py-4">
                    <svg className="w-6 h-6 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3v-6" />
                    </svg>
                    <span>Transfer</span>
                  </Button>
                </Link>
                <Link href="/beneficiaries">
                  <Button fullWidth variant="secondary" size="sm" className="h-full flex flex-col items-center justify-center py-4">
                    <svg className="w-6 h-6 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 12H9m4 13H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v16a2 2 0 01-2 2z" />
                    </svg>
                    <span>Beneficiaries</span>
                  </Button>
                </Link>
                <Link href="/cards">
                  <Button fullWidth variant="secondary" size="sm" className="h-full flex flex-col items-center justify-center py-4">
                    <svg className="w-6 h-6 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h8m4 0a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span>Cards</span>
                  </Button>
                </Link>
                <Link href="/profile">
                  <Button fullWidth variant="secondary" size="sm" className="h-full flex flex-col items-center justify-center py-4">
                    <svg className="w-6 h-6 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Profile</span>
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
