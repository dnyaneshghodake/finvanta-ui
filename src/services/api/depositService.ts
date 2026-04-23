/**
 * FINVANTA CBS — Fixed Deposit client (browser-side).
 *
 * Maps to Spring `FixedDepositController` at `/v1/fixed-deposits/**`.
 * Every call routes through the BFF at `/api/cbs/**` which injects
 * session JWT, tenant, branch, correlation id, and the double-submit
 * CSRF header (see src/lib/server/proxy.ts).
 *
 * FD booking is a financial posting. A stable `X-Idempotency-Key` is
 * minted by the UI at the first "Confirm" click and re-used for any
 * network-level retries so `TransactionEngine.execute()` cannot
 * double-post through a transient failure. Per DESIGN_SYSTEM §16b
 * and RBI IT Governance 2023 §8.2.
 *
 * Mirrors the shape of `transferService` so the UI mint/clear logic
 * stays consistent across every money-moving flow.
 *
 * @file src/services/api/depositService.ts
 */
import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export interface BookFdRequest {
  customerId: number;
  branchId: number;
  linkedAccountNumber: string;
  principalAmount: number;
  /** Tenure in days. UI captures months and multiplies × 30 — server recalculates. */
  tenureDays: number;
  interestPayoutMode?: 'MATURITY' | 'MONTHLY' | 'QUARTERLY';
  autoRenewalMode?: 'YES' | 'NO';
  nomineeName?: string;
}

export interface BookFdResponse {
  fdAccountNumber: string;
  customerId: number;
  principalAmount: number;
  tenureDays: number;
  interestRate: number;
  maturityAmount?: number;
  maturityDate?: string;
  status: string;
  correlationId?: string;
}

interface SpringEnvelope<T> {
  status: 'SUCCESS' | 'ERROR';
  data?: T;
  errorCode?: string;
  message?: string;
  timestamp?: string;
}

interface SpringFdResponse {
  fdAccountNumber: string;
  customerId: number | string;
  principalAmount: number | string;
  tenureDays: number | string;
  interestRate: number | string;
  maturityAmount?: number | string | null;
  maturityDate?: string | null;
  status?: string;
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

function toNumber(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

class DepositService {
  /**
   * Book a new Fixed Deposit. POSTs to `/v1/fixed-deposits/book` with
   * a stable X-Idempotency-Key so a retry after a transient network
   * error cannot double-post through `TransactionEngine`. On server-
   * side validation rejection (INSUFFICIENT_FUNDS, PRODUCT_INACTIVE,
   * CUSTOMER_NOT_ACTIVE, etc.) the key must be cleared by the caller
   * so the corrected request is evaluated fresh; on network error
   * the caller MUST reuse the same key so the backend idempotency
   * cache can dedupe.
   */
  async bookFd(
    req: BookFdRequest,
    idempotencyKey?: string,
  ): Promise<ApiResponse<BookFdResponse>> {
    const key = idempotencyKey || freshIdempotencyKey();
    const response = await apiClient.post<SpringEnvelope<SpringFdResponse>>(
      '/fixed-deposits/book',
      {
        customerId: req.customerId,
        branchId: req.branchId,
        linkedAccountNumber: req.linkedAccountNumber,
        principalAmount: req.principalAmount,
        interestRate: 0, // Server determines from product + tenure slab
        tenureDays: req.tenureDays,
        interestPayoutMode: req.interestPayoutMode || 'MATURITY',
        autoRenewalMode: req.autoRenewalMode || 'NO',
        nomineeName: req.nomineeName,
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
      return okEnvelope<BookFdResponse>({
        fdAccountNumber: body.data.fdAccountNumber,
        customerId: Number(body.data.customerId),
        principalAmount: toNumber(body.data.principalAmount),
        tenureDays: toNumber(body.data.tenureDays),
        interestRate: toNumber(body.data.interestRate),
        maturityAmount:
          body.data.maturityAmount != null ? toNumber(body.data.maturityAmount) : undefined,
        maturityDate: body.data.maturityDate || undefined,
        status: body.data.status || 'PENDING_APPROVAL',
        correlationId,
      });
    }
    return errEnvelope<BookFdResponse>(
      body.errorCode || 'FD_BOOKING_FAILED',
      body.message || 'FD booking could not be processed',
      400,
    );
  }

  /** Generate a fresh idempotency key at the point of "Confirm" click. */
  mintKey(): string {
    return freshIdempotencyKey();
  }
}

export const depositService = new DepositService();
