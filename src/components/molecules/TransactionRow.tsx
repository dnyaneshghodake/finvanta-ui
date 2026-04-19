/**
 * CBS Transaction Row — ledger-style entry display.
 * @file src/components/molecules/TransactionRow.tsx
 *
 * Uses CBS design tokens: cbs-crimson for debit, cbs-olive for
 * credit, cbs-tabular/cbs-amount for right-aligned monospaced
 * amounts, cbs-steel for borders and secondary text.
 */

import React from 'react';
import { Transaction } from '@/types/entities';
import { Badge } from '@/components/atoms/Badge';
import {
  formatCurrency,
  formatTransactionStatus,
  formatCbsTimestamp,
} from '@/utils/formatters';

export interface TransactionRowProps {
  transaction: Transaction;
  onClick?: () => void;
  className?: string;
}

const TransactionRow: React.FC<TransactionRowProps> = ({
  transaction,
  onClick,
  className,
}) => {
  const statusColors = {
    PENDING: 'warning',
    COMPLETED: 'success',
    FAILED: 'danger',
    REVERSED: 'info',
  } as const;

  const isDebit = transaction.transactionType === 'DEBIT' || transaction.amount < 0;

  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between px-3 py-2 border-b border-cbs-steel-100 hover:bg-cbs-navy-50 transition-colors ${onClick ? 'cursor-pointer' : ''} ${className || ''}`}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2.5">
          <div
            className={`h-8 w-8 rounded-sm flex items-center justify-center text-xs font-bold ${
              isDebit
                ? 'bg-cbs-crimson-50 text-cbs-crimson-700'
                : 'bg-cbs-olive-50 text-cbs-olive-700'
            }`}
          >
            {isDebit ? 'Dr' : 'Cr'}
          </div>
          <div>
            <p className="text-sm font-medium text-cbs-ink">{transaction.description}</p>
            <p className="text-xs text-cbs-steel-600 cbs-tabular">
              {formatCbsTimestamp(transaction.postingDate)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 ml-4">
        <div className="text-right">
          <p className={`cbs-amount text-sm font-semibold ${isDebit ? 'cbs-amount-debit' : 'cbs-amount-credit'}`}>
            {isDebit ? '-' : '+'}
            {formatCurrency(Math.abs(transaction.amount), transaction.currency)}
          </p>
          <p className="text-xs text-cbs-steel-500 cbs-tabular">{transaction.referenceNumber}</p>
        </div>
        <Badge variant={statusColors[transaction.status as keyof typeof statusColors]}>
          {formatTransactionStatus(transaction.status)}
        </Badge>
      </div>
    </div>
  );
};

TransactionRow.displayName = 'TransactionRow';

export { TransactionRow };
