/**
 * Formatter unit tests — financial accuracy validation.
 * @file src/utils/__tests__/formatters.test.ts
 *
 * Per RBI IT Governance Direction 2023 §8.4: all financial computation
 * and display formatting MUST have regression tests to prevent
 * rounding errors, locale mismatches, and display corruption that
 * could lead to incorrect transaction amounts.
 *
 * CBS audit requirement: INR formatting must use Indian numbering
 * (lakh/crore grouping), 2-decimal precision, and ₹ symbol.
 */
import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatNumber,
  formatDate,
  formatDateTime,
  formatCbsTimestamp,
  formatCbsDate,
  formatAccountNumber,
  formatPANNumber,
  formatAadharNumber,
  formatIFSCCode,
  formatPhoneNumber,
  formatPercentage,
  formatAmountInr,
  formatTransactionType,
  formatTransactionStatus,
  formatAccountType,
  formatTransactionId,
  truncateText,
  capitalize,
} from '../formatters';

// ── Currency Formatting (INR) ──────────────────────────────────────

describe('formatCurrency', () => {
  it('formats zero correctly', () => {
    expect(formatCurrency(0)).toBe('₹0.00');
  });

  it('formats small amounts with 2 decimals', () => {
    expect(formatCurrency(1.5)).toBe('₹1.50');
  });

  it('formats amounts with Indian lakh grouping', () => {
    // 1,00,000 in Indian numbering
    const result = formatCurrency(100000);
    expect(result).toContain('1,00,000');
    expect(result).toContain('₹');
  });

  it('formats crore amounts correctly', () => {
    // 1,00,00,000 in Indian numbering
    const result = formatCurrency(10000000);
    expect(result).toContain('1,00,00,000');
  });

  it('respects custom decimal precision', () => {
    const result = formatCurrency(1234.5678, 'INR', 4);
    expect(result).toContain('1234.5678');
  });

  it('handles negative amounts', () => {
    const result = formatCurrency(-5000);
    expect(result).toContain('5,000');
    expect(result).toContain('-');
  });

  it('falls back gracefully for unknown currency', () => {
    const result = formatCurrency(100, 'INVALID');
    expect(result).toContain('100');
  });
});

// ── Indian Number Formatting ───────────────────────────────────────

describe('formatNumber', () => {
  it('formats with Indian grouping', () => {
    expect(formatNumber(100000)).toBe('1,00,000');
  });

  it('formats with decimals', () => {
    expect(formatNumber(1234.5, 2)).toBe('1,234.50');
  });

  it('handles zero', () => {
    expect(formatNumber(0)).toBe('0');
  });
});

// ── formatAmountInr (input field formatting) ───────────────────────

describe('formatAmountInr', () => {
  it('formats small amount', () => {
    expect(formatAmountInr('100')).toBe('100.00');
  });

  it('formats with Indian lakh grouping', () => {
    expect(formatAmountInr('100000')).toBe('1,00,000.00');
  });

  it('formats crore amount', () => {
    expect(formatAmountInr('10000000')).toBe('1,00,00,000.00');
  });

  it('preserves decimal input', () => {
    expect(formatAmountInr('1234.56')).toBe('1,234.56');
  });

  it('pads decimals to 2 places', () => {
    expect(formatAmountInr('1234.5')).toBe('1,234.50');
  });

  it('truncates decimals beyond 2 places', () => {
    expect(formatAmountInr('1234.567')).toBe('1,234.56');
  });

  it('strips non-numeric characters', () => {
    expect(formatAmountInr('₹1,00,000.00')).toBe('1,00,000.00');
  });

  it('returns empty for empty input', () => {
    expect(formatAmountInr('')).toBe('');
  });
});

// ── CBS Timestamp Formatting ───────────────────────────────────────

describe('formatCbsTimestamp', () => {
  it('formats ISO string to DD-MMM-YYYY HH:mm', () => {
    const result = formatCbsTimestamp('2026-04-19T14:30:00');
    expect(result).toBe('19-APR-2026 14:30');
  });

  it('formats Date object', () => {
    const date = new Date(2026, 3, 19, 9, 15); // April is month 3
    const result = formatCbsTimestamp(date);
    expect(result).toBe('19-APR-2026 09:15');
  });

  it('formats epoch number', () => {
    const epoch = new Date(2026, 0, 1, 0, 0).getTime();
    const result = formatCbsTimestamp(epoch);
    expect(result).toBe('01-JAN-2026 00:00');
  });

  it('returns original string for invalid date', () => {
    expect(formatCbsTimestamp('not-a-date')).toBe('not-a-date');
  });

  it('uses uppercase 3-letter month (CBS convention)', () => {
    const months = [
      { input: '2026-01-15T10:00:00', expected: 'JAN' },
      { input: '2026-06-15T10:00:00', expected: 'JUN' },
      { input: '2026-12-15T10:00:00', expected: 'DEC' },
    ];
    for (const { input, expected } of months) {
      expect(formatCbsTimestamp(input)).toContain(expected);
    }
  });
});

describe('formatCbsDate', () => {
  it('formats ISO string to DD-MMM-YYYY', () => {
    expect(formatCbsDate('2026-04-19')).toBe('19-APR-2026');
  });

  it('formats Date object', () => {
    const date = new Date(2026, 3, 19);
    expect(formatCbsDate(date)).toBe('19-APR-2026');
  });

  it('returns original for invalid input', () => {
    expect(formatCbsDate('invalid')).toBe('invalid');
  });
});

// ── Account Number Formatting ──────────────────────────────────────

describe('formatAccountNumber', () => {
  it('passes through CBS alphanumeric keys unchanged', () => {
    expect(formatAccountNumber('SB-HQ001-000001')).toBe('SB-HQ001-000001');
  });

  it('groups legacy 12+ digit numbers as XXXX XX XXXXX', () => {
    expect(formatAccountNumber('123456789012')).toBe('1234 56 789012');
  });

  it('returns short numbers unchanged', () => {
    expect(formatAccountNumber('12345')).toBe('12345');
  });

  it('strips spaces before formatting', () => {
    expect(formatAccountNumber('1234 5678 9012')).toBe('1234 56 789012');
  });
});

// ── PII Formatting ─────────────────────────────────────────────────

describe('formatPANNumber', () => {
  it('uppercases and strips non-alphanumeric', () => {
    expect(formatPANNumber('abcpk-1234a')).toBe('ABCPK1234A');
  });
});

describe('formatAadharNumber', () => {
  it('formats 12 digits as XXXX XXXX XXXX', () => {
    expect(formatAadharNumber('123456789012')).toBe('1234 5678 9012');
  });

  it('returns short input unchanged', () => {
    expect(formatAadharNumber('12345')).toBe('12345');
  });
});

describe('formatIFSCCode', () => {
  it('uppercases and strips non-alphanumeric', () => {
    expect(formatIFSCCode('fnvt-0hq001')).toBe('FNVT0HQ001');
  });
});

describe('formatPhoneNumber', () => {
  it('formats 10-digit number with +91 prefix', () => {
    expect(formatPhoneNumber('9876543210')).toBe('+91-98765 43210');
  });

  it('handles number with country code', () => {
    expect(formatPhoneNumber('919876543210')).toBe('+91-98765 43210');
  });

  it('returns short input unchanged', () => {
    expect(formatPhoneNumber('12345')).toBe('12345');
  });
});

// ── Display Formatters ─────────────────────────────────────────────

describe('formatPercentage', () => {
  it('formats with 2 decimals by default', () => {
    expect(formatPercentage(12.5)).toBe('12.50%');
  });

  it('respects custom decimals', () => {
    expect(formatPercentage(7.125, 3)).toBe('7.125%');
  });
});

describe('formatTransactionType', () => {
  it('maps known types', () => {
    expect(formatTransactionType('DEBIT')).toBe('Debit');
    expect(formatTransactionType('CREDIT')).toBe('Credit');
    expect(formatTransactionType('TRANSFER')).toBe('Transfer');
  });

  it('returns unknown types as-is', () => {
    expect(formatTransactionType('REVERSAL')).toBe('REVERSAL');
  });
});

describe('formatTransactionStatus', () => {
  it('maps known statuses', () => {
    expect(formatTransactionStatus('PENDING')).toBe('Pending');
    expect(formatTransactionStatus('COMPLETED')).toBe('Completed');
    expect(formatTransactionStatus('FAILED')).toBe('Failed');
    expect(formatTransactionStatus('REVERSED')).toBe('Reversed');
  });
});

describe('formatAccountType', () => {
  it('maps known types', () => {
    expect(formatAccountType('SAVINGS')).toBe('Savings Account');
    expect(formatAccountType('CURRENT')).toBe('Current Account');
  });

  it('returns unknown types as-is', () => {
    expect(formatAccountType('NRE')).toBe('NRE');
  });
});

describe('formatTransactionId', () => {
  it('returns short IDs unchanged', () => {
    expect(formatTransactionId('TXN001')).toBe('TXN001');
  });

  it('truncates long IDs with ellipsis', () => {
    expect(formatTransactionId('TXN0000000000001')).toBe('TXN000...000001');
  });
});

describe('truncateText', () => {
  it('returns short text unchanged', () => {
    expect(truncateText('hello', 10)).toBe('hello');
  });

  it('truncates with ellipsis', () => {
    expect(truncateText('hello world', 5)).toBe('hello...');
  });
});

describe('capitalize', () => {
  it('capitalizes first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
  });

  it('lowercases rest', () => {
    expect(capitalize('HELLO')).toBe('Hello');
  });
});

// ── Date Formatting (date-fns) ─────────────────────────────────────

describe('formatDate', () => {
  it('formats ISO string to DD-MMM-YYYY', () => {
    const result = formatDate('2026-04-19');
    expect(result).toMatch(/19-.*-2026/);
  });

  it('returns dash for invalid input', () => {
    expect(formatDate('not-a-date')).toBe('-');
  });
});

describe('formatDateTime', () => {
  it('formats with time component', () => {
    const result = formatDateTime('2026-04-19T14:30:00');
    expect(result).toContain('2026');
    expect(result).toContain('14:30');
  });
});
