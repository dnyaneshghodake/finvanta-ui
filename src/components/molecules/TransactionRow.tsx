/**
 * TransactionRow component for CBS Banking Application
 * @file src/components/molecules/TransactionRow.tsx
 */

import React from 'react';
import { Transaction } from '@/types/entities';
import { Badge } from '@/components/atoms/Badge';
import {
  formatCurrency,
  formatTransactionStatus,
  formatDate,
} from '@/utils/formatters';
import clsx from 'clsx';

/**
 * TransactionRow component props
 */
export interface TransactionRowProps {
  transaction: Transaction;
  onClick?: () => void;
  className?: string;
}

/**
 * TransactionRow component
 */
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
      className={clsx(
        'flex items-center justify-between p-3 border-b border-gray-200 hover:bg-gray-50 transition-colors',
        onClick && 'cursor-pointer',
        className
      )}
    >
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <div
            className={clsx(
              'h-10 w-10 rounded-lg flex items-center justify-center text-sm font-semibold',
              isDebit
                ? 'bg-red-100 text-red-600'
                : 'bg-green-100 text-green-600'
            )}
          >
            {isDebit ? '↓' : '↑'}
          </div>
          <div>
            <p className="font-medium text-gray-900">{transaction.description}</p>
            <p className="text-xs text-gray-500">
              {formatDate(transaction.postingDate, 'dd/MM/yyyy HH:mm')}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 ml-4">
        <div className="text-right">
          <p
            className={clsx(
              'font-semibold',
              isDebit ? 'text-red-600' : 'text-green-600'
            )}
          >
            {isDebit ? '-' : '+'}
            {formatCurrency(Math.abs(transaction.amount), transaction.currency)}
          </p>
          <p className="text-xs text-gray-500">{transaction.referenceNumber}</p>
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
