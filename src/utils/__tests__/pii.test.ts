/**
 * Unit tests for PII masking + permission-gated reveal.
 * @file src/utils/__tests__/pii.test.ts
 *
 * Per RBI Master Direction on Digital Payment Security Controls §5.8
 * and OWASP ASVS 4.0 V8.1, every PII field must default to masked
 * rendering and reveal must be gated by an explicit permission +
 * audit event. These tests lock that contract.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  maskPAN,
  maskAadhaar,
  maskMobile,
  maskEmail,
  maskAccountNumber,
  revealPii,
  maskFor,
  collectPermissions,
  PII_PERMISSIONS,
  type PiiAuditSink,
  type RevealContext,
} from '../pii';

// ── maskPAN ──────────────────────────────────────────────────────

describe('maskPAN', () => {
  it('returns empty string for null / undefined / empty', () => {
    expect(maskPAN(null)).toBe('');
    expect(maskPAN(undefined)).toBe('');
    expect(maskPAN('')).toBe('');
  });

  it('masks a standard 10-character PAN', () => {
    expect(maskPAN('ABCDE1234F')).toBe('ABXXXXXXXF');
  });

  it('strips spaces / dashes before masking', () => {
    expect(maskPAN('ABCDE-1234-F')).toBe('ABXXXXXXXF');
    expect(maskPAN('ABCDE 1234 F')).toBe('ABXXXXXXXF');
  });

  it('returns all placeholders when shorter than visible slice', () => {
    expect(maskPAN('AB')).toBe('XX');
    expect(maskPAN('ABC')).toBe('XXX');
  });
});

// ── maskAadhaar ──────────────────────────────────────────────────

describe('maskAadhaar', () => {
  it('returns empty string for empty input', () => {
    expect(maskAadhaar(null)).toBe('');
    expect(maskAadhaar(undefined)).toBe('');
    expect(maskAadhaar('')).toBe('');
  });

  it('masks a 12-digit Aadhaar per UIDAI guidelines (last 4 visible)', () => {
    expect(maskAadhaar('123456789012')).toBe('XXXX XXXX 9012');
  });

  it('strips spaces / dashes', () => {
    expect(maskAadhaar('1234 5678 9012')).toBe('XXXX XXXX 9012');
    expect(maskAadhaar('1234-5678-9012')).toBe('XXXX XXXX 9012');
  });

  it('returns a flat 12-X block when shorter than 4 digits', () => {
    expect(maskAadhaar('12')).toBe('XXXXXXXXXXXX');
  });
});

// ── maskMobile ───────────────────────────────────────────────────

describe('maskMobile', () => {
  it('returns empty for empty input', () => {
    expect(maskMobile(null)).toBe('');
    expect(maskMobile(undefined)).toBe('');
    expect(maskMobile('')).toBe('');
  });

  it('masks a bare 10-digit number', () => {
    expect(maskMobile('9876543210')).toBe('XXXXXXXX10');
  });

  it('preserves the country code prefix', () => {
    expect(maskMobile('+91-98765 43210')).toBe('+91-XXXXXXXX10');
  });

  it('returns a flat block for short input', () => {
    expect(maskMobile('abc')).toBe('X');
    expect(maskMobile('123')).toBe('XXX');
  });
});

// ── maskEmail ────────────────────────────────────────────────────

describe('maskEmail', () => {
  it('returns empty for empty input', () => {
    expect(maskEmail(null)).toBe('');
    expect(maskEmail(undefined)).toBe('');
    expect(maskEmail('')).toBe('');
  });

  it('keeps the first local char and preserves the domain', () => {
    expect(maskEmail('alice.sharma@example.com')).toBe('a***********@example.com');
  });

  it('expands short local parts to at least two placeholders', () => {
    expect(maskEmail('a@x.com')).toBe('a**@x.com');
    expect(maskEmail('ab@x.com')).toBe('a**@x.com');
  });

  it('falls back to full-length stars when there is no @', () => {
    expect(maskEmail('notanemail')).toBe('**********');
  });

  it('returns only the domain when local part is empty', () => {
    expect(maskEmail('@example.com')).toBe('@example.com');
  });
});

// ── maskAccountNumber ────────────────────────────────────────────

describe('maskAccountNumber', () => {
  it('returns empty for empty input', () => {
    expect(maskAccountNumber(null)).toBe('');
    expect(maskAccountNumber(undefined)).toBe('');
    expect(maskAccountNumber('')).toBe('');
  });

  it('masks a numeric account showing only the last 4', () => {
    expect(maskAccountNumber('000123456789')).toBe('XXXXXXXX6789');
  });

  it('preserves product + branch segments in composite keys', () => {
    expect(maskAccountNumber('SB-HQ001-000001')).toBe('SB-HQ001-XX0001');
  });

  it('returns a flat block when the tail is too short to safely mask', () => {
    expect(maskAccountNumber('SB-HQ001-12')).toBe('SB-HQ001-XX');
    expect(maskAccountNumber('1234')).toBe('XXXX');
  });
});

// ── maskFor dispatch ─────────────────────────────────────────────

describe('maskFor', () => {
  it('dispatches to the field-specific masker', () => {
    expect(maskFor('REVEAL_PAN', 'ABCDE1234F')).toBe('ABXXXXXXXF');
    expect(maskFor('REVEAL_AADHAAR', '123456789012')).toBe('XXXX XXXX 9012');
    expect(maskFor('REVEAL_MOBILE', '9876543210')).toBe('XXXXXXXX10');
    expect(maskFor('REVEAL_EMAIL', 'a@x.com')).toBe('a**@x.com');
    expect(maskFor('REVEAL_ACCOUNT', '000123456789')).toBe('XXXXXXXX6789');
  });
});

// ── revealPii (permission gate + audit) ──────────────────────────

describe('revealPii', () => {
  const buildCtx = (
    field: keyof typeof PII_PERMISSIONS,
    permissions: string[],
    sink?: PiiAuditSink,
  ): RevealContext => ({
    permissions: new Set(permissions),
    subject: 'operator1',
    reason: `reveal_${field.toLowerCase()}_in_test`,
    correlationId: 'corr-test-1',
    sink,
  });

  it('returns empty for empty raw value without emitting audit', () => {
    const record = vi.fn();
    const ctx = buildCtx('REVEAL_PAN', [PII_PERMISSIONS.REVEAL_PAN], { record });
    expect(revealPii('REVEAL_PAN', '', ctx)).toBe('');
    expect(record).not.toHaveBeenCalled();
  });

  it('returns masked value when caller lacks the permission (no audit)', () => {
    const record = vi.fn();
    const ctx = buildCtx('REVEAL_PAN', [], { record });
    expect(revealPii('REVEAL_PAN', 'ABCDE1234F', ctx)).toBe('ABXXXXXXXF');
    expect(record).not.toHaveBeenCalled();
  });

  it('returns raw value when caller holds the permission', () => {
    const ctx = buildCtx('REVEAL_PAN', [PII_PERMISSIONS.REVEAL_PAN]);
    expect(revealPii('REVEAL_PAN', 'ABCDE1234F', ctx)).toBe('ABCDE1234F');
  });

  it('works without a sink (reveal still fires, no audit written)', () => {
    const ctx: RevealContext = {
      permissions: new Set([PII_PERMISSIONS.REVEAL_AADHAAR]),
      reason: 'no_sink',
    };
    expect(revealPii('REVEAL_AADHAAR', '123456789012', ctx)).toBe('123456789012');
  });

  it('emits an audit event with SHA-256 hash when permission is held', async () => {
    const record = vi.fn();
    const ctx = buildCtx('REVEAL_PAN', [PII_PERMISSIONS.REVEAL_PAN], { record });
    revealPii('REVEAL_PAN', 'ABCDE1234F', ctx);
    // emitAudit is fire-and-forget; wait a microtask for the hash to resolve.
    await new Promise((r) => setTimeout(r, 10));
    expect(record).toHaveBeenCalledTimes(1);
    const event = record.mock.calls[0][0];
    expect(event.field).toBe('REVEAL_PAN');
    expect(event.subject).toBe('operator1');
    expect(event.reason).toBe('reveal_reveal_pan_in_test');
    expect(event.correlationId).toBe('corr-test-1');
    expect(event.valueHash).toMatch(/^[0-9a-f]{16}$/);
    expect(event.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ── collectPermissions ───────────────────────────────────────────

describe('collectPermissions', () => {
  it('returns an empty set when both sources are absent', () => {
    expect(collectPermissions().size).toBe(0);
    expect(collectPermissions(null, null).size).toBe(0);
  });

  it('collects flat permissions', () => {
    const set = collectPermissions(['CUSTOMER_PAN_REVEAL', 'CUSTOMER_AADHAAR_REVEAL']);
    expect(set.has('CUSTOMER_PAN_REVEAL')).toBe(true);
    expect(set.has('CUSTOMER_AADHAAR_REVEAL')).toBe(true);
  });

  it('flattens permissionsByModule', () => {
    const set = collectPermissions(null, {
      CUSTOMER: ['CUSTOMER_PAN_REVEAL', 'CUSTOMER_EMAIL_REVEAL'],
      ACCOUNT: ['ACCOUNT_NUMBER_REVEAL'],
    });
    expect(set.has('CUSTOMER_PAN_REVEAL')).toBe(true);
    expect(set.has('CUSTOMER_EMAIL_REVEAL')).toBe(true);
    expect(set.has('ACCOUNT_NUMBER_REVEAL')).toBe(true);
  });

  it('merges flat + module permissions without duplication', () => {
    const set = collectPermissions(
      ['CUSTOMER_PAN_REVEAL'],
      { CUSTOMER: ['CUSTOMER_PAN_REVEAL', 'CUSTOMER_MOBILE_REVEAL'] },
    );
    expect(set.size).toBe(2);
    expect(set.has('CUSTOMER_PAN_REVEAL')).toBe(true);
    expect(set.has('CUSTOMER_MOBILE_REVEAL')).toBe(true);
  });
});
