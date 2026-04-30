/**
 * FINVANTA CBS Teller client (browser-side).
 *
 * Maps 1:1 to Spring v2 controllers under `/api/v2/teller/**` per
 * docs/TELLER_API_CONTRACT.md. Every call routes through the BFF at
 * `/api/cbs/**` which injects the server-side JWT, tenant, branch,
 * correlation id, and double-submit CSRF header.
 *
 * Per the contract's "Idempotency Contract" section, cash postings
 * MUST carry a stable `idempotencyKey` minted at the FORM-MOUNT level
 * (per logical action), NOT per service-method invocation. Slice 1
 * (till lifecycle) does not move money so it does not require a key;
 * Slice 2 (cash deposit/withdrawal) will.
 *
 * "Never throws" contract per DESIGN_SYSTEM §16b — every method
 * returns `ApiResponse<T>` with `correlationId` preserved on the error
 * envelope so <CorrelationRefBadge /> can render the operator-visible
 * reference.
 *
 * @file src/services/api/tellerService.ts
 */
import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';
import type { TellerTill } from '@/types/teller.types';
import { AppError } from '@/utils/errorHandler';

// ---------------------------------------------------------------------------
// Spring envelope + wire-shape DTOs (numericString → number coercion done by
// the mapper). These mirror the Zod schemas in `schemas/teller.ts`; do NOT
// import the inferred Zod types — the schemas use `numericString` unions and
// component code wants normalised `number`s.
// ---------------------------------------------------------------------------

interface SpringEnvelope<T> {
  status: 'SUCCESS' | 'ERROR';
  data?: T;
  errorCode?: string;
  message?: string;
  timestamp?: string;
}

interface SpringTill {
  id: number | string;
  tellerUserId: string;
  branchCode: string;
  branchName?: string | null;
  businessDate: string;
  status: TellerTill['status'];
  openingBalance: number | string;
  currentBalance: number | string;
  countedBalance?: number | string | null;
  varianceAmount?: number | string | null;
  tillCashLimit?: number | string | null;
  openedAt?: string | null;
  closedAt?: string | null;
  openedBySupervisor?: string | null;
  closedBySupervisor?: string | null;
  remarks?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers — pattern shared with transferService / accountService.
// ---------------------------------------------------------------------------

function toNumber(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toNullableNumber(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  return toNumber(v);
}

function mapTill(t: SpringTill): TellerTill {
  return {
    id: typeof t.id === 'number' ? t.id : Number(t.id),
    tellerUserId: t.tellerUserId,
    branchCode: t.branchCode,
    branchName: t.branchName ?? null,
    businessDate: t.businessDate,
    status: t.status,
    openingBalance: toNumber(t.openingBalance),
    currentBalance: toNumber(t.currentBalance),
    countedBalance: toNullableNumber(t.countedBalance),
    varianceAmount: toNullableNumber(t.varianceAmount),
    tillCashLimit: toNullableNumber(t.tillCashLimit),
    openedAt: t.openedAt ?? null,
    closedAt: t.closedAt ?? null,
    openedBySupervisor: t.openedBySupervisor ?? null,
    closedBySupervisor: t.closedBySupervisor ?? null,
    remarks: t.remarks ?? null,
  };
}

function okEnvelope<T>(data: T, correlationId?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    correlationId,
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

function fromAppError<T>(err: unknown, fallbackCode: string, fallbackMsg: string): ApiResponse<T> {
  if (err instanceof AppError) {
    return errEnvelope<T>(
      err.code || fallbackCode,
      err.message || fallbackMsg,
      err.statusCode,
      err.correlationId,
    );
  }
  return errEnvelope<T>(fallbackCode, err instanceof Error ? err.message : fallbackMsg, 500);
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class TellerService {
  // ── Till lifecycle ────────────────────────────────────────────────────

  /**
   * Open a till for the authenticated teller on the current business
   * date. Returns a till in `PENDING_OPEN` (awaiting supervisor sign-off
   * if dual-control threshold is breached) or directly `OPEN`.
   *
   * Role: TELLER, MAKER, ADMIN
   */
  async openTill(req: {
    openingBalance: number;
    tillCashLimit?: number | null;
    remarks?: string;
  }): Promise<ApiResponse<TellerTill>> {
    try {
      const response = await apiClient.post<SpringEnvelope<SpringTill>>(
        '/v2/teller/till/open',
        {
          openingBalance: req.openingBalance,
          tillCashLimit: req.tillCashLimit ?? null,
          remarks: req.remarks ?? null,
        },
      );
      const correlationId =
        (response.headers?.['x-correlation-id'] as string | undefined) || undefined;
      const body = response.data;
      if (body.status === 'SUCCESS' && body.data) {
        return okEnvelope(mapTill(body.data), correlationId);
      }
      return errEnvelope<TellerTill>(
        body.errorCode || 'TILL_OPEN_FAILED',
        body.message || 'Could not open till',
        400,
        correlationId,
      );
    } catch (err) {
      return fromAppError<TellerTill>(err, 'TILL_OPEN_FAILED', 'Could not open till');
    }
  }

  /**
   * Fetch the authenticated teller's till for today. 409
   * `CBS-TELLER-001` when no till is open — caller should drive the
   * operator into the open-till form.
   *
   * Role: TELLER, MAKER, CHECKER, ADMIN, AUDITOR
   */
  async getMyTill(): Promise<ApiResponse<TellerTill>> {
    try {
      const response = await apiClient.get<SpringEnvelope<SpringTill>>(
        '/v2/teller/till/me',
      );
      const correlationId =
        (response.headers?.['x-correlation-id'] as string | undefined) || undefined;
      const body = response.data;
      if (body.status === 'SUCCESS' && body.data) {
        return okEnvelope(mapTill(body.data), correlationId);
      }
      return errEnvelope<TellerTill>(
        body.errorCode || 'TILL_NOT_FOUND',
        body.message || 'No till open for today',
        body.errorCode === 'CBS-TELLER-001' ? 409 : 400,
        correlationId,
      );
    } catch (err) {
      return fromAppError<TellerTill>(err, 'TILL_NOT_FOUND', 'No till open for today');
    }
  }

  /**
   * Teller requests close with physical cash count. Transitions the
   * till to `PENDING_CLOSE` with computed `varianceAmount`. Requires
   * supervisor approval to terminate at `CLOSED`.
   *
   * Role: TELLER, MAKER, ADMIN
   */
  async requestClose(req: {
    countedBalance: number;
    remarks?: string;
  }): Promise<ApiResponse<TellerTill>> {
    try {
      // Spring controller takes these as @RequestParam, so they go on
      // the query string and the body is empty.
      const response = await apiClient.post<SpringEnvelope<SpringTill>>(
        '/v2/teller/till/close',
        null,
        {
          params: {
            countedBalance: req.countedBalance,
            ...(req.remarks ? { remarks: req.remarks } : {}),
          },
        },
      );
      const correlationId =
        (response.headers?.['x-correlation-id'] as string | undefined) || undefined;
      const body = response.data;
      if (body.status === 'SUCCESS' && body.data) {
        return okEnvelope(mapTill(body.data), correlationId);
      }
      return errEnvelope<TellerTill>(
        body.errorCode || 'TILL_CLOSE_FAILED',
        body.message || 'Could not request close',
        400,
        correlationId,
      );
    } catch (err) {
      return fromAppError<TellerTill>(err, 'TILL_CLOSE_FAILED', 'Could not request close');
    }
  }
}

export const tellerService = new TellerService();
