/**
 * Zod schemas for Fixed Deposit endpoints.
 *
 * Matches Spring `FixedDepositController` at `/v1/fixed-deposits/**`.
 * Monetary amounts arrive as `number` OR decimal string (BigDecimal
 * serialisation) so they are validated via `numericString`; the
 * service layer coerces to `number` via its own `toNumber()` helper.
 *
 * Per DESIGN_SYSTEM §16b: the response interceptor fails closed on
 * any schema mismatch — the UI gets a normalised `CONTRACT_MISMATCH`
 * AppError rather than a forged or drifted payload.
 *
 * Fields are kept permissive (`.nullish()`, `.passthrough()`) so
 * additive backend changes don't break the UI, but the core shape
 * (fdAccountNumber, principalAmount, tenureDays, interestRate) is
 * strictly required.
 */
import { z } from 'zod';
import { isoDate, isoInstant, numericString, springEnvelope } from './common';

export const bookFdResponseSchema = z.object({
  fdAccountNumber: z.string().min(1),
  customerId: numericString,
  principalAmount: numericString,
  tenureDays: numericString,
  interestRate: numericString,
  maturityAmount: numericString.nullish(),
  // Spring may serialise maturityDate as a `LocalDate` (`YYYY-MM-DD`)
  // OR as a full `LocalDateTime` instant (`YYYY-MM-DDTHH:mm:ss[Z]`)
  // depending on the @JsonFormat config of the booking response DTO.
  // Accept both shapes via a strict union so a successfully booked FD
  // is never rejected with a false CONTRACT_MISMATCH, while still
  // catching genuinely malformed values (RBI: maturity date drives
  // interest accrual and TDS — must not be a free-form string).
  maturityDate: z.union([isoDate, isoInstant.regex(/^\d{4}-\d{2}-\d{2}T/)]).nullish(),
  status: z.string().nullish(),
}).passthrough();

export const bookFdEnvelopeSchema = springEnvelope(bookFdResponseSchema);
