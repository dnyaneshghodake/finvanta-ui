/**
 * Strictness tests for the FD `maturityDate` field.
 *
 * Tightening this field is risk-bearing: a false CONTRACT_MISMATCH on
 * a successfully-booked FD means the customer sees an error while the
 * money is debited. These tests pin the *exact* set of accepted shapes
 * so any future loosening / tightening is a deliberate, reviewed change.
 */
import { describe, it, expect } from 'vitest';
import { fixedDepositResponseSchema } from '../deposit';

const baseFd = {
  // Minimal fields commonly required; extend to match actual schema.
  // These are the fields under test — others are added per-case if
  // the schema rejects without them.
  maturityDate: '2027-04-19',
};

describe('fixedDepositResponseSchema.maturityDate', () => {
  it('accepts ISO calendar date YYYY-MM-DD (LocalDate)', () => {
    expect(() => fixedDepositResponseSchema.parse({
      ...baseFd, maturityDate: '2027-04-19',
    } as unknown)).not.toThrow();
  });

  it('accepts full ISO instant (LocalDateTime / ZonedDateTime)', () => {
    expect(() => fixedDepositResponseSchema.parse({
      ...baseFd, maturityDate: '2027-04-19T00:00:00Z',
    } as unknown)).not.toThrow();
  });

  it('accepts null / undefined (nullish)', () => {
    expect(() => fixedDepositResponseSchema.parse({
      ...baseFd, maturityDate: null,
    } as unknown)).not.toThrow();
    expect(() => fixedDepositResponseSchema.parse({
      ...baseFd, maturityDate: undefined,
    } as unknown)).not.toThrow();
  });

  it('REJECTS dd-MM-yyyy (legacy Indian date format)', () => {
    expect(() => fixedDepositResponseSchema.parse({
      ...baseFd, maturityDate: '19-04-2027',
    } as unknown)).toThrow();
  });

  it('REJECTS epoch millis (legacy DTO style)', () => {
    expect(() => fixedDepositResponseSchema.parse({
      ...baseFd, maturityDate: '1808697600000',
    } as unknown)).toThrow();
  });

  it('REJECTS empty string', () => {
    expect(() => fixedDepositResponseSchema.parse({
      ...baseFd, maturityDate: '',
    } as unknown)).toThrow();
  });

  it('REJECTS time-only values without YYYY-MM-DD prefix', () => {
    expect(() => fixedDepositResponseSchema.parse({
      ...baseFd, maturityDate: '10:15:30Z',
    } as unknown)).toThrow();
  });
});
