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
 * OUTSTANDING CONTRACT BLOCKERS (must be resolved before UI implementation)
 * ========================================================================
 *
 * B1 — Vault endpoint return types contradict themselves in the spec.
 *      Prose: "all endpoints return DTOs (VaultPositionResponse /
 *      TellerCashMovementResponse) via VaultMapper". Endpoint
 *      signatures: `ApiResponse<VaultPosition>` /
 *      `ApiResponse<TellerCashMovement>` (JPA entity names).
 *      We schema the DTO shape per the prose; if the backend actually
 *      emits raw entities this will CONTRACT_MISMATCH until fixed.
 *
 * B2 — Idempotency-key lifecycle is unspecified: TTL, retry semantics,
 *      header-vs-body parity, scope of uniqueness all undocumented.
 *      For cash postings this is stricter than account transfers — a
 *      double-post against physical cash count produces an EOD
 *      variance. Pinned as a schema requirement; runtime lifecycle
 *      must be contracted.
 *
 * B3 — `denominations[]` has different shapes on request (3 fields)
 *      vs response (4 fields, `totalValue` added). Handled by two
 *      distinct schemas below (denominationInput / denominationLine).
 *
 * B4 — `pendingApproval: true` responses still include
 *      `transactionRef`, `voucherNumber`, `balanceAfter`, `tillBalanceAfter`
 *      even though "ledger and till UNCHANGED". Semantics for
 *      /txn360/voucher/{voucherNumber} on a not-yet-posted voucher
 *      are undefined. Schema accepts the shape but the UI MUST gate
 *      receipt rendering on `pendingApproval === false`.
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

/** Response-side denomination line (adds server-computed `totalValue`). */
export const denominationLineSchema = z.object({
  denomination: denominationSchema,
  unitCount: z.number().int().nonnegative().nullish(),
  counterfeitCount: z.number().int().nonnegative().nullish(),
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
// Vault lifecycle — B1: prose says DTOs, signatures say entities.
// We schema the DTO shape per the prose.
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
