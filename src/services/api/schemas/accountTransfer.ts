/**
 * Zod schema for the account-to-account transfer endpoint.
 *
 * Matches Spring `DepositAccountController#transfer` at
 * `POST /v1/accounts/transfer`. The wire shape is the minimal
 * `TransactionResponse` (transactionRef + amount + postingDate +
 * auditHashPrefix) — NOT the 19-field `TxnResponse` returned by the
 * mini-statement endpoints, and NOT the richer `TransferResponse`
 * emitted by `/transfers/*`.
 *
 * Defined separately from `loanTransactionResponseSchema` (which is
 * structurally identical today) so a future change to loan posting
 * payloads does not silently propagate into the account transfer
 * validation path. Per DESIGN_SYSTEM §16b: response interceptor fails
 * closed on schema mismatch — we get a normalised CONTRACT_MISMATCH
 * AppError instead of a forged or drifted payload.
 */
import { z } from 'zod';
import { isoInstant, numericString, springEnvelope } from './common';

export const accountTransferResponseSchema = z.object({
  transactionRef: z.string().min(1),
  amount: numericString,
  // Spring TransactionEngine emits a full ISO instant; lenient so a
  // legacy LocalDate serialisation still passes.
  postingDate: isoInstant.nullish(),
  /** SHA-256 audit hash prefix (first 12 hex chars). */
  auditHashPrefix: z.string().nullish(),
}).passthrough();

export const accountTransferEnvelopeSchema = springEnvelope(accountTransferResponseSchema);
