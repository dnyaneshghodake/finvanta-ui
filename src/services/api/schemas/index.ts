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
import { bookFdEnvelopeSchema } from './deposit';
import { loanTransactionEnvelopeSchema } from './loan';
import { accountTransferEnvelopeSchema } from './accountTransfer';
import {
  cashDepositEnvelopeSchema,
  cashWithdrawalEnvelopeSchema,
  tellerCashMovementEnvelopeSchema,
  tellerCashMovementListEnvelopeSchema,
  tellerTillEnvelopeSchema,
  tellerTillListEnvelopeSchema,
  vaultPositionEnvelopeSchema,
} from './teller';

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

/**
 * Pre-compiled regex cache keyed by urlPattern string.
 * Avoids constructing up to N RegExp objects on every API response
 * (N = RESPONSE_SCHEMAS.length). Populated lazily on first match
 * attempt for each pattern.
 */
const compiledPatterns = new Map<string, RegExp>();

function getCompiledPattern(pattern: string): RegExp {
  let re = compiledPatterns.get(pattern);
  if (!re) {
    re = new RegExp(pattern);
    compiledPatterns.set(pattern, re);
  }
  return re;
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

  // Account-to-account transfer — Spring POST /v1/accounts/transfer.
  // Consumed by accountService.transfer. Returns a TransactionResponse
  // (transactionRef + amount + postingDate + auditHashPrefix). The
  // shape is structurally identical to the loan transaction envelope
  // *today*, but the two endpoints belong to unrelated bounded
  // contexts (account ledger vs. loan servicing). Use a dedicated
  // alias so a future change to either schema does not silently
  // propagate across domains. The existing `transferEnvelopeSchema`
  // describes a richer `TransferResponse` emitted by /transfers/* —
  // not by /accounts/transfer — so it would not match here.
  {
    name: 'accountTransfer',
    urlPattern: '^/accounts/transfer$',
    methods: ['POST'],
    schema: accountTransferEnvelopeSchema,
  },

  // Fixed Deposit booking — Spring POST /v1/fixed-deposits/book.
  // Validates the shape consumed by depositService.bookFd so a drifted
  // or forged FD booking response is rejected before the UI renders it.
  {
    name: 'depositBookFd',
    urlPattern: '^/fixed-deposits/book$',
    methods: ['POST'],
    schema: bookFdEnvelopeSchema,
  },

  // Loan disbursement — Spring POST /v1/loans/{n}/disburse and
  // /v1/loans/{n}/disburse-tranche. Both return the same
  // TransactionResponse envelope consumed by loanService.disburse.
  // Place BEFORE the repayment rules even though regexes are disjoint —
  // reads naturally as "disburse-tranche is a longer, more specific
  // path than the bare disburse".
  {
    name: 'loanDisburseTranche',
    urlPattern: '^/loans/[^/]+/disburse-tranche$',
    methods: ['POST'],
    schema: loanTransactionEnvelopeSchema,
  },
  {
    name: 'loanDisburse',
    urlPattern: '^/loans/[^/]+/disburse$',
    methods: ['POST'],
    schema: loanTransactionEnvelopeSchema,
  },

  // Loan repayment — Spring POST /v1/loans/{n}/repayment (EMI) and
  // /v1/loans/{n}/prepayment (part/full prepayment). Response shape
  // includes the server-computed principal/interest split.
  {
    name: 'loanRepayment',
    urlPattern: '^/loans/[^/]+/repayment$',
    methods: ['POST'],
    schema: loanTransactionEnvelopeSchema,
  },
  {
    name: 'loanPrepayment',
    urlPattern: '^/loans/[^/]+/prepayment$',
    methods: ['POST'],
    schema: loanTransactionEnvelopeSchema,
  },

  // ----- Teller module (Spring v2 /api/v2/teller/**) -----
  // The BFF mounts v2 endpoints under /api/cbs/v2 so the axios-visible
  // URL is '/v2/teller/...'. Patterns below are anchored at '^/v2/teller'
  // to avoid accidental collisions with v1 routes.
  //
  // More-specific paths (supervisor queue, vault movement actions) are
  // declared BEFORE generic /{id}/... patterns so the first-match-wins
  // resolver picks them up correctly.

  // Till lifecycle
  {
    name: 'tellerTillPending',
    urlPattern: '^/v2/teller/till/pending$',
    methods: ['GET'],
    schema: tellerTillListEnvelopeSchema,
  },
  {
    name: 'tellerTillMe',
    urlPattern: '^/v2/teller/till/me$',
    methods: ['GET'],
    schema: tellerTillEnvelopeSchema,
  },
  {
    name: 'tellerTillOpen',
    urlPattern: '^/v2/teller/till/open$',
    methods: ['POST'],
    schema: tellerTillEnvelopeSchema,
  },
  {
    name: 'tellerTillClose',
    urlPattern: '^/v2/teller/till/close$',
    methods: ['POST'],
    schema: tellerTillEnvelopeSchema,
  },
  {
    name: 'tellerTillApproveClose',
    urlPattern: '^/v2/teller/till/[^/]+/approve-close$',
    methods: ['POST'],
    schema: tellerTillEnvelopeSchema,
  },
  {
    name: 'tellerTillRejectOpen',
    urlPattern: '^/v2/teller/till/[^/]+/reject-open(\\?.*)?$',
    methods: ['POST'],
    schema: tellerTillEnvelopeSchema,
  },
  {
    name: 'tellerTillRejectClose',
    urlPattern: '^/v2/teller/till/[^/]+/reject-close(\\?.*)?$',
    methods: ['POST'],
    schema: tellerTillEnvelopeSchema,
  },
  {
    name: 'tellerTillApprove',
    urlPattern: '^/v2/teller/till/[^/]+/approve$',
    methods: ['POST'],
    schema: tellerTillEnvelopeSchema,
  },

  // Cash postings.
  // The FICN-rejection path returns HTTP 422 with `FicnAcknowledgementResponse`
  // inside the envelope `data` field — the response interceptor routes on
  // status code, not schema, so the success-path schema below is only
  // applied to HTTP 200 responses. FICN rejection is handled as an
  // AppError by the error path.
  {
    name: 'tellerCashDeposit',
    urlPattern: '^/v2/teller/cash-deposit$',
    methods: ['POST'],
    schema: cashDepositEnvelopeSchema,
  },
  {
    name: 'tellerCashWithdrawal',
    urlPattern: '^/v2/teller/cash-withdrawal$',
    methods: ['POST'],
    schema: cashWithdrawalEnvelopeSchema,
  },

  // Vault lifecycle — B1: backend prose says DTO, signatures say entity.
  // Schema matches the DTO shape per prose; CONTRACT_MISMATCH will fire
  // if backend actually emits raw entities.
  {
    name: 'tellerVaultMovementsPending',
    urlPattern: '^/v2/teller/vault/movements/pending$',
    methods: ['GET'],
    schema: tellerCashMovementListEnvelopeSchema,
  },
  {
    name: 'tellerVaultMovementApprove',
    urlPattern: '^/v2/teller/vault/movement/[^/]+/approve$',
    methods: ['POST'],
    schema: tellerCashMovementEnvelopeSchema,
  },
  {
    name: 'tellerVaultMovementReject',
    urlPattern: '^/v2/teller/vault/movement/[^/]+/reject(\\?.*)?$',
    methods: ['POST'],
    schema: tellerCashMovementEnvelopeSchema,
  },
  {
    name: 'tellerVaultBuy',
    urlPattern: '^/v2/teller/vault/buy(\\?.*)?$',
    methods: ['POST'],
    schema: tellerCashMovementEnvelopeSchema,
  },
  {
    name: 'tellerVaultSell',
    urlPattern: '^/v2/teller/vault/sell(\\?.*)?$',
    methods: ['POST'],
    schema: tellerCashMovementEnvelopeSchema,
  },
  {
    name: 'tellerVaultMe',
    urlPattern: '^/v2/teller/vault/me$',
    methods: ['GET'],
    schema: vaultPositionEnvelopeSchema,
  },
  {
    name: 'tellerVaultOpen',
    urlPattern: '^/v2/teller/vault/open(\\?.*)?$',
    methods: ['POST'],
    schema: vaultPositionEnvelopeSchema,
  },
  {
    name: 'tellerVaultClose',
    urlPattern: '^/v2/teller/vault/close(\\?.*)?$',
    methods: ['POST'],
    schema: vaultPositionEnvelopeSchema,
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
    if (getCompiledPattern(rule.urlPattern).test(url)) return rule;
  }
  return undefined;
}

export * from './common';
export * from './account';
export * from './transfer';
export * from './deposit';
export * from './loan';
export * from './accountTransfer';
export * from './teller';
