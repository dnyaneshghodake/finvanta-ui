/**
 * CASA (Current Account / Savings Account) domain types.
 * @file src/types/deposits.types.ts
 *
 * Split from entities.ts per CBS domain-bounded module pattern.
 * Contains Account and Transaction entities for the deposits module.
 */

/**
 * Bank account entity — CBS-mandatory fields per RBI Master Direction
 * on KYC 2016 (as amended) and IT Governance Direction 2023 §8.
 */
export interface Account {
  id: string;
  accountNumber: string;
  customerId: string;
  accountType: 'SAVINGS' | 'CURRENT' | 'SALARY';
  productCode?: string;
  currency: string;
  balance: number;
  availableBalance: number;
  holdAmount: number;
  odLimit: number;
  interestRate: number;
  accruedInterest: number;
  status: 'ACTIVE' | 'INACTIVE' | 'FROZEN' | 'CLOSED';
  branchCode?: string;
  ifscCode?: string;
  nomineeName?: string;
  chequeBookEnabled: boolean;
  debitCardEnabled: boolean;
  openedDate: Date;
  closedDate: Date | null;
  lastTransactionDate?: Date;
  linkedAccounts: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Transaction entity — CBS mini-statement / passbook fields per RBI
 * circular on transparency in bank charges and account statements.
 */
export interface Transaction {
  id: string;
  transactionId: string;
  accountId: string;
  fromAccount?: string;
  toAccount?: string;
  amount: number;
  currency: string;
  transactionType: 'DEBIT' | 'CREDIT' | 'TRANSFER';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
  description: string;
  valueDate: Date;
  postingDate: Date;
  referenceNumber: string;
  beneficiaryName?: string;
  balanceAfter?: number;
  counterpartyAccount?: string;
  channel?: string;
  voucherNumber?: string;
  branchCode?: string;
  createdAt: Date;
  updatedAt: Date;
}
