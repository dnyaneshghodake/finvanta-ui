/**
 * FINVANTA CBS Transfers client (browser-side).
 *
 * Maps 1:1 to Spring `DepositAccountController.transfer`
 * (`/api/v1/accounts/transfer`). Every call routes through the BFF
 * at `/api/cbs/**` which injects session JWT, tenant, branch,
 * correlation id, and the double-submit CSRF header.
 *
 * A stable idempotency key is generated once per logical submit and
 * forwarded on retries so a network hiccup never double-posts a
 * financial transaction through `TransactionEngine.execute()`. The
 * key is the caller's responsibility -- the UI mints it on the first
 * "Confirm" click and re-uses the same value for any transient-retry
 * attempts until the transaction succeeds or the user abandons.
 *
 * There is no separate preview endpoint on Spring today; CBS preview
 * semantics are enforced at confirm-time by `TransactionEngine` (10-
 * step validation chain including balance, limits, cutoffs, fees).
 * The UI goes directly from capture to confirm with an idempotency
 * guarantee -- this matches Finacle "post-only" posting semantics.
 */
import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export interface TransferRequest {
  fromAccountNumber: string;
  toAccountNumber: string;
  amount: number;
  narration?: string;
  valueDate?: string;
}

export interface TransferResponse {
  transactionRef: string;
  auditHashPrefix?: string;
  fromAccountNumber: string;
  toAccountNumber: string;
  amount: number;
  status: string;
  postedAt?: string;
  correlationId?: string;
}

interface SpringEnvelope<T> {
  status: 'SUCCESS' | 'ERROR';
  data?: T;
  errorCode?: string;
  message?: string;
  timestamp?: string;
}

interface SpringTxnResponse {
  transactionRef: string;
  amount: number | string;
  postingDate?: string | null;
  counterpartyAccount?: string | null;
}

function freshIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ik-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
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

class TransferService {
  /**
   * Post an internal transfer. POSTs to `/api/v1/accounts/transfer`
   * with a stable X-Idempotency-Key so a retry after a transient
   * network error cannot double-post through `TransactionEngine`.
   * The backend DepositAccountController.TransferRequest contract
   * expects `fromAccount`, `toAccount`, `amount`, `narration`,
   * `idempotencyKey`; the header is authoritative for de-duplication
   * but the body field is retained for legacy compatibility.
   */
  async confirm(
    req: TransferRequest,
    idempotencyKey?: string,
  ): Promise<ApiResponse<TransferResponse>> {
    const key = idempotencyKey || freshIdempotencyKey();
    const response = await apiClient.post<SpringEnvelope<SpringTxnResponse>>(
      '/accounts/transfer',
      {
        fromAccount: req.fromAccountNumber,
        toAccount: req.toAccountNumber,
        amount: req.amount,
        narration: req.narration,
        idempotencyKey: key,
      },
      {
        headers: { 'X-Idempotency-Key': key },
      },
    );
    const body = response.data;
    const correlationId =
      (response.headers?.['x-correlation-id'] as string | undefined) || undefined;
    if (body.status === 'SUCCESS' && body.data) {
      const amount =
        typeof body.data.amount === 'number' ? body.data.amount : Number(body.data.amount);
      return okEnvelope<TransferResponse>({
        transactionRef: body.data.transactionRef,
        fromAccountNumber: req.fromAccountNumber,
        toAccountNumber: req.toAccountNumber,
        amount: Number.isFinite(amount) ? Math.abs(amount) : req.amount,
        status: 'POSTED',
        postedAt: body.data.postingDate || undefined,
        correlationId,
      });
    }
    return errEnvelope<TransferResponse>(
      body.errorCode || 'TRANSFER_FAILED',
      body.message || 'Transfer could not be processed',
      400,
    );
  }

  /** Generate a fresh idempotency key at the point of "Confirm" click. */
  mintKey(): string {
    return freshIdempotencyKey();
  }
}

export const transferService = new TransferService();
