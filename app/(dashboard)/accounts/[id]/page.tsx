'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAccountStore } from '@/store/accountStore';
import { accountService } from '@/services/api/accountService';
import { StatisticCard, TransactionRow } from '@/components/molecules';
import { Button, Spinner } from '@/components/atoms';
import { StatusRibbon, KeyValue } from '@/components/cbs/feedback';
import { Breadcrumb, CbsTabs, CbsTabPanel, CbsFormSkeleton } from '@/components/cbs';
import { AuditTrailViewer } from '@/components/cbs/AuditTrailViewer';
import { formatCurrency, formatAccountNumber, formatDate, formatAccountType, formatCbsDate } from '@/utils/formatters';
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

  // Reset direct-fetch state when the route param changes so a
  // client-side navigation from /accounts/A → /accounts/B does not
  // keep showing A's data. Without this, the stale `directAccount`
  // short-circuits the fetch and the operator sees the wrong account.
  useEffect(() => {
    setDirectAccount(null);
    setDirectLoading(false);
  }, [accountId]);

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

  const [activeTab, setActiveTab] = useState('overview');

  // Skeleton loading — matches target layout shape, no layout shift
  if (isLoading || directLoading) {
    return (
      <div className="space-y-4">
        <Breadcrumb items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Accounts', href: '/accounts' },
          { label: '...' },
        ]} />
        <CbsFormSkeleton fields={6} />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="space-y-4">
        <Breadcrumb items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Accounts', href: '/accounts' },
        ]} />
        <div className="cbs-surface text-center py-10">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-cbs-ink">Account Not Found</h3>
            <p className="text-xs text-cbs-steel-600">The account you&apos;re looking for doesn&apos;t exist.</p>
            <Link href="/accounts">
              <Button size="sm">Back to Accounts</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'transactions', label: 'Transactions', count: transactions.length },
    { id: 'details', label: 'Account Details' },
    { id: 'audit', label: 'Audit Trail' },
  ];

  return (
    <div className="space-y-4">
      {/* Breadcrumb — mandatory CBS navigation trail */}
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Accounts', href: '/accounts' },
        { label: formatAccountNumber(account.accountNumber) },
      ]} />

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-cbs-ink">{formatAccountType(account.accountType)}</h1>
          <p className="text-xs text-cbs-steel-600 cbs-tabular mt-0.5">{formatAccountNumber(account.accountNumber)}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusRibbon status={account.status} />
          {account.status === 'ACTIVE' && (
            <Link href={`/transfers?fromAccountId=${account.id}`}>
              <Button size="sm" variant="primary">Transfer</Button>
            </Link>
          )}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatisticCard
          label="Total Balance"
          value={formatCurrency(account.balance, account.currency)}
          color="navy"
        />
        <StatisticCard
          label="Available Balance"
          value={formatCurrency(account.availableBalance, account.currency)}
          color="olive"
        />
        <StatisticCard
          label="Account Opened"
          value={formatCbsDate(account.openedDate)}
          color="gold"
        />
      </div>

      {/* Tab bar — CBS detail screen convention */}
      <CbsTabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* ── Overview tab ── */}
      <CbsTabPanel id="overview" activeTab={activeTab} className="space-y-4">
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

        {/* Recent Transactions (first 5) */}
        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Recent Transactions</span>
            <button type="button" className="cbs-btn cbs-btn-secondary h-[26px] px-2 text-xs" onClick={() => setActiveTab('transactions')}>
              View All →
            </button>
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
      </CbsTabPanel>

      {/* ── Transactions tab ── */}
      <CbsTabPanel id="transactions" activeTab={activeTab}>
        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">All Transactions</span>
            <span className="text-xs cbs-tabular text-cbs-steel-600">{transactions.length} entries</span>
          </div>
          <div>
            {transactions.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-cbs-steel-500">No transactions yet</p>
              </div>
            ) : (
              <div className="divide-y divide-cbs-steel-100">
                {transactions.map((transaction) => (
                  <TransactionRow key={transaction.id} transaction={transaction} />
                ))}
              </div>
            )}
          </div>
        </section>
      </CbsTabPanel>

      {/* ── Account Details tab ── */}
      <CbsTabPanel id="details" activeTab={activeTab}>
        {/* Core Identification */}
        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Account Identification</span>
          </div>
          <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-3 gap-4">
            <KeyValue label="Account Number">
              <span className="cbs-tabular">{formatAccountNumber(account.accountNumber)}</span>
            </KeyValue>
            <KeyValue label="Account Type">{formatAccountType(account.accountType)}</KeyValue>
            {account.productCode && (
              <KeyValue label="Product Code">
                <span className="cbs-tabular">{account.productCode}</span>
              </KeyValue>
            )}
            <KeyValue label="Currency">{account.currency}</KeyValue>
            <KeyValue label="Status">{account.status}</KeyValue>
            {account.branchCode && (
              <KeyValue label="Branch (SOL)">
                <span className="cbs-tabular">{account.branchCode}</span>
              </KeyValue>
            )}
            {account.ifscCode && (
              <KeyValue label="IFSC Code">
                <span className="cbs-tabular">{account.ifscCode}</span>
              </KeyValue>
            )}
            {account.customerId && (
              <KeyValue label="Customer ID (CIF)">
                <span className="cbs-tabular">{account.customerId}</span>
              </KeyValue>
            )}
          </div>
        </section>

        {/* Balances & Limits */}
        <section className="cbs-surface mt-4">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Balances &amp; Limits</span>
          </div>
          <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-3 gap-4">
            <KeyValue label="Ledger Balance">
              <span className="cbs-amount">{formatCurrency(account.balance, account.currency)}</span>
            </KeyValue>
            <KeyValue label="Available Balance">
              <span className="cbs-amount">{formatCurrency(account.availableBalance, account.currency)}</span>
            </KeyValue>
            <KeyValue label="Hold / Lien Amount">
              <span className={`cbs-amount ${account.holdAmount > 0 ? 'cbs-amount-debit' : ''}`}>
                {formatCurrency(account.holdAmount, account.currency)}
              </span>
            </KeyValue>
            {account.odLimit > 0 && (
              <KeyValue label="OD Limit">
                <span className="cbs-amount">{formatCurrency(account.odLimit, account.currency)}</span>
              </KeyValue>
            )}
            <KeyValue label="Interest Rate">
              <span className="cbs-tabular">{account.interestRate.toFixed(2)}% p.a.</span>
            </KeyValue>
            <KeyValue label="Accrued Interest">
              <span className="cbs-amount">{formatCurrency(account.accruedInterest, account.currency)}</span>
            </KeyValue>
          </div>
        </section>

        {/* Dates & Facilities */}
        <section className="cbs-surface mt-4">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Dates &amp; Facilities</span>
          </div>
          <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-3 gap-4">
            <KeyValue label="Date Opened">
              <span className="cbs-tabular">{formatCbsDate(account.openedDate)}</span>
            </KeyValue>
            {account.closedDate && (
              <KeyValue label="Date Closed">
                <span className="cbs-tabular">{formatCbsDate(account.closedDate)}</span>
              </KeyValue>
            )}
            {account.lastTransactionDate && (
              <KeyValue label="Last Transaction">
                <span className="cbs-tabular">{formatCbsDate(account.lastTransactionDate)}</span>
              </KeyValue>
            )}
            <KeyValue label="Cheque Book">
              <span className={account.chequeBookEnabled ? 'text-cbs-olive-700' : 'text-cbs-steel-500'}>
                {account.chequeBookEnabled ? 'Issued' : 'Not issued'}
              </span>
            </KeyValue>
            <KeyValue label="Debit Card">
              <span className={account.debitCardEnabled ? 'text-cbs-olive-700' : 'text-cbs-steel-500'}>
                {account.debitCardEnabled ? 'Linked' : 'Not linked'}
              </span>
            </KeyValue>
            <KeyValue label="Nominee">
              <span>{account.nomineeName || 'Not registered'}</span>
            </KeyValue>
          </div>
        </section>
      </CbsTabPanel>

      {/* ── Audit Trail tab (RBI IT Governance 2023 §8.5) ── */}
      <CbsTabPanel id="audit" activeTab={activeTab}>
        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
              Audit Trail — {formatAccountNumber(account.accountNumber)}
            </span>
          </div>
          <div className="cbs-surface-body">
            <AuditTrailViewer
              entityType="ACCOUNT"
              entityId={account.accountNumber}
            />
          </div>
        </section>
      </CbsTabPanel>
    </div>
  );
}
