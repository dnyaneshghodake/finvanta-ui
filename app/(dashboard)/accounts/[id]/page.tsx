'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAccountStore } from '@/store/accountStore';
import { accountService } from '@/services/api/accountService';
import { StatisticCard, TransactionRow } from '@/components/molecules';
import { Button, Spinner } from '@/components/atoms';
import { StatusRibbon } from '@/components/cbs/feedback';
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
      <div className="cbs-surface text-center py-10">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-cbs-ink">Account Not Found</h3>
          <p className="text-xs text-cbs-steel-600">The account you&apos;re looking for doesn&apos;t exist.</p>
          <Link href="/accounts">
            <Button size="sm">Back to Accounts</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-cbs-ink">{formatAccountType(account.accountType)}</h1>
          <p className="text-xs text-cbs-steel-600 cbs-tabular mt-0.5">{formatAccountNumber(account.accountNumber)}</p>
        </div>
        <StatusRibbon status={account.status} />
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
      <section className="cbs-surface">
        <div className="cbs-surface-header">
          <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Account Details</span>
        </div>
        <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="cbs-field-label">Account Number</p>
            <p className="cbs-field-value cbs-tabular">{formatAccountNumber(account.accountNumber)}</p>
          </div>
          <div>
            <p className="cbs-field-label">Account Type</p>
            <p className="cbs-field-value">{formatAccountType(account.accountType)}</p>
          </div>
          <div>
            <p className="cbs-field-label">Currency</p>
            <p className="cbs-field-value">{account.currency}</p>
          </div>
          <div>
            <p className="cbs-field-label">Status</p>
            <p className="cbs-field-value">{account.status}</p>
          </div>
          <div>
            <p className="cbs-field-label">Date Opened</p>
            <p className="cbs-field-value cbs-tabular">{formatDate(account.openedDate, 'dd/MM/yyyy')}</p>
          </div>
          {account.closedDate && (
            <div>
              <p className="cbs-field-label">Date Closed</p>
              <p className="cbs-field-value cbs-tabular">{formatDate(account.closedDate, 'dd/MM/yyyy')}</p>
            </div>
          )}
        </div>
      </section>

      {/* Quick Actions */}
      {account.status === 'ACTIVE' && (
        <div className="flex flex-wrap gap-2">
          <Link href={`/transfers?fromAccountId=${account.id}`}>
            <Button size="sm" variant="primary">Transfer</Button>
          </Link>
          <Link href={`/beneficiaries?accountId=${account.id}`}>
            <Button size="sm" variant="secondary">Add Beneficiary</Button>
          </Link>
          <Link href={`/accounts/${account.id}/statement`}>
            <Button size="sm" variant="secondary">Statement</Button>
          </Link>
        </div>
      )}

      {/* Recent Transactions */}
      <section className="cbs-surface">
        <div className="cbs-surface-header">
          <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Recent Transactions</span>
          <Link href={`/accounts/${account.id}/transactions`}>
            <Button size="sm" variant="ghost">View All →</Button>
          </Link>
        </div>
        <div>
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
        </div>
      </section>
    </div>
  );
}
