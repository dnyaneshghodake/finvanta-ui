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
  maskMobile,
  maskAccountNo,
} from '../primitives';

// ── PII Masking (RBI IT Governance §8.5 / UIDAI compliance) ───────

describe('maskPan', () => {
  it('masks a valid 10-char PAN: ABCDE1234F → XXXXXX234F (last 4 visible)', () => {
    expect(maskPan('ABCDE1234F')).toBe('XXXXXX234F');
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
  it('masks a valid 12-digit Aadhaar: XXXXXXXX + last 4 visible', () => {
    expect(maskAadhaar('123456789012')).toBe('XXXXXXXX9012');
  });

  it('returns full mask for short/invalid Aadhaar', () => {
    expect(maskAadhaar('')).toBe('**** **** ****');
    expect(maskAadhaar('12345')).toBe('**** **** ****');
  });

  it('returns full mask for null-like input', () => {
    expect(maskAadhaar(undefined as unknown as string)).toBe('**** **** ****');
  });
});

describe('maskMobile', () => {
  it('masks a valid 10-digit mobile: 9876543210 → XXXXXX3210 (last 4 visible)', () => {
    expect(maskMobile('9876543210')).toBe('XXXXXX3210');
  });

  it('returns **** for short/invalid mobile', () => {
    expect(maskMobile('')).toBe('****');
    expect(maskMobile('12')).toBe('****');
  });

  it('returns **** for null-like input', () => {
    expect(maskMobile(undefined as unknown as string)).toBe('****');
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
