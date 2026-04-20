/**
 * Response-interceptor schema registry.
 *
 * Associates BFF URL patterns (matched against `AxiosResponse.config.url`
 * under the `/api/cbs` base) with the Zod schema that must validate
 * the response envelope. The apiClient response interceptor walks
 * this list in order and hard-rejects any payload that fails.
 *
 * Adding coverage for a new endpoint:
 *   1. Declare the schema in ./account.ts, ./transfer.ts, or a new file.
 *   2. Register it here with the tightest `urlPattern` that matches
 *      only the endpoints whose shape is described.
 *   3. `methods` defaults to ["GET"] — use an explicit array for
 *      mutating endpoints (POST/PUT/etc).
 *
 * Matching rules:
 *   - `urlPattern` is a regex string anchored at the start of the
 *     path (the `/api/cbs` prefix is stripped by axios).
 *   - Only the FIRST matching schema is applied. More specific
 *     patterns must appear before catch-alls.
 */
import { z } from 'zod';
import {
  accountBalanceEnvelopeSchema,
  accountEnvelopeSchema,
  accountListEnvelopeSchema,
} from './account';
import {
  transferEnvelopeSchema,
  transferStatusEnvelopeSchema,
} from './transfer';

export interface ResponseSchemaRule {
  /** Regex string matched against the request URL (as seen by axios). */
  urlPattern: string;
  /** HTTP methods this rule applies to. Defaults to ['GET']. */
  methods?: ReadonlyArray<string>;
  /** Zod schema that must validate the response body. */
  // Using z.ZodTypeAny so each entry can use its own specific shape.
  schema: z.ZodTypeAny;
  /** Human-readable identifier for error messages / telemetry. */
  name: string;
}

export const RESPONSE_SCHEMAS: ReadonlyArray<ResponseSchemaRule> = [
  // Balance — most specific, so place before the generic /accounts rule.
  {
    name: 'accountBalance',
    urlPattern: '^/accounts/[^/]+/balance$',
    methods: ['GET'],
    schema: accountBalanceEnvelopeSchema,
  },

  // Account detail (single).
  {
    name: 'accountDetail',
    urlPattern: '^/accounts/[^/]+$',
    methods: ['GET'],
    schema: accountEnvelopeSchema,
  },

  // Account list (paged).
  {
    name: 'accountList',
    urlPattern: '^/accounts(\\?.*)?$',
    methods: ['GET'],
    schema: accountListEnvelopeSchema,
  },

  // Transfer status — specific to reference lookup.
  {
    name: 'transferStatus',
    urlPattern: '^/transfers/[^/]+/status$',
    methods: ['GET'],
    schema: transferStatusEnvelopeSchema,
  },

  // Transfer detail and confirm response share the same envelope.
  {
    name: 'transferConfirm',
    urlPattern: '^/transfers/[^/]+/confirm$',
    methods: ['POST'],
    schema: transferEnvelopeSchema,
  },
  {
    name: 'transferInitiateIntra',
    urlPattern: '^/transfers/intra$',
    methods: ['POST'],
    schema: transferEnvelopeSchema,
  },
  {
    name: 'transferInitiateNeft',
    urlPattern: '^/transfers/neft$',
    methods: ['POST'],
    schema: transferEnvelopeSchema,
  },
  {
    name: 'transferInitiateRtgs',
    urlPattern: '^/transfers/rtgs$',
    methods: ['POST'],
    schema: transferEnvelopeSchema,
  },
  {
    name: 'transferInitiateImps',
    urlPattern: '^/transfers/imps$',
    methods: ['POST'],
    schema: transferEnvelopeSchema,
  },
  {
    name: 'transferInitiateUpi',
    urlPattern: '^/transfers/upi$',
    methods: ['POST'],
    schema: transferEnvelopeSchema,
  },
  {
    name: 'transferDetail',
    urlPattern: '^/transfers/[^/]+$',
    methods: ['GET'],
    schema: transferEnvelopeSchema,
  },
];

/**
 * Lookup the first schema rule matching the given (method, url) pair.
 * The `/api/cbs` prefix must already be stripped by the caller — the
 * axios request URL does not include the baseURL.
 */
export function findResponseSchema(
  method: string,
  url: string,
): ResponseSchemaRule | undefined {
  const m = method.toUpperCase();
  for (const rule of RESPONSE_SCHEMAS) {
    const methods = rule.methods ?? ['GET'];
    if (!methods.includes(m)) continue;
    if (new RegExp(rule.urlPattern).test(url)) return rule;
  }
  return undefined;
}

export * from './common';
export * from './account';
export * from './transfer';
