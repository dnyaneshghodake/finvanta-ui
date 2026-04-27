/**
 * Strictness tests for the FD `maturityDate` field.
 *
 * Tightening this field is risk-bearing: a false CONTRACT_MISMATCH on
 * a successfully-booked FD means the customer sees an error while the
 * money is debited. These tests pin the *exact* set of accepted shapes
 * so any future loosening / tightening is a deliberate, reviewed change.
 */
import { describe, it, expect } from 'vitest';
import { bookFdResponseSchema } from '../deposit';

// Minimal payload with all fields the booking schema strictly requires
// (fdAccountNumber + customerId + principalAmount + tenureDays +
// interestRate). Per-case overrides exercise `maturityDate` only —
// every other field stays valid so we are testing the date validator
// in isolation, not collateral required-field failures.
const baseFd = {
  fdAccountNumber: 'FD-2026-000001',
  customerId: '1001',
  principalAmount: '100000.00',
  tenureDays: '365',
  interestRate: '7.25',
  maturityDate: '2027-04-19',
};

describe('bookFdResponseSchema.maturityDate', () => {
  it('accepts ISO calendar date YYYY-MM-DD (LocalDate)', () => {
    expect(() => bookFdResponseSchema.parse({
      ...baseFd, maturityDate: '2027-04-19',
    } as unknown)).not.toThrow();
  });

  it('accepts full ISO instant (LocalDateTime / ZonedDateTime)', () => {
    expect(() => bookFdResponseSchema.parse({
      ...baseFd, maturityDate: '2027-04-19T00:00:00Z',
    } as unknown)).not.toThrow();
  });

  it('accepts null / undefined (nullish)', () => {
    expect(() => bookFdResponseSchema.parse({
      ...baseFd, maturityDate: null,
    } as unknown)).not.toThrow();
    expect(() => bookFdResponseSchema.parse({
      ...baseFd, maturityDate: undefined,
    } as unknown)).not.toThrow();
  });

  it('REJECTS dd-MM-yyyy (legacy Indian date format)', () => {
    expect(() => bookFdResponseSchema.parse({
      ...baseFd, maturityDate: '19-04-2027',
    } as unknown)).toThrow();
  });

  it('REJECTS epoch millis (legacy DTO style)', () => {
    expect(() => bookFdResponseSchema.parse({
      ...baseFd, maturityDate: '1808697600000',
    } as unknown)).toThrow();
  });

  it('REJECTS empty string', () => {
    expect(() => bookFdResponseSchema.parse({
      ...baseFd, maturityDate: '',
    } as unknown)).toThrow();
  });

  it('REJECTS time-only values without YYYY-MM-DD prefix', () => {
    expect(() => bookFdResponseSchema.parse({
      ...baseFd, maturityDate: '10:15:30Z',
    } as unknown)).toThrow();
  });
});
