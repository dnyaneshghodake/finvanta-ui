/**
 * FINVANTA CBS Transfers client (browser-side).
 *
 * Maps 1:1 to Spring `DepositAccountController`
 * (`/api/v1/accounts/transfer`, `/api/v1/accounts/{acct}/deposit`,
 * `/api/v1/accounts/{acct}/withdraw`). Every call routes through the
 * BFF at `/api/cbs/**` which injects session JWT, tenant, branch,
 * correlation id, and the double-submit CSRF header.
 *
 * A stable idempotency key is generated once per logical submit and
 * forwarded on retries so a network hiccup never double-posts a
 * financial transaction. The key is the caller's responsibility.
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

function freshIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ik-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

class TransferService {
  /**
   * Step 1 -- preview. Spring does not have a dedicated preview path
   * today; the BFF performs a server-side dry run by calling the
   * balance endpoint for both legs and echoing fee / charge metadata
   * it already returns on `GET /api/v1/accounts/{acct}`. The UI uses
   * this only to surface an informational summary before confirm;
   * Spring is still the sole authority on whether the posting will
   * succeed.
   */
  async preview(req: TransferRequest): Promise<ApiResponse<TransferResponse & { preview: true }>> {
    const response = await apiClient.post<ApiResponse<TransferResponse & { preview: true }>>(
      '/accounts/transfer/preview',
      req,
    );
    return response.data;
  }

  /**
   * Step 2 -- confirm. POSTs to `/api/v1/accounts/transfer` with a
   * stable X-Idempotency-Key so a retry after a transient network
   * error cannot double-post through the TransactionEngine.
   */
  async confirm(req: TransferRequest, idempotencyKey?: string): Promise<ApiResponse<TransferResponse>> {
    const key = idempotencyKey || freshIdempotencyKey();
    const response = await apiClient.post<ApiResponse<TransferResponse>>(
      '/accounts/transfer',
      req,
      {
        headers: { 'X-Idempotency-Key': key },
      },
    );
    return response.data;
  }

  /** Generate a fresh idempotency key at the point of "confirm" click. */
  mintKey(): string {
    return freshIdempotencyKey();
  }
}

export const transferService = new TransferService();
