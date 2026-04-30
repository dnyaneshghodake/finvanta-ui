/**
 * Teller module entity types.
 * @file src/types/teller.types.ts
 *
 * Mirrors the Spring v2 contracts under `/api/v2/teller/**` per
 * docs/TELLER_API_CONTRACT.md and the Zod schemas in
 * `src/services/api/schemas/teller.ts`. UI components must consume
 * these types — never import a Zod inferred type into a component
 * (the schema is wire-shape with `numericString` unions; this file
 * is the UI-shape with normalised `number`s).
 */

/** RBI-issued Indian currency denominations. */
export type IndianCurrencyDenomination =
  | 'NOTE_2000'
  | 'NOTE_500'
  | 'NOTE_200'
  | 'NOTE_100'
  | 'NOTE_50'
  | 'NOTE_20'
  | 'NOTE_10'
  | 'NOTE_5'
  | 'COIN_BUCKET';

export type TillStatus =
  | 'PENDING_OPEN'
  | 'OPEN'
  | 'PENDING_CLOSE'
  | 'CLOSED'
  | 'SUSPENDED';

export type VaultStatus = 'OPEN' | 'CLOSED';

export type MovementType = 'BUY' | 'SELL';

export type MovementStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type ChestDispatchStatus = 'PENDING' | 'DISPATCHED' | 'REMITTED';

/**
 * Request-side denomination line — matches `denominationInputSchema`.
 * Server computes the rupee `totalValue` from the enum + `unitCount`;
 * the request MUST NOT carry it (anti-tampering, see contract §B3).
 */
export interface DenominationInput {
  denomination: IndianCurrencyDenomination;
  unitCount: number;
  counterfeitCount: number;
}

/**
 * Response-side denomination line — adds server-computed `totalValue`.
 * Never echo this back as a request.
 */
export interface DenominationLine {
  denomination: IndianCurrencyDenomination;
  unitCount: number;
  counterfeitCount: number;
  totalValue: number;
}

/**
 * `TellerTillResponse` — the shape every /till/** endpoint emits.
 * `countedBalance`/`varianceAmount` populated only after close request.
 * `openedBySupervisor`/`closedBySupervisor` populated only when dual-
 * control sign-off was required (above auto-approve threshold).
 */
export interface TellerTill {
  id: number;
  tellerUserId: string;
  branchCode: string;
  branchName: string | null;
  /** YYYY-MM-DD */
  businessDate: string;
  status: TillStatus;
  openingBalance: number;
  currentBalance: number;
  countedBalance: number | null;
  varianceAmount: number | null;
  tillCashLimit: number | null;
  /** ISO instant or LocalDateTime string (Spring may emit either). */
  openedAt: string | null;
  closedAt: string | null;
  openedBySupervisor: string | null;
  closedBySupervisor: string | null;
  remarks: string | null;
}

/** Branch vault position (DTO — not the JPA entity). */
export interface VaultPosition {
  id: number;
  branchCode: string;
  branchName: string | null;
  businessDate: string;
  status: VaultStatus;
  openingBalance: number;
  currentBalance: number;
  countedBalance: number | null;
  varianceAmount: number | null;
  openedBy: string | null;
  closedBy: string | null;
  remarks: string | null;
}

/** Vault buy / sell movement (till⇄vault). */
export interface TellerCashMovement {
  id: number;
  movementRef: string;
  movementType: MovementType;
  branchCode: string;
  tillId: number | null;
  vaultId: number | null;
  businessDate: string;
  amount: number;
  status: MovementStatus;
  requestedBy: string;
  requestedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  remarks: string | null;
}

/**
 * Cash deposit / withdrawal posted receipt.
 *
 * `pendingApproval` is structurally always `false` on the current
 * engine config (see contract §"Maker-checker model"); kept on the
 * type as forward-compatible scaffolding. UI MUST gate receipt
 * rendering on `pendingApproval === false`.
 */
export interface CashPostingReceipt {
  transactionRef: string;
  voucherNumber: string | null;
  accountNumber: string;
  amount: number;
  balanceBefore: number | null;
  balanceAfter: number | null;
  valueDate: string | null;
  postingDate: string | null;
  narration: string | null;
  channel: string | null;
  pendingApproval: boolean;
  tillBalanceAfter: number | null;
  tillId: number | null;
  tellerUserId: string | null;
  denominations: DenominationLine[];
  ctrTriggered: boolean;
}

/** Cash deposit response — adds counterfeit-detection flag. */
export interface CashDepositReceipt extends CashPostingReceipt {
  ficnTriggered: boolean;
}

/** Cash withdrawal response — adds optional cheque number. */
export interface CashWithdrawalReceipt extends CashPostingReceipt {
  chequeNumber: string | null;
}

/**
 * Counterfeit impound line — the FICN slip lists the COUNTERFEIT
 * subset only. `unitCount` from the request is NOT carried here
 * (the customer is told only what was impounded).
 */
export interface FicnImpoundLine {
  denomination: IndianCurrencyDenomination;
  counterfeitCount: number;
  totalFaceValue: number;
}

/**
 * FICN customer-slip body returned with HTTP 422 `CBS-TELLER-008`.
 * `registerRef` is a permanent reference (FICN/{branch}/{YYYYMMDD}/{seq})
 * backed by a row committed in a REQUIRES_NEW sub-transaction so the
 * slip survives the FICN-rejection rollback. `firRequired: true`
 * when total counterfeit count across denominations ≥ 5 (RBI threshold).
 */
export interface FicnAcknowledgement {
  registerRef: string;
  originatingTxnRef: string;
  branchCode: string;
  branchName: string | null;
  detectionDate: string;
  detectionTimestamp: string;
  detectedByTeller: string;
  depositorName: string | null;
  depositorIdType: string | null;
  depositorIdNumber: string | null;
  depositorMobile: string | null;
  impoundedDenominations: FicnImpoundLine[];
  totalFaceValue: number;
  firRequired: boolean;
  chestDispatchStatus: ChestDispatchStatus;
  remarks: string | null;
}
