/**
 * Behaviour tests for `accountService.transfer`.
 *
 * Pins the new contract introduced in PR #15:
 *   1. Currency is sourced from the debiting account.
 *   2. INR fallback when the lookup fails (non-fatal).
 *   3. `voucherNumber` is populated from `auditHashPrefix`.
 *   4. Default narration when `data.description` is empty.
 *   5. Outbound transfer is unambiguously a DEBIT on the source.
 *   6. X-Idempotency-Key is sent and echoed in the body.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// crypto.randomUUID may be missing under jsdom on older Node.
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: { randomUUID: () => '00000000-0000-4000-8000-000000000000' },
    configurable: true,
  });
}

const getMock = vi.fn();
const postMock = vi.fn();

vi.mock('../apiClient', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
  },
}));

import { accountService } from '../accountService';

const successfulTransferBody = {
  status: 'SUCCESS',
  data: {
    transactionRef: 'TXN-2026-000001',
    amount: '1500.00',
    postingDate: '2026-04-19T10:15:30Z',
    auditHashPrefix: 'a1b2c3d4e5f6',
  },
};

beforeEach(() => {
  getMock.mockReset();
  postMock.mockReset();
});

describe('accountService.transfer', () => {
  it('stamps source-account currency on the resulting Transaction', async () => {
    getMock.mockResolvedValueOnce({
      data: {
        status: 'SUCCESS',
        data: { accountNumber: 'NRE-001', accountType: 'SAVINGS_NRI', status: 'ACTIVE',
          ledgerBalance: 0, availableBalance: 0, currencyCode: 'USD' },
      },
    });
    postMock.mockResolvedValueOnce({ data: successfulTransferBody, headers: {} });

    const r = await accountService.transfer('NRE-001', {
      toAccountNumber: 'SB-002', amount: 1500, description: 'Remittance',
    } as never);

    expect(r.success).toBe(true);
    expect(r.data?.currency).toBe('USD');
  });

  it('falls back to INR when source-account lookup fails (non-fatal)', async () => {
    getMock.mockRejectedValueOnce(new Error('network down'));
    postMock.mockResolvedValueOnce({ data: successfulTransferBody, headers: {} });

    const r = await accountService.transfer('SB-001', {
      toAccountNumber: 'SB-002', amount: 1500, description: 'X',
    } as never);

    expect(r.success).toBe(true);
    expect(r.data?.currency).toBe('INR');
    // The transfer POST must still happen — currency lookup is presentational.
    expect(postMock).toHaveBeenCalledOnce();
  });

  it('preserves auditHashPrefix as voucherNumber for tamper-evident receipt', async () => {
    getMock.mockResolvedValueOnce({ data: { status: 'SUCCESS',
      data: { accountNumber: 'SB-001', accountType: 'SAVINGS', status: 'ACTIVE',
        ledgerBalance: 0, availableBalance: 0, currencyCode: 'INR' } } });
    postMock.mockResolvedValueOnce({ data: successfulTransferBody, headers: {} });

    const r = await accountService.transfer('SB-001', {
      toAccountNumber: 'SB-002', amount: 1500, description: 'X',
    } as never);

    expect(r.data?.voucherNumber).toBe('a1b2c3d4e5f6');
  });

  it('records DEBIT with negative amount on the source account', async () => {
    getMock.mockResolvedValueOnce({ data: { status: 'SUCCESS',
      data: { accountNumber: 'SB-001', accountType: 'SAVINGS', status: 'ACTIVE',
        ledgerBalance: 0, availableBalance: 0, currencyCode: 'INR' } } });
    postMock.mockResolvedValueOnce({ data: successfulTransferBody, headers: {} });

    const r = await accountService.transfer('SB-001', {
      toAccountNumber: 'SB-002', amount: 1500, description: 'X',
    } as never);

    expect(r.data?.transactionType).toBe('DEBIT');
    expect(r.data?.debitCredit).toBe('DR');
    expect(r.data?.amount).toBe(-1500);
  });

  it('uses [SYSTEM]-tagged default when description is empty (current behaviour)', async () => {
    // NOTE: this pins the *current* behaviour. Per review feedback the
    // user-visible '[SYSTEM]' prefix is contested; if it is removed,
    // update this assertion to the agreed default.
    getMock.mockResolvedValueOnce({ data: { status: 'SUCCESS',
      data: { accountNumber: 'SB-001', accountType: 'SAVINGS', status: 'ACTIVE',
        ledgerBalance: 0, availableBalance: 0, currencyCode: 'INR' } } });
    postMock.mockResolvedValueOnce({ data: successfulTransferBody, headers: {} });

    const r = await accountService.transfer('SB-001', {
      toAccountNumber: 'SB-002', amount: 1500, description: '',
    } as never);

    expect(r.data?.description).toBe('[SYSTEM] Account transfer');
  });

  it('sends X-Idempotency-Key header and echoes it in the request body', async () => {
    getMock.mockResolvedValueOnce({ data: { status: 'SUCCESS',
      data: { accountNumber: 'SB-001', accountType: 'SAVINGS', status: 'ACTIVE',
        ledgerBalance: 0, availableBalance: 0, currencyCode: 'INR' } } });
    postMock.mockResolvedValueOnce({ data: successfulTransferBody, headers: {} });

    await accountService.transfer('SB-001', {
      toAccountNumber: 'SB-002', amount: 1500, description: 'X',
    } as never);

    const [, body, opts] = postMock.mock.calls[0];
    expect(body.idempotencyKey).toBeDefined();
    expect(opts.headers['X-Idempotency-Key']).toBe(body.idempotencyKey);
  });
});
