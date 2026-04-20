/**
 * Zod schemas for Account-related endpoints.
 *
 * Matches the Spring `AccountResponse` / `AccountBalanceResponse`
 * shapes catalogued in docs/API_REFERENCE.md §4. Nullable fields use
 * `.nullish()` so both `null` and missing keys are accepted; numeric
 * fields use `numericString` because Spring serialises `BigDecimal`
 * as a JSON string by default.
 *
 * Only the fields the UI actually reads are validated — additive
 * Spring columns (e.g. new product metadata) flow through untouched.
 * Pass the schema through `apiClient`'s validation hook to hard-
 * reject payloads that don't match this contract.
 */
import { z } from 'zod';
import { isoDate, isoInstant, numericString, springEnvelope } from './common';

export const accountResponseSchema = z.object({
  id: z.union([z.number(), z.string()]),
  accountNumber: z.string().min(1),
  accountType: z.string().min(1),
  productCode: z.string().nullish(),
  status: z.string().min(1),
  customerId: z.union([z.number(), z.string()]).nullish(),
  customerNumber: z.string().nullish(),
  customerName: z.string().nullish(),
  branchCode: z.string().nullish(),
  ifscCode: z.string().nullish(),
  currencyCode: z.string().nullish(),
  ledgerBalance: numericString,
  availableBalance: numericString,
  holdAmount: numericString.nullish(),
  unclearedAmount: numericString.nullish(),
  odLimit: numericString.nullish(),
  effectiveAvailable: numericString.nullish(),
  minimumBalance: numericString.nullish(),
  interestRate: numericString.nullish(),
  accruedInterest: numericString.nullish(),
  lastInterestCreditDate: z.string().nullish(),
  openedDate: z.string().nullish(),
  closedDate: z.string().nullish(),
  closureReason: z.string().nullish(),
  lastTransactionDate: z.string().nullish(),
  freezeType: z.string().nullish(),
  freezeReason: z.string().nullish(),
  nomineeName: z.string().nullish(),
  nomineeRelationship: z.string().nullish(),
  jointHolderMode: z.string().nullish(),
}).passthrough();

export const accountListSchema = z.object({
  content: z.array(accountResponseSchema),
  totalElements: z.number().nullish(),
  totalPages: z.number().nullish(),
  size: z.number().nullish(),
  number: z.number().nullish(),
}).passthrough();

export const accountBalanceResponseSchema = z.object({
  accountNumber: z.string().min(1),
  currencyCode: z.string().nullish(),
  ledgerBalance: numericString,
  availableBalance: numericString,
  holdAmount: numericString.nullish(),
  unclearedAmount: numericString.nullish(),
  odLimit: numericString.nullish(),
  effectiveAvailable: numericString.nullish(),
  asOf: z.union([isoInstant, isoDate]).nullish(),
}).passthrough();

export const accountEnvelopeSchema = springEnvelope(accountResponseSchema);
export const accountListEnvelopeSchema = springEnvelope(accountListSchema);
export const accountBalanceEnvelopeSchema = springEnvelope(accountBalanceResponseSchema);
