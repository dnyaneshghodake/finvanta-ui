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
import type {
  CashDepositReceipt,
  DenominationInput,
  DenominationLine,
  FicnAcknowledgement,
  TellerTill,
} from '@/types/teller.types';
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

interface SpringDenominationLine {
  denomination: DenominationLine['denomination'];
  unitCount: number | string;
  counterfeitCount: number | string;
  totalValue: number | string;
}

interface SpringCashDeposit {
  transactionRef: string;
  voucherNumber?: string | null;
  accountNumber: string;
  amount: number | string;
  balanceBefore?: number | string | null;
  balanceAfter?: number | string | null;
  valueDate?: string | null;
  postingDate?: string | null;
  narration?: string | null;
  channel?: string | null;
  pendingApproval: boolean;
  tillBalanceAfter?: number | string | null;
  tillId?: number | string | null;
  tellerUserId?: string | null;
  denominations: SpringDenominationLine[];
  ctrTriggered: boolean;
  ficnTriggered: boolean;
}

interface SpringFicnImpoundLine {
  denomination: DenominationLine['denomination'];
  counterfeitCount: number | string;
  totalFaceValue: number | string;
}

interface SpringFicnAcknowledgement {
  registerRef: string;
  originatingTxnRef: string;
  branchCode: string;
  branchName?: string | null;
  detectionDate: string;
  detectionTimestamp: string;
  detectedByTeller: string;
  depositorName?: string | null;
  depositorIdType?: string | null;
  depositorIdNumber?: string | null;
  depositorMobile?: string | null;
  impoundedDenominations: SpringFicnImpoundLine[];
  totalFaceValue: number | string;
  firRequired: boolean;
  chestDispatchStatus: FicnAcknowledgement['chestDispatchStatus'];
  remarks?: string | null;
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

function mapDenominationLine(d: SpringDenominationLine): DenominationLine {
  return {
    denomination: d.denomination,
    unitCount: toNumber(d.unitCount),
    counterfeitCount: toNumber(d.counterfeitCount),
    totalValue: toNumber(d.totalValue),
  };
}

function mapCashDeposit(d: SpringCashDeposit): CashDepositReceipt {
  return {
    transactionRef: d.transactionRef,
    voucherNumber: d.voucherNumber ?? null,
    accountNumber: d.accountNumber,
    amount: toNumber(d.amount),
    balanceBefore: toNullableNumber(d.balanceBefore),
    balanceAfter: toNullableNumber(d.balanceAfter),
    valueDate: d.valueDate ?? null,
    postingDate: d.postingDate ?? null,
    narration: d.narration ?? null,
    channel: d.channel ?? null,
    pendingApproval: d.pendingApproval,
    tillBalanceAfter: toNullableNumber(d.tillBalanceAfter),
    tillId: d.tillId === null || d.tillId === undefined ? null : Number(d.tillId),
    tellerUserId: d.tellerUserId ?? null,
    denominations: d.denominations.map(mapDenominationLine),
    ctrTriggered: d.ctrTriggered,
    ficnTriggered: d.ficnTriggered,
  };
}

function mapFicn(f: SpringFicnAcknowledgement): FicnAcknowledgement {
  return {
    registerRef: f.registerRef,
    originatingTxnRef: f.originatingTxnRef,
    branchCode: f.branchCode,
    branchName: f.branchName ?? null,
    detectionDate: f.detectionDate,
    detectionTimestamp: f.detectionTimestamp,
    detectedByTeller: f.detectedByTeller,
    depositorName: f.depositorName ?? null,
    depositorIdType: f.depositorIdType ?? null,
    depositorIdNumber: f.depositorIdNumber ?? null,
    depositorMobile: f.depositorMobile ?? null,
    impoundedDenominations: f.impoundedDenominations.map((line) => ({
      denomination: line.denomination,
      counterfeitCount: toNumber(line.counterfeitCount),
      totalFaceValue: toNumber(line.totalFaceValue),
    })),
    totalFaceValue: toNumber(f.totalFaceValue),
    firRequired: f.firRequired,
    chestDispatchStatus: f.chestDispatchStatus,
    remarks: f.remarks ?? null,
  };
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
   * `validateStatus: () => true` keeps non-2xx responses in the
   * success branch so the Spring envelope's flat `errorCode` field
   * (e.g. `CBS-TELLER-001`) is preserved verbatim. Without this the
   * default error interceptor calls `errorHandler.handleApiError`
   * which reads `data?.error?.code` (a NESTED shape that Spring
   * doesn't emit) and falls through to the generic HTTP-status
   * mapping (`HTTP_409` / "This record has been modified by another
   * user…") at `errorHandler.ts:87-92`. The store's check for
   * `CBS-TELLER-001` would never match and the operator would see
   * the wrong error message instead of the open-till form. Mirrors
   * the pattern at `app/login/page.tsx:116` and
   * `authService.ts:84` where Spring error codes need to flow
   * through to the caller. Network failures and 5xx still throw
   * (caught in the catch block) since `apiClient.get` itself can
   * still reject if the request never lands.
   *
   * Role: TELLER, MAKER, CHECKER, ADMIN, AUDITOR
   */
  async getMyTill(): Promise<ApiResponse<TellerTill>> {
    try {
      const response = await apiClient.get<SpringEnvelope<SpringTill>>(
        '/v2/teller/till/me',
        { validateStatus: () => true },
      );
      const correlationId =
        (response.headers?.['x-correlation-id'] as string | undefined) || undefined;
      const body = response.data;
      if (response.status === 200 && body.status === 'SUCCESS' && body.data) {
        return okEnvelope(mapTill(body.data), correlationId);
      }
      // Spring 409 + CBS-TELLER-001 on /till/me means "no till open
      // today" — surface the code verbatim so the store can route the
      // operator into the open-till form. Anything else (5xx, 401,
      // 403, malformed body) falls through to a generic failure.
      const errorCode = body?.errorCode || 'TILL_NOT_FOUND';
      const errorMessage = body?.message || 'No till open for today';
      return errEnvelope<TellerTill>(
        errorCode,
        errorMessage,
        response.status || 400,
        correlationId,
      );
    } catch (err) {
      return fromAppError<TellerTill>(err, 'TILL_NOT_FOUND', 'No till open for today');
    }
  }

  // ── Cash deposit ──────────────────────────────────────────────────────

  /**
   * Post a customer cash deposit with denomination breakdown.
   *
   * The `idempotencyKey` MUST be minted at the FORM-MOUNT level (per
   * logical action) and reused verbatim on every retry of that action,
   * per the contract's "Idempotency Contract" — a fresh key per service-
   * method call defeats server-side dedup and would let a double-click
   * double-post against physical cash, creating a EOD till variance.
   *
   * Outcome dispatch:
   *   - `kind: 'POSTED'`  — HTTP 200 with `CashDepositReceipt`. Ledger
   *                          and till mutated; `pendingApproval === false`
   *                          on the current engine config.
   *   - `kind: 'FICN'`    — HTTP 422 `CBS-TELLER-008` with a
   *                          `FicnAcknowledgement` customer slip. The
   *                          deposit is REJECTED; counterfeit notes are
   *                          impounded and the FICN register row is
   *                          permanent (REQUIRES_NEW sub-transaction).
   *                          UI MUST render the slip prominently and,
   *                          when `firRequired === true`, show "FIR
   *                          mandatory per RBI (count >= 5)".
   *   - error envelope    — any other 4xx/5xx; surfaced as `success: false`
   *                          via `fromAppError` with the correlation id.
   *
   * Role: TELLER, MAKER, ADMIN
   */
  async cashDeposit(req: {
    accountNumber: string;
    amount: number;
    denominations: DenominationInput[];
    idempotencyKey: string;
    depositorName?: string | null;
    depositorMobile?: string | null;
    panNumber?: string | null;
    narration?: string | null;
    form60Reference?: string | null;
  }): Promise<
    ApiResponse<
      | { kind: 'POSTED'; receipt: CashDepositReceipt }
      | { kind: 'FICN'; slip: FicnAcknowledgement; message: string }
    >
  > {
    if (!req.idempotencyKey || req.idempotencyKey.trim() === '') {
      // Defence-in-depth: should never happen because the form mints
      // the key on mount, but a missing key is a Tier-1 audit defect
      // (would let server-side dedup mint a per-request fallback that
      // does not survive a network retry). Fail closed at the boundary.
      return errEnvelope(
        'IDEMPOTENCY_KEY_MISSING',
        'Cash deposit requires a stable idempotency key minted at form mount.',
        400,
      );
    }
    try {
      const response = await apiClient.post<
        | SpringEnvelope<SpringCashDeposit>
        | SpringEnvelope<SpringFicnAcknowledgement>
      >(
        '/v2/teller/cash-deposit',
        {
          accountNumber: req.accountNumber,
          amount: req.amount,
          denominations: req.denominations,
          idempotencyKey: req.idempotencyKey,
          depositorName: req.depositorName ?? null,
          depositorMobile: req.depositorMobile ?? null,
          panNumber: req.panNumber ?? null,
          narration: req.narration ?? null,
          form60Reference: req.form60Reference ?? null,
        },
        {
          headers: { 'X-Idempotency-Key': req.idempotencyKey },
          // Keep HTTP 422 in the success branch so the FICN slip body
          // survives the default error interceptor. Other 4xx (insufficient
          // funds, account closed, validation, etc.) still throw and
          // flow through `fromAppError` below.
          validateStatus: (s) => s === 200 || s === 422,
        },
      );
      const correlationId =
        (response.headers?.['x-correlation-id'] as string | undefined) || undefined;
      const body = response.data;

      // FICN rejection — HTTP 422 + ERROR envelope + CBS-TELLER-008.
      if (response.status === 422 && body.status === 'ERROR' && body.errorCode === 'CBS-TELLER-008' && body.data) {
        return okEnvelope(
          {
            kind: 'FICN' as const,
            slip: mapFicn(body.data as SpringFicnAcknowledgement),
            message: body.message || 'Counterfeit notes detected and impounded.',
          },
          correlationId,
        );
      }

      // Some other 422 the schema accepted (defensive — shouldn't reach
      // here on the current contract, but if a non-FICN 422 ever sneaks
      // through the union schema it must NOT be treated as POSTED).
      if (response.status === 422) {
        return errEnvelope(
          body.errorCode || 'CASH_DEPOSIT_FAILED',
          body.message || 'Cash deposit could not be processed',
          422,
          correlationId,
        );
      }

      // POSTED success path.
      if (body.status === 'SUCCESS' && body.data) {
        return okEnvelope(
          {
            kind: 'POSTED' as const,
            receipt: mapCashDeposit(body.data as SpringCashDeposit),
          },
          correlationId,
        );
      }

      return errEnvelope(
        body.errorCode || 'CASH_DEPOSIT_FAILED',
        body.message || 'Cash deposit could not be processed',
        400,
        correlationId,
      );
    } catch (err) {
      return fromAppError(err, 'CASH_DEPOSIT_FAILED', 'Cash deposit could not be processed');
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
