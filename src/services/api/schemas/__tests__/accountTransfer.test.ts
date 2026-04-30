/**
 * Contract tests for `accountTransferEnvelopeSchema`.
 *
 * Per DESIGN_SYSTEM §16b: response interceptor fails closed. These
 * tests pin the wire shape so a backend drift (renamed/removed field)
 * surfaces here before it reaches the runtime CONTRACT_MISMATCH path.
 */
import { describe, it, expect } from 'vitest';
import {
  accountTransferResponseSchema,
  accountTransferEnvelopeSchema,
} from '../accountTransfer';

const validData = {
  transactionRef: 'TXN-2026-000001',
  amount: '1500.00',
  postingDate: '2026-04-19T10:15:30Z',
  auditHashPrefix: 'a1b2c3d4e5f6',
};

describe('accountTransferResponseSchema', () => {
  it('accepts the minimal Spring TransactionResponse shape', () => {
    expect(accountTransferResponseSchema.parse(validData)).toMatchObject(validData);
  });

  it('accepts numeric amount (BigDecimal -> JSON number)', () => {
    const r = accountTransferResponseSchema.parse({ ...validData, amount: 1500 });
    expect(r.amount).toBe(1500);
  });

  it('accepts null/undefined for nullish fields', () => {
    expect(() => accountTransferResponseSchema.parse({
      transactionRef: 'TXN-1',
      amount: '0.01',
      postingDate: null,
      auditHashPrefix: null,
    })).not.toThrow();
    expect(() => accountTransferResponseSchema.parse({
      transactionRef: 'TXN-1',
      amount: '0.01',
    })).not.toThrow();
  });

  it('rejects empty transactionRef (required by audit trail)', () => {
    expect(() => accountTransferResponseSchema.parse({ ...validData, transactionRef: '' }))
      .toThrow();
  });

  it('rejects malformed numeric amount strings', () => {
    expect(() => accountTransferResponseSchema.parse({ ...validData, amount: 'abc' }))
      .toThrow();
    expect(() => accountTransferResponseSchema.parse({ ...validData, amount: '1,500.00' }))
      .toThrow();
  });

  it('accepts ISO calendar date YYYY-MM-DD on postingDate (LocalDate)', () => {
    expect(() => accountTransferResponseSchema.parse({
      ...validData, postingDate: '2026-04-19',
    })).not.toThrow();
  });

  it('REJECTS malformed postingDate (dd-MM-yyyy / time-only / empty)', () => {
    // Mirrors the maturityDate strictness on bookFdResponseSchema.
    expect(() => accountTransferResponseSchema.parse({
      ...validData, postingDate: '19-04-2026',
    })).toThrow();
    expect(() => accountTransferResponseSchema.parse({
      ...validData, postingDate: '10:15:30Z',
    })).toThrow();
    expect(() => accountTransferResponseSchema.parse({
      ...validData, postingDate: '',
    })).toThrow();
  });

  it('REJECTS malformed auditHashPrefix (not 12 lowercase hex chars)', () => {
    // Uppercase hex — Spring emits lowercase only.
    expect(() => accountTransferResponseSchema.parse({
      ...validData, auditHashPrefix: 'A1B2C3D4E5F6',
    })).toThrow();
    // Wrong length (10 / 16 chars).
    expect(() => accountTransferResponseSchema.parse({
      ...validData, auditHashPrefix: 'a1b2c3d4e5',
    })).toThrow();
    expect(() => accountTransferResponseSchema.parse({
      ...validData, auditHashPrefix: 'a1b2c3d4e5f6a1b2',
    })).toThrow();
    // Non-hex character.
    expect(() => accountTransferResponseSchema.parse({
      ...validData, auditHashPrefix: 'g1b2c3d4e5f6',
    })).toThrow();
  });

  it('passthrough: tolerates additive backend fields without CONTRACT_MISMATCH', () => {
    const r = accountTransferResponseSchema.parse({
      ...validData,
      newField: 'future-channel-code',
      anotherField: 42,
    }) as Record<string, unknown>;
    expect(r.newField).toBe('future-channel-code');
    expect(r.anotherField).toBe(42);
  });
});

describe('accountTransferEnvelopeSchema', () => {
  it('parses a SUCCESS envelope', () => {
    const env = accountTransferEnvelopeSchema.parse({
      status: 'SUCCESS',
      data: validData,
      timestamp: '2026-04-19T10:15:30Z',
    });
    expect(env.status).toBe('SUCCESS');
    expect(env.data?.transactionRef).toBe('TXN-2026-000001');
  });

  it('parses an ERROR envelope without data', () => {
    expect(() => accountTransferEnvelopeSchema.parse({
      status: 'ERROR',
      errorCode: 'INSUFFICIENT_FUNDS',
      message: 'Available balance too low',
    })).not.toThrow();
  });

  it('rejects an envelope with bogus status', () => {
    expect(() => accountTransferEnvelopeSchema.parse({
      status: 'PENDING',
      data: validData,
    })).toThrow();
  });
});
