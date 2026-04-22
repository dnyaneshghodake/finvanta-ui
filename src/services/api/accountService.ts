/**
 * FINVANTA CBS - Deposit Account client (browser-side).
 *
 * Maps 1:1 to Spring `DepositAccountController` at `/v1/accounts/**`.
 * Every call routes through the BFF at `/api/cbs/**` which injects the
 * server-side JWT, tenant, branch, correlation id and double-submit
 * CSRF header (see src/lib/server/proxy.ts).
 *
 * Spring envelope is `{ status: "SUCCESS" | "ERROR", data, errorCode,
 * message, timestamp }`. This client normalises it to the UI's
 * `ApiResponse<T>` (`{ success, data, error, timestamp, requestId }`)
 * so the existing Zustand stores and presentation components keep
 * working without change. The canonical CBS key is `accountNumber`
 * (alphanumeric, e.g. `SB-HQ001-000001`); this client uses it
 * everywhere and mirrors it as `Account.id` for backward
 * compatibility with routing code that still expects a string id.
 *
 * All financial postings (deposit / withdraw / transfer) carry a
 * stable `X-Idempotency-Key` so a network-level retry cannot double-
 * post through `TransactionEngine.execute()`.
 *
 * @file src/services/api/accountService.ts
 */
import { apiClient } from './apiClient';
import type {
  ApiResponse,
  PaginatedResponse,
  PaginationParams,
  TransferRequest as UiTransferRequest,
} from '@/types/api';
import type { Account, Beneficiary, Transaction } from '@/types/entities';

interface SpringEnvelope<T> {
  status: 'SUCCESS' | 'ERROR';
  data?: T;
  errorCode?: string;
  message?: string;
  timestamp?: string;
}

/**
 * Spring AccountResponse — 32 fields per API_REFERENCE.md §4.
 */
interface SpringAccount {
  id: number;
  accountNumber: string;
  accountType: string;
  productCode?: string | null;
  status: string;
  customerId?: number | string | null;
  customerNumber?: string | null;
  customerName?: string | null;
  branchCode?: string | null;
  ifscCode?: string | null;
  currencyCode?: string | null;
  // Balances
  ledgerBalance: number | string;
  availableBalance: number | string;
  holdAmount?: number | string | null;
  unclearedAmount?: number | string | null;
  odLimit?: number | string | null;
  effectiveAvailable?: number | string | null;
  minimumBalance?: number | string | null;
  // Interest
  interestRate?: number | string | null;
  accruedInterest?: number | string | null;
  lastInterestCreditDate?: string | null;
  // Lifecycle
  openedDate?: string | null;
  closedDate?: string | null;
  closureReason?: string | null;
  lastTransactionDate?: string | null;
  // Freeze
  freezeType?: string | null;
  freezeReason?: string | null;
  // Nomination
  nomineeName?: string | null;
  nomineeRelationship?: string | null;
  jointHolderMode?: string | null;
  // Facilities
  chequeBookEnabled?: boolean;
  debitCardEnabled?: boolean;
  dailyWithdrawalLimit?: number | string | null;
  dailyTransferLimit?: number | string | null;
}

interface SpringPage<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
}

/**
 * Spring TxnResponse — 19 fields per API_REFERENCE.md §5.
 */
interface SpringTxn {
  id: number;
  transactionRef: string;
  transactionType: string;
  /** Per API §5: "DR"/"CR". Legacy deployments may use "D"/"C". */
  debitCredit: 'DR' | 'CR' | 'D' | 'C' | string;
  // Amount
  amount: number | string;
  balanceBefore?: number | string | null;
  balanceAfter?: number | string | null;
  // Dates
  valueDate?: string | null;
  postingDate?: string | null;
  // Details
  narration?: string | null;
  counterpartyAccount?: string | null;
  counterpartyName?: string | null;
  channel?: string | null;
  chequeNumber?: string | null;
  // Audit
  voucherNumber?: string | null;
  branchCode?: string | null;
  reversed?: boolean;
  reversedByRef?: string | null;
  idempotencyKey?: string | null;
}

/**
 * Map Spring account type codes to the UI's AccountType enum.
 * Per API_REFERENCE.md §4: SAVINGS, CURRENT, CURRENT_OD,
 * SAVINGS_NRI, SAVINGS_MINOR, SAVINGS_JOINT, SAVINGS_PMJDY, SALARY.
 * Unknown codes fall back to `SAVINGS`.
 */
function mapAccountType(raw: string): Account['accountType'] {
  const normalised = (raw || '').toUpperCase();
  if (normalised === 'CURRENT_OD') return 'CURRENT_OD';
  if (normalised === 'CURRENT') return 'CURRENT';
  if (normalised === 'SALARY') return 'SALARY';
  if (normalised === 'SAVINGS_NRI') return 'SAVINGS_NRI';
  if (normalised === 'SAVINGS_MINOR') return 'SAVINGS_MINOR';
  if (normalised === 'SAVINGS_JOINT') return 'SAVINGS_JOINT';
  if (normalised === 'SAVINGS_PMJDY') return 'SAVINGS_PMJDY';
  if (normalised.startsWith('CURRENT')) return 'CURRENT';
  if (normalised.startsWith('SAVINGS')) return 'SAVINGS';
  return 'SAVINGS';
}

/**
 * Map Spring status to UI AccountStatus.
 * Per API_REFERENCE.md §18 Account Status Lifecycle:
 *   PENDING_ACTIVATION → ACTIVE → DORMANT → INOPERATIVE
 *   ACTIVE → FROZEN → ACTIVE (unfreeze)
 *   ACTIVE → CLOSED / DECEASED
 */
function mapStatus(raw: string): Account['status'] {
  const normalised = (raw || '').toUpperCase();
  if (normalised === 'PENDING_ACTIVATION') return 'PENDING_ACTIVATION';
  if (normalised === 'ACTIVE') return 'ACTIVE';
  if (normalised === 'DORMANT') return 'DORMANT';
  if (normalised === 'INOPERATIVE') return 'INOPERATIVE';
  if (normalised.includes('FROZEN') || normalised === 'DEBIT_FROZEN' || normalised === 'CREDIT_FROZEN') return 'FROZEN';
  if (normalised === 'CLOSED') return 'CLOSED';
  if (normalised === 'DECEASED') return 'DECEASED';
  return 'INACTIVE';
}

function toNumber(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Coerce a nullable date string to a guaranteed ISO-8601 string.
 * Spring returns dates as ISO strings (e.g. "2024-01-15T10:30:00Z").
 * When the value is missing or unparseable, falls back to the current
 * timestamp so downstream code always has a valid date string.
 *
 * Returns `string` (not `Date`) to match the wire format and the
 * Account/Transaction type definitions.
 */
function toDateString(v: string | null | undefined): string {
  if (!v) return new Date().toISOString();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : v;
}

function mapAccount(a: SpringAccount): Account {
  return {
    id: a.accountNumber,
    accountNumber: a.accountNumber,
    customerId: a.customerId != null ? String(a.customerId) : '',
    customerNumber: a.customerNumber || undefined,
    customerName: a.customerName || undefined,
    accountType: mapAccountType(a.accountType),
    productCode: a.productCode || undefined,
    currency: a.currencyCode || 'INR',
    // Balances
    balance: toNumber(a.ledgerBalance),
    availableBalance: toNumber(a.availableBalance),
    holdAmount: toNumber(a.holdAmount),
    unclearedAmount: toNumber(a.unclearedAmount),
    odLimit: toNumber(a.odLimit),
    effectiveAvailable: toNumber(a.effectiveAvailable),
    minimumBalance: toNumber(a.minimumBalance),
    // Interest
    interestRate: toNumber(a.interestRate),
    accruedInterest: toNumber(a.accruedInterest),
    lastInterestCreditDate: a.lastInterestCreditDate || undefined,
    // Status & Branch
    status: mapStatus(a.status),
    branchCode: a.branchCode || undefined,
    ifscCode: a.ifscCode || undefined,
    // Lifecycle
    openedDate: toDateString(a.openedDate),
    closedDate: a.closedDate ? toDateString(a.closedDate) : null,
    closureReason: a.closureReason || undefined,
    lastTransactionDate: a.lastTransactionDate ? toDateString(a.lastTransactionDate) : undefined,
    // Freeze
    freezeType: a.freezeType as Account['freezeType'],
    freezeReason: a.freezeReason || undefined,
    // Nomination
    nomineeName: a.nomineeName || undefined,
    nomineeRelationship: a.nomineeRelationship || undefined,
    jointHolderMode: a.jointHolderMode || undefined,
    // Facilities
    chequeBookEnabled: a.chequeBookEnabled ?? false,
    debitCardEnabled: a.debitCardEnabled ?? false,
    dailyWithdrawalLimit: a.dailyWithdrawalLimit != null ? toNumber(a.dailyWithdrawalLimit) : undefined,
    dailyTransferLimit: a.dailyTransferLimit != null ? toNumber(a.dailyTransferLimit) : undefined,
    // Legacy compat
    linkedAccounts: [],
    createdAt: toDateString(a.openedDate),
    updatedAt: toDateString(a.lastTransactionDate || a.openedDate),
  };
}

function mapTxn(t: SpringTxn, accountNumber: string): Transaction {
  const abs = Math.abs(toNumber(t.amount));
  // Per API §5: "DR"/"CR". Legacy deployments may use "D"/"C".
  const isDebit = t.debitCredit === 'DR' || t.debitCredit === 'D';
  const signed = isDebit ? -abs : abs;
  return {
    id: t.transactionRef,
    transactionId: t.transactionRef,
    accountId: accountNumber,
    amount: signed,
    currency: 'INR',
    transactionType: isDebit ? 'DEBIT' : 'CREDIT',
    debitCredit: (t.debitCredit === 'DR' || t.debitCredit === 'D') ? 'DR' : 'CR',
    status: t.reversed ? 'REVERSED' : 'COMPLETED',
    description: t.narration || t.transactionType,
    valueDate: toDateString(t.valueDate),
    postingDate: toDateString(t.postingDate),
    referenceNumber: t.transactionRef,
    // Amount context (per API §5 Response — Amount)
    balanceBefore: t.balanceBefore != null ? toNumber(t.balanceBefore) : undefined,
    balanceAfter: t.balanceAfter != null ? toNumber(t.balanceAfter) : undefined,
    // Details (per API §5 Response — Details)
    counterpartyAccount: t.counterpartyAccount || undefined,
    counterpartyName: t.counterpartyName || undefined,
    channel: t.channel || undefined,
    chequeNumber: t.chequeNumber || undefined,
    // Audit (per API §5 Response — Audit)
    voucherNumber: t.voucherNumber || undefined,
    branchCode: t.branchCode || undefined,
    reversed: t.reversed ?? false,
    reversedByRef: t.reversedByRef || undefined,
    idempotencyKey: t.idempotencyKey || undefined,
    createdAt: toDateString(t.postingDate),
    updatedAt: toDateString(t.postingDate),
  };
}

function okEnvelope<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    requestId: '',
  };
}

function errEnvelope<T>(code: string, message: string, status: number): ApiResponse<T> {
  return {
    success: false,
    error: { code, message, statusCode: status },
    timestamp: new Date().toISOString(),
    requestId: '',
  };
}

/**
 * Normalise a Spring ApiResponse<T> body to a UI ApiResponse<T>.
 * Success flag is derived from Spring's `status` discriminator.
 */
function adapt<TSpring, TUi>(
  body: SpringEnvelope<TSpring>,
  mapper: (d: TSpring) => TUi,
): ApiResponse<TUi> {
  // Use loose inequality (`!= null`) so that both `null` and `undefined`
  // are rejected. Spring can return `"data": null` on empty result sets
  // (e.g. no accounts for a branch), and `null !== undefined` is `true`
  // which would pass the old guard and crash the mapper with a TypeError.
  if (body.status === 'SUCCESS' && body.data != null) {
    return okEnvelope(mapper(body.data));
  }
  return errEnvelope(body.errorCode || 'UNKNOWN', body.message || 'Request failed', 400);
}

class AccountService {
  /**
   * Branch-scoped paginated account list.
   * Backend enforces branch isolation using the authenticated
   * operator's SOL; HO users can cross branches only via an explicit
   * `branchId` query parameter whose authorisation is checked server-
   * side. The UI never supplies branch context itself.
   */
  async getAccounts(
    params?: PaginationParams,
  ): Promise<ApiResponse<PaginatedResponse<Account>>> {
    const page = (params?.page ?? 1) - 1;
    const size = params?.pageSize ?? 20;
    const response = await apiClient.get<SpringEnvelope<SpringPage<SpringAccount>>>(
      '/accounts',
      { params: { page: Math.max(page, 0), size } },
    );
    return adapt(response.data, (d) => {
      const items = d.content.map(mapAccount);
      const totalPages = d.size > 0 ? Math.max(1, Math.ceil(d.totalElements / d.size)) : 1;
      const uiPage = d.page + 1;
      return {
        items,
        total: d.totalElements,
        page: uiPage,
        pageSize: d.size,
        totalPages,
        hasNextPage: uiPage < totalPages,
        hasPreviousPage: uiPage > 1,
      };
    });
  }

  /** Account lookup by CBS account number (alphanumeric key). */
  async getAccount(accountNumber: string): Promise<ApiResponse<Account>> {
    const response = await apiClient.get<SpringEnvelope<SpringAccount>>(
      `/accounts/${encodeURIComponent(accountNumber)}`,
    );
    return adapt(response.data, mapAccount);
  }

  /**
   * Transaction history (mini-statement).
   * Spring exposes `GET /accounts/{n}/mini-statement?count=N`; the UI
   * paginates client-side over the returned slice.
   */
  async getTransactions(
    accountNumber: string,
    params?: PaginationParams,
  ): Promise<ApiResponse<PaginatedResponse<Transaction>>> {
    const requestedSize = params?.pageSize ?? 20;
    const response = await apiClient.get<SpringEnvelope<SpringTxn[]>>(
      `/accounts/${encodeURIComponent(accountNumber)}/mini-statement`,
      { params: { count: Math.min(Math.max(requestedSize, 1), 50) } },
    );
    return adapt(response.data, (d) => {
      const items = d.map((t) => mapTxn(t, accountNumber));
      return {
        items,
        total: items.length,
        page: 1,
        pageSize: items.length,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      };
    });
  }

  /**
   * Internal transfer -- delegates to `transferService` which owns
   * the stable X-Idempotency-Key lifecycle per CBS retry policy.
   * Retained here so the accountStore preserves its existing
   * signature; callers should prefer `transferService.confirm` for
   * new code.
   *
   * A stable idempotency key is minted per call. Callers that need
   * retry-safe semantics (double-click protection) must use
   * `transferService.confirm()` which separates key minting from
   * submission.
   */
  async transfer(
    accountNumber: string,
    data: UiTransferRequest,
  ): Promise<ApiResponse<Transaction>> {
    const idempotencyKey = crypto.randomUUID();
    const response = await apiClient.post<SpringEnvelope<SpringTxn>>(
      '/accounts/transfer',
      {
        fromAccount: accountNumber,
        toAccount: data.toAccountNumber,
        amount: data.amount,
        narration: data.description,
        idempotencyKey,
      },
      {
        headers: { 'X-Idempotency-Key': idempotencyKey },
      },
    );
    return adapt(response.data, (t) => mapTxn(t, accountNumber));
  }

  /**
   * Beneficiary management is not yet migrated from the JSP stack --
   * the CBS payee book endpoints will land in a later vertical slice.
   * Returning an empty success envelope keeps the accounts store
   * happy and the UI render path stable.
   */
  async getBeneficiaries(_params?: PaginationParams): Promise<ApiResponse<PaginatedResponse<Beneficiary>>> {
    return okEnvelope<PaginatedResponse<Beneficiary>>({
      items: [],
      total: 0,
      page: 1,
      pageSize: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  }

  async addBeneficiary(
    _data: Omit<Beneficiary, 'id' | 'customerId' | 'createdAt' | 'updatedAt'>,
  ): Promise<ApiResponse<Beneficiary>> {
    return errEnvelope<Beneficiary>(
      'NOT_IMPLEMENTED',
      'Beneficiary management is migrating in a later release',
      501,
    );
  }

  async removeBeneficiary(_beneficiaryId: string): Promise<ApiResponse<null>> {
    return errEnvelope<null>(
      'NOT_IMPLEMENTED',
      'Beneficiary management is migrating in a later release',
      501,
    );
  }

  /**
   * Open a new deposit account.
   * Per ACCOUNT_OPENING_API_CONTRACT.md:
   * `POST /accounts/open` creates an account in PENDING_ACTIVATION status.
   *
   * Accepts all 29 API fields per the contract. The backend MUST use
   * `@JsonIgnoreProperties(ignoreUnknown = true)` so fields it doesn't
   * yet support are silently ignored. This allows the UI to send the
   * full payload today and the backend to adopt fields incrementally.
   */
  async createAccount(data: {
    // §1 Product Selection
    customerId: number;
    branchId: number;
    accountType: string;
    productCode?: string;
    currencyCode?: string;
    initialDeposit?: number;
    // §3 KYC & Regulatory
    panNumber?: string;
    aadhaarNumber?: string;
    kycStatus?: string;
    pepFlag?: boolean;
    // §4 Personal Details
    fullName?: string;
    dateOfBirth?: string;
    gender?: string;
    fatherSpouseName?: string;
    nationality?: string;
    // §5 Contact Details
    mobileNumber?: string;
    email?: string;
    // §6 Address
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    pinCode?: string;
    // §7 Occupation & Financial Profile
    occupation?: string;
    annualIncome?: string;
    sourceOfFunds?: string;
    // §8 Nominee
    nomineeName?: string;
    nomineeRelationship?: string;
    // §9 FATCA / CRS
    usTaxResident?: boolean;
    // §10 Account Configuration
    chequeBookRequired?: boolean;
    debitCardRequired?: boolean;
    smsAlerts?: boolean;
  }): Promise<ApiResponse<Account>> {
    const response = await apiClient.post<SpringEnvelope<SpringAccount>>(
      '/accounts/open',
      data,
    );
    const result = adapt(response.data, mapAccount);
    // Propagate correlation ID from response headers for error diagnostics
    const corrId = response.headers?.['x-correlation-id'] as string | undefined;
    if (corrId) result.correlationId = corrId;
    return result;
  }

  /**
   * Real-time balance inquiry.
   * Per API_REFERENCE.md §6 endpoint 21: `GET /accounts/{n}/balance`
   * Returns BalanceResponse with effectiveAvailable for UPI/IMPS.
   */
  async getBalance(accountNumber: string): Promise<ApiResponse<{
    accountNumber: string;
    status: string;
    ledgerBalance: number;
    availableBalance: number;
    holdAmount: number;
    unclearedAmount: number;
    odLimit: number;
    effectiveAvailable: number;
  }>> {
    const response = await apiClient.get<SpringEnvelope<{
      accountNumber: string;
      status: string;
      ledgerBalance: number | string;
      availableBalance: number | string;
      holdAmount: number | string;
      unclearedAmount: number | string;
      odLimit: number | string;
      effectiveAvailable: number | string;
    }>>(`/accounts/${encodeURIComponent(accountNumber)}/balance`);
    return adapt(response.data, (d) => ({
      accountNumber: d.accountNumber,
      status: d.status,
      ledgerBalance: toNumber(d.ledgerBalance),
      availableBalance: toNumber(d.availableBalance),
      holdAmount: toNumber(d.holdAmount),
      unclearedAmount: toNumber(d.unclearedAmount),
      odLimit: toNumber(d.odLimit),
      effectiveAvailable: toNumber(d.effectiveAvailable),
    }));
  }

  /**
   * Full statement for date range.
   * Per API_REFERENCE.md §6 endpoint 23:
   *   `GET /accounts/{n}/statement?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD`
   */
  async getStatement(
    accountNumber: string,
    fromDate: string,
    toDate: string,
  ): Promise<ApiResponse<{
    accountNumber: string;
    accountType: string;
    fromDate: string;
    toDate: string;
    ledgerBalance: number;
    availableBalance: number;
    transactionCount: number;
    transactions: Transaction[];
  }>> {
    const response = await apiClient.get<SpringEnvelope<{
      accountNumber: string;
      accountType: string;
      fromDate: string;
      toDate: string;
      ledgerBalance: number | string;
      availableBalance: number | string;
      transactionCount: number;
      transactions: SpringTxn[];
    }>>(`/accounts/${encodeURIComponent(accountNumber)}/statement`, {
      params: { fromDate, toDate },
    });
    return adapt(response.data, (d) => ({
      accountNumber: d.accountNumber,
      accountType: d.accountType,
      fromDate: d.fromDate,
      toDate: d.toDate,
      ledgerBalance: toNumber(d.ledgerBalance),
      availableBalance: toNumber(d.availableBalance),
      transactionCount: d.transactionCount,
      transactions: d.transactions.map((t) => mapTxn(t, accountNumber)),
    }));
  }

  /**
   * All accounts for a customer CIF.
   * Per API_REFERENCE.md §6 endpoint 24:
   *   `GET /accounts/customer/{customerId}`
   */
  async getAccountsByCustomer(
    customerId: string | number,
  ): Promise<ApiResponse<Account[]>> {
    const response = await apiClient.get<SpringEnvelope<SpringAccount[]>>(
      `/accounts/customer/${encodeURIComponent(String(customerId))}`,
    );
    return adapt(response.data, (d) => d.map(mapAccount));
  }
}

export const accountService = new AccountService();
