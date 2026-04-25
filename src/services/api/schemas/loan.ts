/**
 * Zod schemas for Loan endpoints (disbursement + repayment).
 *
 * Matches Spring `LoanController` at `/v1/loans/**`. Both disbursement
 * (`/disburse`, `/disburse-tranche`) and repayment (`/repayment`,
 * `/prepayment`) return the same Spring `TransactionResponse` shape —
 * a single schema suffices. Principal / interest components are
 * present for repayment only.
 *
 * Per DESIGN_SYSTEM §16b: the response interceptor fails closed on
 * any schema mismatch — the UI gets a normalised `CONTRACT_MISMATCH`
 * AppError rather than a forged or drifted payload. Audit hash prefix
 * (first 12 hex chars of the TransactionEngine SHA-256) is the
 * tamper-evident reference shown on posted receipts (see §14b
 * `AuditHashChip`).
 */
import { z } from 'zod';
import { isoInstant, numericString, springEnvelope } from './common';

export const loanTransactionResponseSchema = z.object({
  transactionRef: z.string().min(1),
  amount: numericString,
  // Spring TransactionEngine emits a full ISO instant
  // (e.g. 2026-04-23T10:15:30Z) — validate leniently via isoInstant
  // to match the transfer schema (`transfer.ts`) and prevent a false
  // CONTRACT_MISMATCH on a successfully posted loan transaction.
  postingDate: isoInstant.nullish(),
  principalComponent: numericString.nullish(),
  interestComponent: numericString.nullish(),
  /** SHA-256 audit hash prefix (first 12 hex chars). */
  auditHashPrefix: z.string().nullish(),
}).passthrough();

export const loanTransactionEnvelopeSchema = springEnvelope(loanTransactionResponseSchema);
