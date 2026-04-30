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
import { isoDate, isoInstant, numericString, springEnvelope } from './common';

export const accountTransferResponseSchema = z.object({
  transactionRef: z.string().min(1),
  amount: numericString,
  // Spring TransactionEngine emits a full ISO instant; accept LocalDate
  // (`YYYY-MM-DD`) too via a strict union so a successful posting is
  // never rejected with a false CONTRACT_MISMATCH, while still catching
  // genuinely malformed values. Mirrors the maturityDate tightening on
  // bookFdResponseSchema (deposit.ts) — RBI Master Direction on Customer
  // Service: posting timestamp on a transfer receipt drives value-date
  // accrual and dispute resolution; must not be a free-form string.
  postingDate: z.union([isoDate, isoInstant.regex(/^\d{4}-\d{2}-\d{2}T/)]).nullish(),
  /**
   * SHA-256 audit hash prefix — first 12 hex chars per Spring
   * `TransactionResponse#auditHashPrefix`. Pinning the format catches a
   * backend drift that would silently break the Txn360 audit-trail
   * lookup which keys on this prefix.
   */
  auditHashPrefix: z.string().regex(/^[0-9a-f]{12}$/, 'auditHashPrefix must be 12 lowercase hex chars').nullish(),
}).passthrough();

export const accountTransferEnvelopeSchema = springEnvelope(accountTransferResponseSchema);
