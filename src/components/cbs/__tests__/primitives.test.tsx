/**
 * CBS form primitives component tests.
 * @file src/components/cbs/__tests__/primitives.test.tsx
 *
 * Per RBI IT Governance Direction 2023 §8.4: financial input
 * components must be tested for correct formatting, masking,
 * accessibility attributes, and PII protection.
 */
import { describe, it, expect } from 'vitest';
import {
  maskPan,
  maskAadhaar,
  maskAccountNo,
} from '../primitives';

// ── PII Masking (RBI KYC / UIDAI compliance) ──────────────────────

describe('maskPan', () => {
  it('masks a valid 10-char PAN: ABCDE1234F → ABCD***34F', () => {
    expect(maskPan('ABCDE1234F')).toBe('ABCD***34F');
  });

  it('returns **** for short/invalid PAN', () => {
    expect(maskPan('')).toBe('****');
    expect(maskPan('ABC')).toBe('****');
  });

  it('returns **** for null-like input', () => {
    expect(maskPan(undefined as unknown as string)).toBe('****');
  });
});

describe('maskAadhaar', () => {
  it('masks a valid 12-digit Aadhaar: shows last 4 only', () => {
    expect(maskAadhaar('123456789012')).toBe('**** **** 9012');
  });

  it('returns full mask for short/invalid Aadhaar', () => {
    expect(maskAadhaar('')).toBe('**** **** ****');
    expect(maskAadhaar('12345')).toBe('**** **** ****');
  });

  it('returns full mask for null-like input', () => {
    expect(maskAadhaar(undefined as unknown as string)).toBe('**** **** ****');
  });
});

describe('maskAccountNo', () => {
  it('masks account number: shows last 4 only', () => {
    expect(maskAccountNo('SB-HQ001-000001')).toBe('****0001');
  });

  it('returns **** for short input', () => {
    expect(maskAccountNo('AB')).toBe('****');
    expect(maskAccountNo('')).toBe('****');
  });

  it('handles digit-only account numbers', () => {
    expect(maskAccountNo('123456789012')).toBe('****9012');
  });
});
