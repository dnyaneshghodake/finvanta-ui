'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAccountStore } from '@/store/accountStore';
import { useUIStore } from '@/store/uiStore';
import { accountService } from '@/services/api/accountService';
import { StatisticCard, TransactionRow } from '@/components/molecules';
import { Card, Button, Spinner, Badge } from '@/components/atoms';
import { formatCurrency, formatAccountNumber, formatDate, formatAccountType } from '@/utils/formatters';
import type { Account } from '@/types/entities';

/**
 * Account details page.
 *
 * CBS operators routinely bookmark account URLs or share them via
 * internal chat. On a direct hit the Zustand store may be empty
 * (accounts haven't been fetched yet), so we fall back to a
 * single-account API call rather than showing "Not Found".
 */
export default function AccountDetailsPage() {
  const params = useParams();
  const accountId = params.id as string;

  const { accounts, transactions, fetchTransactions, isLoading } = useAccountStore();
  const { addToast } = useUIStore();

  // Try the in-memory store first (instant if the list page was visited).
  const storeAccount = accounts.find(acc => acc.id === accountId);

  // Fall back to a direct API fetch when the store is empty (direct
  // navigation, page refresh, shared link).
  const [directAccount, setDirectAccount] = useState<Account | null>(null);
  const [directLoading, setDirectLoading] = useState(false);

  useEffect(() => {
    if (storeAccount || directAccount) return;
    let cancelled = false;
    setDirectLoading(true);
    accountService.getAccount(accountId).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) {
        setDirectAccount(res.data);
        // Seed the store so subsequent navigations are instant.
        useAccountStore.setState((s) => ({
          accounts: s.accounts.some((a) => a.id === res.data!.id)
            ? s.accounts
            : [...s.accounts, res.data!],
        }));
      }
      // On failure, directAccount stays null and directLoading goes
      // false, so the "Account Not Found" fallback renders naturally.
    }).catch(() => {
      // No-op: null directAccount + false directLoading = "Not Found"
    }).finally(() => {
      if (!cancelled) setDirectLoading(false);
    });
    return () => { cancelled = true; };
  }, [accountId, storeAccount, directAccount]);

  const account = storeAccount ?? directAccount;

  useEffect(() => {
    if (account) {
      useAccountStore.setState({ selectedAccount: account });
      fetchTransactions(account.id);
    }
  }, [account, fetchTransactions]);

  if (isLoading || directLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" message="Loading account details..." />
      </div>
    );
  }

  if (!account) {
    return (
      <Card className="text-center py-12">
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-gray-900">Account Not Found</h3>
          <p className="text-gray-600">The account you&apos;re looking for doesn&apos;t exist</p>
          <Link href="/accounts">
            <Button>Back to Accounts</Button>
          </Link>
        </div>
      </Card>
    );
  }

  const statusColors = {
    ACTIVE: 'success',
    INACTIVE: 'warning',
    FROZEN: 'danger',
    CLOSED: 'danger',
  } as const;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{formatAccountType(account.accountType)}</h1>
          <p className="text-gray-600 mt-1">{formatAccountNumber(account.accountNumber)}</p>
        </div>
        <Badge variant={statusColors[account.status as keyof typeof statusColors]} className="text-base px-3 py-1">
          {account.status}
        </Badge>
      </div>

      {/* Account Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatisticCard
          label="Total Balance"
          value={formatCurrency(account.balance, account.currency)}
          color="blue"
        />
        <StatisticCard
          label="Available Balance"
          value={formatCurrency(account.availableBalance, account.currency)}
          color="green"
        />
        <StatisticCard
          label="Account Opened"
          value={formatDate(account.openedDate, 'dd/MM/yyyy')}
          color="yellow"
        />
      </div>

      {/* Account Details Card */}
      <Card className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Account Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-500 uppercase font-medium mb-1">Account Number</p>
            <p className="text-lg font-semibold text-gray-900">{formatAccountNumber(account.accountNumber)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 uppercase font-medium mb-1">Account Type</p>
            <p className="text-lg font-semibold text-gray-900">{formatAccountType(account.accountType)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 uppercase font-medium mb-1">Currency</p>
            <p className="text-lg font-semibold text-gray-900">{account.currency}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 uppercase font-medium mb-1">Account Status</p>
            <p className="text-lg font-semibold text-gray-900">{account.status}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 uppercase font-medium mb-1">Date Opened</p>
            <p className="text-lg font-semibold text-gray-900">{formatDate(account.openedDate, 'dd/MM/yyyy')}</p>
          </div>
          {account.closedDate && (
            <div>
              <p className="text-sm text-gray-500 uppercase font-medium mb-1">Date Closed</p>
              <p className="text-lg font-semibold text-gray-900">{formatDate(account.closedDate, 'dd/MM/yyyy')}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Quick Actions */}
      {account.status === 'ACTIVE' && (
        <Card className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <Link href={`/transfers?fromAccountId=${account.id}`}>
              <Button fullWidth variant="primary">Transfer Money</Button>
            </Link>
            <Link href={`/beneficiaries?accountId=${account.id}`}>
              <Button fullWidth variant="secondary">Add Beneficiary</Button>
            </Link>
            <Link href={`/accounts/${account.id}/statement`}>
              <Button fullWidth variant="secondary">Download Statement</Button>
            </Link>
            <Button fullWidth variant="ghost" onClick={() => {
              addToast({
                type: 'info',
                title: 'Settings',
                message: 'Account settings coming soon',
                duration: 2000,
              });
            }}>
              Settings
            </Button>
          </div>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Recent Transactions</h2>
          <Link href={`/accounts/${account.id}/transactions`}>
            <Button variant="ghost">View All →</Button>
          </Link>
        </div>

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
  );
}
