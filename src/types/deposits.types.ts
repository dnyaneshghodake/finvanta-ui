/**
 * CASA (Current Account / Savings Account) domain types.
 * @file src/types/deposits.types.ts
 *
 * Split from entities.ts per CBS domain-bounded module pattern.
 * Contains Account and Transaction entities for the deposits module.
 */

/**
 * Account type — per API_REFERENCE.md §4, Spring supports:
 *   SAVINGS, CURRENT, CURRENT_OD, SAVINGS_NRI, SAVINGS_MINOR,
 *   SAVINGS_JOINT, SAVINGS_PMJDY, SALARY
 */
export type AccountType =
  | 'SAVINGS'
  | 'CURRENT'
  | 'CURRENT_OD'
  | 'SAVINGS_NRI'
  | 'SAVINGS_MINOR'
  | 'SAVINGS_JOINT'
  | 'SAVINGS_PMJDY'
  | 'SALARY';

/**
 * Account status — per API_REFERENCE.md §18 Account Status Lifecycle:
 *   PENDING_ACTIVATION → ACTIVE → DORMANT → INOPERATIVE
 *   ACTIVE → FROZEN → ACTIVE (unfreeze)
 *   ACTIVE → CLOSED / DECEASED
 */
export type AccountStatus =
  | 'PENDING_ACTIVATION'
  | 'ACTIVE'
  | 'DORMANT'
  | 'INOPERATIVE'
  | 'FROZEN'
  | 'CLOSED'
  | 'DECEASED'
  | 'INACTIVE';

/**
 * Freeze type — per API_REFERENCE.md §4 Freeze Request.
 */
export type FreezeType = 'DEBIT_FREEZE' | 'CREDIT_FREEZE' | 'TOTAL_FREEZE';

/**
 * Bank account entity — CBS AccountResponse (32 fields) per
 * API_REFERENCE.md §4 CASA Account Lifecycle.
 */
export interface Account {
  id: string;
  accountNumber: string;
  customerId: string;
  customerNumber?: string;
  customerName?: string;
  accountType: AccountType;
  productCode?: string;
  currency: string;
  // ── Balances (per API §4 Response — Balances) ──
  balance: number;
  availableBalance: number;
  holdAmount: number;
  unclearedAmount: number;
  odLimit: number;
  effectiveAvailable: number;
  minimumBalance: number;
  // ── Interest ──
  interestRate: number;
  accruedInterest: number;
  lastInterestCreditDate?: string;
  // ── Status & Branch ──
  status: AccountStatus;
  branchCode?: string;
  ifscCode?: string;
  // ── Lifecycle ──
  // NOTE: Spring returns ISO-8601 date strings (e.g. "2024-01-15").
  // JSON.parse does NOT auto-hydrate Date objects — these arrive as
  // strings at runtime. Using `string` here matches the actual wire
  // format and prevents silent type mismatches when comparing or
  // rendering dates. Consumers should parse with `new Date()` or
  // `parseISO()` from date-fns when date arithmetic is needed.
  openedDate: string;
  closedDate: string | null;
  closureReason?: string;
  lastTransactionDate?: string;
  // ── Freeze ──
  freezeType?: FreezeType;
  freezeReason?: string;
  // ── Nomination ──
  nomineeName?: string;
  nomineeRelationship?: string;
  jointHolderMode?: string;
  // ── Facilities ──
  chequeBookEnabled: boolean;
  debitCardEnabled: boolean;
  dailyWithdrawalLimit?: number;
  dailyTransferLimit?: number;
  // ── Legacy compat ──
  linkedAccounts: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Transaction entity — CBS TxnResponse (19 fields) per
 * API_REFERENCE.md §5 CASA Financial Operations.
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
  /** Per API §5: debitCredit discriminator from Spring (DR/CR). */
  debitCredit?: 'DR' | 'CR';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
  description: string;
  valueDate: string;
  postingDate: string;
  referenceNumber: string;
  beneficiaryName?: string;
  // ── Amount context (per API §5 Response — Amount) ──
  balanceBefore?: number;
  balanceAfter?: number;
  // ── Details (per API §5 Response — Details) ──
  counterpartyAccount?: string;
  counterpartyName?: string;
  channel?: string;
  chequeNumber?: string;
  // ── Audit (per API §5 Response — Audit) ──
  voucherNumber?: string;
  branchCode?: string;
  reversed?: boolean;
  reversedByRef?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}
