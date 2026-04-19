/**
 * CBS Account Card — compact CASA summary tile.
 * @file src/components/molecules/AccountCard.tsx
 */

import React from 'react';
import { StatusRibbon } from '@/components/cbs/feedback';
import { Account } from '@/types/entities';
import { formatCurrency, formatAccountNumber, formatCbsDate } from '@/utils/formatters';

export interface AccountCardProps {
  account: Account;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
}

const AccountCard: React.FC<AccountCardProps> = ({
  account,
  isSelected = false,
  onClick,
  className,
}) => {
  return (
    <div
      onClick={onClick}
      className={`cbs-surface transition-colors duration-100 ${onClick ? 'cursor-pointer hover:bg-cbs-navy-50' : ''} ${isSelected ? 'ring-2 ring-cbs-navy-500' : ''} ${className || ''}`}
    >
      <div className="p-3 space-y-2">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-sm font-semibold text-cbs-ink">{account.accountType}</h3>
            <p className="text-xs text-cbs-steel-600 cbs-tabular">{formatAccountNumber(account.accountNumber)}</p>
          </div>
          <StatusRibbon status={account.status} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="cbs-field-label">Balance</p>
            <p className="text-sm font-bold text-cbs-ink cbs-amount">
              {formatCurrency(account.balance, account.currency)}
            </p>
          </div>
          <div>
            <p className="cbs-field-label">Available</p>
            <p className="text-sm font-bold text-cbs-olive-700 cbs-amount">
              {formatCurrency(account.availableBalance, account.currency)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-cbs-steel-500 pt-2 border-t border-cbs-steel-100 cbs-tabular">
          <span>Opened: {formatCbsDate(account.openedDate)}</span>
          <span className="flex items-center gap-2">
            {account.branchCode && (
              <span title="Branch (SOL)">{account.branchCode}</span>
            )}
            {account.holdAmount > 0 && (
              <span className="cbs-ribbon text-cbs-crimson-700 bg-cbs-crimson-50 border-cbs-crimson-600 text-[9px]" title={`Hold: ${formatCurrency(account.holdAmount, account.currency)}`}>HOLD</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

AccountCard.displayName = 'AccountCard';

export { AccountCard };
