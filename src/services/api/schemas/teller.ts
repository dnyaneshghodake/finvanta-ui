/**
 * Zod schemas for the CBS Teller module.
 *
 * Matches Spring v2 controllers under `/api/v2/teller/**` per
 * TELLER_API_CONTRACT.md. The teller channel is cash-counter only
 * (TELLER role, per-txn INR 2L / daily INR 10L); above-limit postings
 * are HARD-REJECTED with `TRANSACTION_LIMIT_EXCEEDED` (HTTP 422) and
 * are NOT routed to maker-checker (the amount-based PENDING_APPROVAL
 * gate applies only to REVERSAL / WRITE_OFF / WRITE_OFF_RECOVERY).
 *
 * Per DESIGN_SYSTEM §16b: response interceptor fails closed on any
 * schema mismatch — the UI gets a normalised CONTRACT_MISMATCH
 * AppError rather than a forged or drifted payload. Cash-counter
 * flows carry the highest operational-risk profile in the bank
 * (physical cash handling, counterfeit exposure, FICN workflow) so
 * these schemas are intentionally stricter than the deposit/loan
 * schemas and reject unknown status / movementType enum values.
 *
 * ========================================================================
 * CONTRACT BLOCKERS — STATUS (all resolved upstream at TELLER_API_CONTRACT.md)
 * ========================================================================
 *
 * B1 (RESOLVED) — Vault endpoint wire format is the DTO
 *      (VaultPositionResponse / TellerCashMovementResponse) per the
 *      "Vault Operations" section of TELLER_API_CONTRACT.md. ArchUnit
 *      rules on the backend enforce DTO-only exposure at build time
 *      (cashDenominationRepository_onlyAccessedFromTellerService and
 *      the entity-import rule on TellerApiController).
 *
 * B2 (RESOLVED) — Idempotency lifecycle is fully specified in the
 *      "Idempotency Contract" section: body-field transport (NOT
 *      header), per `(tenant_id, idempotency_key)` uniqueness scope,
 *      indefinite retention, lock-then-check ordering, byte-for-byte
 *      prior-receipt on retry, plus four other named retry outcomes.
 *      Frontend implementation MUST mint the key per logical action
 *      (page render / form mount) — NOT per service-method call —
 *      to mirror the JSP channel and avoid the F1-React class of
 *      regression seen in PR #15 on accountService.transfer.
 *
 * B3 (DOCUMENTED) — `denominations[]` request and response shapes are
 *      DELIBERATELY asymmetric per the "Denomination row shape" table
 *      in the spec (`totalValue` is server-computed and absent from
 *      requests). Handled by two distinct schemas here:
 *      denominationInputSchema (request) and denominationLineSchema
 *      (response). BFF consumers MUST NOT deduplicate.
 *
 * B4 (RESOLVED) — `pendingApproval: true` is structurally unreachable
 *      on /cash-deposit and /cash-withdrawal under the current engine
 *      configuration (above-limit hard-rejected at Step 6 before the
 *      Step 7 maker-checker gate; CASH_DEPOSIT and CASH_WITHDRAWAL
 *      are not in ALWAYS_REQUIRE_APPROVAL). The field is retained as
 *      forward-compatible defensive scaffolding. When/if it ever flips
 *      to true: voucherNumber will be `null`, balances unchanged,
 *      denominations[] empty — see the "Response field behaviour when
 *      pendingApproval is true" table in the spec for the full
 *      forward-compat contract. UI MUST still gate receipt rendering
 *      on `pendingApproval === false`.
 * ========================================================================
 */
import { z } from 'zod';
import { isoDate, isoInstant, numericString, springEnvelope } from './common';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** RBI-issued Indian currency denominations recognised by the teller UI. */
export const denominationSchema = z.enum([
  'NOTE_2000',
  'NOTE_500',
  'NOTE_200',
  'NOTE_100',
  'NOTE_50',
  'NOTE_20',
  'NOTE_10',
  'NOTE_5',
  'COIN_BUCKET',
]);

export const tillStatusSchema = z.enum([
  'PENDING_OPEN',
  'OPEN',
  'PENDING_CLOSE',
  'CLOSED',
  'SUSPENDED',
]);

export const vaultStatusSchema = z.enum([
  'OPEN',
  'CLOSED',
]);

export const movementTypeSchema = z.enum([
  'BUY',
  'SELL',
]);

export const movementStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
]);

export const chestDispatchStatusSchema = z.enum([
  'PENDING',
  'DISPATCHED',
  'REMITTED',
]);

// ---------------------------------------------------------------------------
// Denomination shapes — B3: request and response shapes diverge
// ---------------------------------------------------------------------------

/** Request-side denomination line (3 fields). */
export const denominationInputSchema = z.object({
  denomination: denominationSchema,
  unitCount: z.number().int().nonnegative(),
  counterfeitCount: z.number().int().nonnegative(),
});

/**
 * Response-side denomination line (adds server-computed `totalValue`).
 *
 * `unitCount` and `counterfeitCount` are REQUIRED on posted lines per
 * TELLER_API_CONTRACT.md §"Denomination row shape". Schemas must not
 * be weaker than the contract — a missing `unitCount` on a POSTED cash
 * deposit is a Tier-1 cash-reconciliation defect (ledger value without
 * a physical count breakdown) and should fail closed at CONTRACT_MISMATCH
 * rather than render as a denomination row with no count.
 */
export const denominationLineSchema = z.object({
  denomination: denominationSchema,
  unitCount: z.number().int().nonnegative(),
  counterfeitCount: z.number().int().nonnegative(),
  totalValue: numericString,
});

/** FICN impound line (no unitCount; only counterfeit is reported). */
export const ficnImpoundLineSchema = z.object({
  denomination: denominationSchema,
  counterfeitCount: z.number().int().nonnegative(),
  totalFaceValue: numericString,
});

// ---------------------------------------------------------------------------
// Till lifecycle
// ---------------------------------------------------------------------------

/**
 * `TellerTillResponse` — shape returned by every /till/** endpoint.
 * `countedBalance` / `varianceAmount` populated only on close request.
 * `openedBySupervisor` / `closedBySupervisor` populated only when
 * dual-control sign-off was required.
 */
export const tellerTillResponseSchema = z.object({
  id: numericString,
  tellerUserId: z.string().min(1),
  branchCode: z.string().min(1),
  branchName: z.string().nullish(),
  businessDate: isoDate,
  status: tillStatusSchema,
  openingBalance: numericString,
  currentBalance: numericString,
  countedBalance: numericString.nullish(),
  varianceAmount: numericString.nullish(),
  tillCashLimit: numericString.nullish(),
  // Spring emits LocalDateTime without zone; accept both naked and
  // zoned forms so a @JsonFormat tweak does not break the UI.
  openedAt: isoInstant.nullish(),
  closedAt: isoInstant.nullish(),
  openedBySupervisor: z.string().nullish(),
  closedBySupervisor: z.string().nullish(),
  remarks: z.string().nullish(),
}).passthrough();

export const tellerTillEnvelopeSchema = springEnvelope(tellerTillResponseSchema);
export const tellerTillListEnvelopeSchema = springEnvelope(
  z.array(tellerTillResponseSchema),
);

// ---------------------------------------------------------------------------
// Vault lifecycle — B1 resolved per TELLER_API_CONTRACT.md §"Vault Operations":
// wire format is the DTO (VaultPositionResponse / TellerCashMovementResponse),
// enforced at build time by ArchUnit rules on the Spring side.
// ---------------------------------------------------------------------------

export const vaultPositionResponseSchema = z.object({
  id: numericString,
  branchCode: z.string().min(1),
  branchName: z.string().nullish(),
  businessDate: isoDate,
  status: vaultStatusSchema,
  openingBalance: numericString,
  currentBalance: numericString,
  countedBalance: numericString.nullish(),
  varianceAmount: numericString.nullish(),
  openedBy: z.string().nullish(),
  closedBy: z.string().nullish(),
  remarks: z.string().nullish(),
}).passthrough();

export const vaultPositionEnvelopeSchema = springEnvelope(vaultPositionResponseSchema);

export const tellerCashMovementResponseSchema = z.object({
  id: numericString,
  movementRef: z.string().min(1),
  movementType: movementTypeSchema,
  branchCode: z.string().min(1),
  tillId: numericString.nullish(),
  vaultId: numericString.nullish(),
  businessDate: isoDate,
  amount: numericString,
  status: movementStatusSchema,
  requestedBy: z.string().min(1),
  requestedAt: isoInstant,
  approvedBy: z.string().nullish(),
  approvedAt: isoInstant.nullish(),
  rejectionReason: z.string().nullish(),
  remarks: z.string().nullish(),
}).passthrough();

export const tellerCashMovementEnvelopeSchema = springEnvelope(
  tellerCashMovementResponseSchema,
);
export const tellerCashMovementListEnvelopeSchema = springEnvelope(
  z.array(tellerCashMovementResponseSchema),
);

// ---------------------------------------------------------------------------
// Cash postings (deposit / withdrawal)
// ---------------------------------------------------------------------------

/**
 * Base fields shared by deposit and withdrawal responses.
 *
 * B4: when `pendingApproval === true` the spec still emits
 * `transactionRef` / `voucherNumber` / `balanceAfter` / `tillBalanceAfter`
 * even though the ledger has NOT been mutated. The UI MUST gate
 * receipt rendering on `pendingApproval === false`; Txn360 lookup
 * semantics for a pending voucherNumber are undefined upstream.
 */
const cashPostingBaseSchema = z.object({
  transactionRef: z.string().min(1),
  voucherNumber: z.string().nullish(),
  accountNumber: z.string().min(1),
  amount: numericString,
  balanceBefore: numericString.nullish(),
  balanceAfter: numericString.nullish(),
  valueDate: isoDate.nullish(),
  postingDate: isoInstant.nullish(),
  narration: z.string().nullish(),
  channel: z.string().nullish(),
  pendingApproval: z.boolean(),
  tillBalanceAfter: numericString.nullish(),
  tillId: numericString.nullish(),
  tellerUserId: z.string().nullish(),
  denominations: z.array(denominationLineSchema),
  ctrTriggered: z.boolean(),
});

export const cashDepositResponseSchema = cashPostingBaseSchema.extend({
  // Always present on deposit responses (counterfeit detection is a
  // deposit-only concern). Withdrawal responses do not carry this.
  ficnTriggered: z.boolean(),
}).passthrough();

export const cashDepositEnvelopeSchema = springEnvelope(cashDepositResponseSchema);

/**
 * Discriminated union for the `/v2/teller/cash-deposit` POST endpoint.
 *
 * On HTTP 200 the response is a SUCCESS envelope wrapping
 * `cashDepositResponseSchema`.
 *
 * On HTTP 422 with `errorCode: "CBS-TELLER-008"` the response is an
 * ERROR envelope wrapping `ficnAcknowledgementResponseSchema` — the
 * customer slip required by RBI Master Direction on Counterfeit Notes.
 *
 * The service-layer caller uses axios `validateStatus` to keep BOTH
 * 200 and 422 in the success branch so the FICN slip body survives the
 * default error interceptor; this union schema is what the response-
 * validator middleware (`apiClient.ts:155-186`) checks against. Any
 * other 4xx (CBS-TELLER-001, CBS-TELLER-004, CBS-COMP-002, etc.) flows
 * through the standard error path and is wrapped as `AppError`.
 */
export const cashDepositOrFicnEnvelopeSchema = z.union([
  cashDepositEnvelopeSchema,
  ficnAcknowledgementEnvelopeSchema,
]);

export const cashWithdrawalResponseSchema = cashPostingBaseSchema.extend({
  chequeNumber: z.string().nullish(),
}).passthrough();

export const cashWithdrawalEnvelopeSchema = springEnvelope(cashWithdrawalResponseSchema);

// ---------------------------------------------------------------------------
// FICN acknowledgement — HTTP 422 `CBS-TELLER-008` response body.
// ---------------------------------------------------------------------------

/**
 * FICN customer slip emitted when counterfeit notes are detected.
 * Per RBI Master Direction on Counterfeit Notes, `registerRef` is a
 * PERMANENT reference (format `FICN/{branch}/{YYYYMMDD}/{seq}`) and
 * the CounterfeitNoteRegister row is committed in a REQUIRES_NEW
 * sub-transaction so the slip is always backed by a real DB row even
 * though the originating deposit rolls back.
 *
 * `firRequired: true` when total counterfeit count across all
 * denominations in the transaction ≥ 5 (RBI threshold).
 */
export const ficnAcknowledgementResponseSchema = z.object({
  registerRef: z.string().regex(
    /^FICN\/[^/]+\/\d{8}\/\d+$/,
    'FICN registerRef must match FICN/{branch}/{YYYYMMDD}/{seq}',
  ),
  originatingTxnRef: z.string().min(1),
  branchCode: z.string().min(1),
  branchName: z.string().nullish(),
  detectionDate: isoDate,
  detectionTimestamp: isoInstant,
  detectedByTeller: z.string().min(1),
  depositorName: z.string().nullish(),
  depositorIdType: z.string().nullish(),
  depositorIdNumber: z.string().nullish(),
  depositorMobile: z.string().nullish(),
  impoundedDenominations: z.array(ficnImpoundLineSchema).min(1),
  totalFaceValue: numericString,
  firRequired: z.boolean(),
  chestDispatchStatus: chestDispatchStatusSchema,
  remarks: z.string().nullish(),
}).passthrough();

export const ficnAcknowledgementEnvelopeSchema = springEnvelope(
  ficnAcknowledgementResponseSchema,
);
