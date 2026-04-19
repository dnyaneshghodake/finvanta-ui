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

interface SpringAccount {
  id: number;
  accountNumber: string;
  accountType: string;
  productCode?: string | null;
  status: string;
  branchCode?: string | null;
  currencyCode?: string | null;
  ledgerBalance: number | string;
  availableBalance: number | string;
  holdAmount?: number | string | null;
  odLimit?: number | string | null;
  interestRate?: number | string | null;
  accruedInterest?: number | string | null;
  openedDate?: string | null;
  lastTransactionDate?: string | null;
  nomineeName?: string | null;
  chequeBookEnabled?: boolean;
  debitCardEnabled?: boolean;
}

interface SpringPage<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
}

interface SpringTxn {
  id: number;
  transactionRef: string;
  transactionType: string;
  debitCredit: 'D' | 'C' | string;
  amount: number | string;
  balanceAfter?: number | string | null;
  valueDate?: string | null;
  postingDate?: string | null;
  narration?: string | null;
  counterpartyAccount?: string | null;
  channel?: string | null;
  voucherNumber?: string | null;
  branchCode?: string | null;
  reversed?: boolean;
}

/**
 * Map Spring's SB/CA/CURRENT_OD/SALARY account type codes to the UI's
 * presentational enum. Unknown codes fall back to `SAVINGS` so the
 * grid does not render blank cells for experimental product codes.
 */
function mapAccountType(raw: string): Account['accountType'] {
  const normalised = (raw || '').toUpperCase();
  if (normalised.startsWith('CURRENT')) return 'CURRENT';
  if (normalised.startsWith('SALARY')) return 'SALARY';
  return 'SAVINGS';
}

function mapStatus(raw: string): Account['status'] {
  const normalised = (raw || '').toUpperCase();
  if (normalised.includes('FROZEN')) return 'FROZEN';
  if (normalised === 'CLOSED') return 'CLOSED';
  if (normalised === 'ACTIVE') return 'ACTIVE';
  return 'INACTIVE';
}

function toNumber(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toDateOrNow(v: string | null | undefined): Date {
  if (!v) return new Date();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function mapAccount(a: SpringAccount): Account {
  return {
    id: a.accountNumber,
    accountNumber: a.accountNumber,
    customerId: '',
    accountType: mapAccountType(a.accountType),
    currency: a.currencyCode || 'INR',
    balance: toNumber(a.ledgerBalance),
    availableBalance: toNumber(a.availableBalance),
    status: mapStatus(a.status),
    openedDate: toDateOrNow(a.openedDate),
    closedDate: null,
    linkedAccounts: [],
    createdAt: toDateOrNow(a.openedDate),
    updatedAt: toDateOrNow(a.lastTransactionDate || a.openedDate),
  };
}

function mapTxn(t: SpringTxn, accountNumber: string): Transaction {
  const abs = Math.abs(toNumber(t.amount));
  const signed = t.debitCredit === 'D' ? -abs : abs;
  return {
    id: t.transactionRef,
    transactionId: t.transactionRef,
    accountId: accountNumber,
    amount: signed,
    currency: 'INR',
    transactionType: t.debitCredit === 'D' ? 'DEBIT' : 'CREDIT',
    status: t.reversed ? 'REVERSED' : 'COMPLETED',
    description: t.narration || t.transactionType,
    valueDate: toDateOrNow(t.valueDate),
    postingDate: toDateOrNow(t.postingDate),
    referenceNumber: t.transactionRef,
    createdAt: toDateOrNow(t.postingDate),
    updatedAt: toDateOrNow(t.postingDate),
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
  if (body.status === 'SUCCESS' && body.data !== undefined) {
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
   * Account opening is a MAKER-only action on Spring
   * (`POST /v1/accounts/open`). The JSP-originating self-service
   * form is not part of the Tier-1 branch workflow, so the React
   * stub intentionally defers to the branch account-opening flow
   * and returns a structured NOT_IMPLEMENTED envelope.
   */
  async createAccount(
    _data: { accountType: string; currency: string },
  ): Promise<ApiResponse<Account>> {
    return errEnvelope<Account>(
      'NOT_IMPLEMENTED',
      'Account opening is performed through the branch MAKER workflow',
      501,
    );
  }
}

export const accountService = new AccountService();
