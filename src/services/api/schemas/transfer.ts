/**
 * Zod schemas for Transfer-related endpoints.
 *
 * Matches Spring `TransferResponse` / `TransferStatusResponse` per
 * docs/API_REFERENCE.md §6. Monetary amounts arrive as strings
 * (BigDecimal) so they are validated via `numericString`.
 *
 * The UI never trusts an unshaped transfer object: a UI that renders
 * an attacker-mutated `referenceNumber` or `toAccount` can be coerced
 * into displaying a bogus success state. The response interceptor
 * should fail closed on any schema mismatch.
 */
import { z } from 'zod';
import { isoInstant, numericString, springEnvelope } from './common';

export const transferChannelSchema = z.enum([
  'INTRA',
  'INTER',
  'NEFT',
  'RTGS',
  'IMPS',
  'UPI',
]);

export const transferStatusSchema = z.enum([
  'PENDING',
  'AUTHORIZED',
  'POSTED',
  'COMPLETED',
  'FAILED',
  'REVERSED',
  'CANCELLED',
]);

export const transferResponseSchema = z.object({
  referenceNumber: z.string().min(1),
  channel: transferChannelSchema,
  status: transferStatusSchema,
  fromAccount: z.string().min(1),
  toAccount: z.string().min(1),
  toIfsc: z.string().nullish(),
  beneficiaryName: z.string().nullish(),
  amount: numericString,
  currencyCode: z.string().nullish(),
  charges: numericString.nullish(),
  gst: numericString.nullish(),
  totalDebit: numericString.nullish(),
  remarks: z.string().nullish(),
  narration: z.string().nullish(),
  initiatedAt: isoInstant.nullish(),
  postedAt: isoInstant.nullish(),
  completedAt: isoInstant.nullish(),
  idempotencyKey: z.string().nullish(),
  makerUsername: z.string().nullish(),
  checkerUsername: z.string().nullish(),
  utr: z.string().nullish(),
  npciRrn: z.string().nullish(),
}).passthrough();

export const transferStatusResponseSchema = z.object({
  referenceNumber: z.string().min(1),
  status: transferStatusSchema,
  updatedAt: isoInstant.nullish(),
  failureReason: z.string().nullish(),
  failureCode: z.string().nullish(),
  utr: z.string().nullish(),
  npciRrn: z.string().nullish(),
}).passthrough();

export const transferEnvelopeSchema = springEnvelope(transferResponseSchema);
export const transferStatusEnvelopeSchema = springEnvelope(transferStatusResponseSchema);
