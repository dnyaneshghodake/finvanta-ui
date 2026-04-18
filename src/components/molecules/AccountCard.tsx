/**
 * AccountCard component for CBS Banking Application
 * @file src/components/molecules/AccountCard.tsx
 */

import React from 'react';
import { Card } from '@/components/atoms/Card';
import { Badge } from '@/components/atoms/Badge';
import { Account } from '@/types/entities';
import { formatCurrency, formatAccountNumber } from '@/utils/formatters';
import clsx from 'clsx';

/**
 * AccountCard component props
 */
export interface AccountCardProps {
  account: Account;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * AccountCard component
 */
const AccountCard: React.FC<AccountCardProps> = ({
  account,
  isSelected = false,
  onClick,
  className,
}) => {
  const statusColors = {
    ACTIVE: 'success',
    INACTIVE: 'warning',
    FROZEN: 'danger',
    CLOSED: 'danger',
  } as const;

  return (
    <Card
      onClick={onClick}
      className={clsx(
        'cursor-pointer transition-all duration-200',
        isSelected && 'ring-2 ring-blue-500 shadow-lg',
        onClick && 'hover:shadow-md',
        className
      )}
    >
      <div className="space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-gray-900">{account.accountType}</h3>
            <p className="text-sm text-gray-500">{formatAccountNumber(account.accountNumber)}</p>
          </div>
          <Badge variant={statusColors[account.status as keyof typeof statusColors]}>
            {account.status}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase font-medium">Balance</p>
            <p className="text-lg font-bold text-gray-900">
              {formatCurrency(account.balance, account.currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-medium">Available</p>
            <p className="text-lg font-bold text-green-600">
              {formatCurrency(account.availableBalance, account.currency)}
            </p>
          </div>
        </div>

        <div className="text-xs text-gray-500 pt-2 border-t border-gray-200">
          Opened: {new Date(account.openedDate).toLocaleDateString('en-IN')}
        </div>
      </div>
    </Card>
  );
};

AccountCard.displayName = 'AccountCard';

export { AccountCard };
