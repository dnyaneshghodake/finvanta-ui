/**
 * Shared Zod primitives for response-interceptor validation.
 *
 * Rationale (OWASP ASVS 4.0 V13, NIST 800-53 SI-10): a BFF that
 * trusts Spring envelopes by shape only is exposed to contract
 * drift. If Spring starts emitting an unexpected field or an
 * attacker pipes a forged payload through a compromised egress
 * proxy, the UI happily renders it. Zod validation at the interceptor
 * layer fails closed — the UI receives a normalised error instead
 * of a mis-shaped object.
 *
 * Schemas intentionally use `.passthrough()` where the backend is
 * known to add fields over time, and `.nullish()` for the many
 * nullable Spring columns. The goal is to reject malformed shapes
 * without breaking forward-compat with additive backend changes.
 */
import { z } from 'zod';

/**
 * Numbers may arrive as `number` (JSON number) or as decimal strings
 * (Spring `BigDecimal` serialisation). Accept both and coerce.
 */
export const numericString = z.union([
  z.number(),
  z.string().regex(/^-?\d+(\.\d+)?$/, 'not-a-number'),
]);

/** ISO-8601 instant, e.g. `2026-04-19T10:15:30Z`. */
export const isoInstant = z.string().min(1);
/** Calendar date `YYYY-MM-DD`. */
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * Spring standard envelope. `data` is generic and is narrowed by
 * the per-endpoint schema via `springEnvelope(dataSchema)`.
 */
export const springEnvelopeBase = z.object({
  status: z.enum(['SUCCESS', 'ERROR']),
  errorCode: z.string().nullish(),
  message: z.string().nullish(),
  timestamp: z.string().nullish(),
});

export function springEnvelope<T extends z.ZodTypeAny>(data: T) {
  return springEnvelopeBase.extend({
    data: data.nullish(),
  });
}

export type SpringEnvelope<T> = {
  status: 'SUCCESS' | 'ERROR';
  data?: T | null;
  errorCode?: string | null;
  message?: string | null;
  timestamp?: string | null;
};
