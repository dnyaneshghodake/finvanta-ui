/**
 * FINVANTA CBS — Loan client (browser-side).
 *
 * Maps to Spring `LoanController` at `/v1/loans/**`. Every call routes
 * through the BFF at `/api/cbs/**` which injects session JWT, tenant,
 * branch, correlation id, and the double-submit CSRF header (see
 * src/lib/server/proxy.ts).
 *
 * Disbursement and repayment are financial postings. A stable
 * `X-Idempotency-Key` is minted by the UI at the first "Confirm" click
 * and re-used for any network-level retries so `TransactionEngine.execute()`
 * cannot double-post through a transient failure. Per DESIGN_SYSTEM §16b
 * and RBI IT Governance 2023 §8.2.
 *
 * Mirrors the shape of `transferService` / `depositService` so the UI
 * mint/clear logic stays consistent across every money-moving flow.
 *
 * @file src/services/api/loanService.ts
 */
import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';
import { AppError } from '@/utils/errorHandler';

/* ── Disbursement ──────────────────────────────────────────────── */

export interface DisburseRequest {
  /** CBS loan account number (alphanumeric, e.g. `LN-HQ001-000001`). */
  accountNumber: string;
  /**
   * Tranche amount (INR). When `undefined` or `0`, the full approved
   * amount is disbursed via `/loans/{n}/disburse`. Otherwise the
   * partial tranche endpoint `/loans/{n}/disburse-tranche` is used.
   */
  amount?: number;
  narration?: string;
}

export interface DisburseResponse {
  transactionRef: string;
  accountNumber: string;
  amount: number;
  status: string;
  postedAt?: string;
  correlationId?: string;
  auditHashPrefix?: string;
}

/* ── Repayment ─────────────────────────────────────────────────── */

export type RepaymentType = 'EMI' | 'PREPAYMENT';

export interface RepaymentRequest {
  accountNumber: string;
  amount: number;
  type: RepaymentType;
}

export interface RepaymentResponse {
  transactionRef: string;
  accountNumber: string;
  amount: number;
  principalComponent?: number;
  interestComponent?: number;
  status: string;
  postedAt?: string;
  correlationId?: string;
  auditHashPrefix?: string;
}

/* ── Spring envelope + wire types ──────────────────────────────── */

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
  principalComponent?: number | string | null;
  interestComponent?: number | string | null;
  /** SHA-256 audit hash prefix from TransactionEngine (first 12 hex chars). */
  auditHashPrefix?: string | null;
}

/* ── Utilities ─────────────────────────────────────────────────── */

function freshIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ik-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function toNumber(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function okEnvelope<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    requestId: '',
  };
}

function errEnvelope<T>(
  code: string,
  message: string,
  status: number,
  correlationId?: string,
): ApiResponse<T> {
  return {
    success: false,
    error: { code, message, statusCode: status },
    correlationId,
    timestamp: new Date().toISOString(),
    requestId: '',
  };
}

/**
 * Translate an AppError (produced by the apiClient response interceptor,
 * which wraps every AxiosError) into a uniform errEnvelope so callers
 * never see a thrown error — they get a single `{success:false}` shape
 * with the correlation id preserved for <CorrelationRefBadge />.
 */
function fromAppError<T>(err: unknown, fallbackCode: string, fallbackMsg: string): ApiResponse<T> {
  if (err instanceof AppError) {
    return errEnvelope<T>(err.code || fallbackCode, err.message || fallbackMsg, err.statusCode, err.correlationId);
  }
  return errEnvelope<T>(fallbackCode, err instanceof Error ? err.message : fallbackMsg, 500);
}

/* ── Service ───────────────────────────────────────────────────── */

class LoanService {
  /**
   * Disburse an approved loan. POSTs to `/v1/loans/{n}/disburse` (full)
   * or `/v1/loans/{n}/disburse-tranche` (partial) with a stable
   * X-Idempotency-Key so a retry after a transient network error cannot
   * double-post through `TransactionEngine`.
   *
   * Endpoint selection: if `amount > 0` → tranche endpoint with
   * `{ amount, narration }`; otherwise full disburse endpoint with an
   * empty body.
   */
  async disburse(
    req: DisburseRequest,
    idempotencyKey?: string,
  ): Promise<ApiResponse<DisburseResponse>> {
    const key = idempotencyKey || freshIdempotencyKey();
    const acct = req.accountNumber.trim().toUpperCase();
    const hasAmount = typeof req.amount === 'number' && req.amount > 0;
    const endpoint = hasAmount
      ? `/loans/${encodeURIComponent(acct)}/disburse-tranche`
      : `/loans/${encodeURIComponent(acct)}/disburse`;
    const body = hasAmount
      ? { amount: req.amount, narration: req.narration || undefined, idempotencyKey: key }
      : { idempotencyKey: key };

    try {
      const response = await apiClient.post<SpringEnvelope<SpringTxnResponse>>(
        endpoint,
        body,
        { headers: { 'X-Idempotency-Key': key } },
      );
      const env = response.data;
      const correlationId =
        (response.headers?.['x-correlation-id'] as string | undefined) || undefined;
      if (env.status === 'SUCCESS' && env.data) {
        const amount = toNumber(env.data.amount);
        return okEnvelope<DisburseResponse>({
          transactionRef: env.data.transactionRef,
          accountNumber: acct,
          amount: Number.isFinite(amount) ? Math.abs(amount) : req.amount || 0,
          status: 'POSTED',
          postedAt: env.data.postingDate || undefined,
          correlationId,
          auditHashPrefix: env.data.auditHashPrefix || undefined,
        });
      }
      return errEnvelope<DisburseResponse>(
        env.errorCode || 'DISBURSEMENT_FAILED',
        env.message || 'Loan disbursement could not be processed',
        400,
        correlationId,
      );
    } catch (err) {
      return fromAppError<DisburseResponse>(err, 'DISBURSEMENT_FAILED', 'Loan disbursement could not be processed');
    }
  }

  /**
   * Post a loan repayment (EMI or prepayment). POSTs to
   * `/v1/loans/{n}/repayment` or `/v1/loans/{n}/prepayment` with a
   * stable X-Idempotency-Key. Principal / interest split is computed
   * server-side by the loan engine — the UI never performs that split.
   */
  async repay(
    req: RepaymentRequest,
    idempotencyKey?: string,
  ): Promise<ApiResponse<RepaymentResponse>> {
    const key = idempotencyKey || freshIdempotencyKey();
    const acct = req.accountNumber.trim().toUpperCase();
    const endpoint = req.type === 'PREPAYMENT'
      ? `/loans/${encodeURIComponent(acct)}/prepayment`
      : `/loans/${encodeURIComponent(acct)}/repayment`;

    try {
      const response = await apiClient.post<SpringEnvelope<SpringTxnResponse>>(
        endpoint,
        { amount: req.amount, idempotencyKey: key },
        { headers: { 'X-Idempotency-Key': key } },
      );
      const env = response.data;
      const correlationId =
        (response.headers?.['x-correlation-id'] as string | undefined) || undefined;
      if (env.status === 'SUCCESS' && env.data) {
        const amount = toNumber(env.data.amount);
        return okEnvelope<RepaymentResponse>({
          transactionRef: env.data.transactionRef,
          accountNumber: acct,
          amount: Number.isFinite(amount) ? Math.abs(amount) : req.amount,
          principalComponent:
            env.data.principalComponent != null ? toNumber(env.data.principalComponent) : undefined,
          interestComponent:
            env.data.interestComponent != null ? toNumber(env.data.interestComponent) : undefined,
          status: 'POSTED',
          postedAt: env.data.postingDate || undefined,
          correlationId,
          auditHashPrefix: env.data.auditHashPrefix || undefined,
        });
      }
      return errEnvelope<RepaymentResponse>(
        env.errorCode || 'REPAYMENT_FAILED',
        env.message || 'Loan repayment could not be processed',
        400,
        correlationId,
      );
    } catch (err) {
      return fromAppError<RepaymentResponse>(err, 'REPAYMENT_FAILED', 'Loan repayment could not be processed');
    }
  }

  /** Generate a fresh idempotency key at the point of "Confirm" click. */
  mintKey(): string {
    return freshIdempotencyKey();
  }
}

export const loanService = new LoanService();
