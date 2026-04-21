/**
 * PII Masking Utilities for CBS Banking Application
 * @file src/utils/piiMask.ts
 *
 * Per UIDAI Aadhaar (Targeted Delivery of Financial and Other
 * Subsidies, Benefits and Services) Act 2016 §29: Aadhaar numbers
 * must not be displayed in full on any screen. Only the last 4
 * digits may be visible.
 *
 * Per RBI Master Direction on Digital Payment Security Controls
 * 2021 §7: account numbers and card numbers must be partially
 * masked when displayed in non-authorised contexts.
 *
 * These utilities are pure functions — no side effects, no DOM
 * access. They are consumed by display components and formatters.
 *
 * IMPORTANT: Masking is a UI-layer defence-in-depth measure.
 * The backend MUST also redact PII in API responses based on
 * the operator's role and the data classification level.
 */

/**
 * Mask an Aadhaar number: show only last 4 digits.
 * Input: "123456789012" or "1234 5678 9012"
 * Output: "XXXX XXXX 9012"
 *
 * Per UIDAI guidelines: the first 8 digits must always be masked.
 */
export function maskAadhaar(aadhaar: string): string {
  const digits = aadhaar.replace(/\D/g, '');
  if (digits.length < 12) return aadhaar; // malformed — return as-is
  const last4 = digits.slice(-4);
  return `XXXX XXXX ${last4}`;
}

/**
 * Mask a PAN number: show first 2 and last 2 characters.
 * Input: "ABCDE1234F"
 * Output: "AB******4F"
 *
 * Per Income Tax Act / RBI KYC norms: PAN should be partially
 * masked in non-verification contexts.
 */
export function maskPAN(pan: string): string {
  const cleaned = pan.replace(/\s/g, '').toUpperCase();
  if (cleaned.length < 10) return pan; // malformed
  return `${cleaned.slice(0, 2)}******${cleaned.slice(-2)}`;
}

/**
 * Mask a bank account number: show only last 4 digits/chars.
 * Input: "SB-HQ001-000001" → "***********0001"
 * Input: "50100123456789" → "**********6789"
 *
 * CBS convention: account numbers are masked in cross-account
 * views (e.g. counterparty in transaction history, beneficiary
 * lists). Full number is shown only on the account's own detail
 * screen.
 */
export function maskAccountNumber(accountNumber: string): string {
  const cleaned = accountNumber.replace(/\s/g, '');
  if (cleaned.length <= 4) return cleaned; // too short to mask
  const last4 = cleaned.slice(-4);
  const masked = '*'.repeat(cleaned.length - 4);
  return `${masked}${last4}`;
}

/**
 * Mask a phone number: show country code + last 4 digits.
 * Input: "+919876543210" → "+91******3210"
 * Input: "9876543210" → "******3210"
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return phone; // malformed

  const last4 = digits.slice(-4);
  if (digits.length > 10) {
    const countryCode = '+' + digits.slice(0, digits.length - 10);
    return `${countryCode}******${last4}`;
  }
  return `******${last4}`;
}

/**
 * Mask an email address: show first char + domain.
 * Input: "operator@finvanta.com" → "o*******@finvanta.com"
 */
export function maskEmail(email: string): string {
  const atIndex = email.indexOf('@');
  if (atIndex <= 0) return email; // malformed
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex);
  if (local.length <= 1) return email;
  return `${local[0]}${'*'.repeat(local.length - 1)}${domain}`;
}

/**
 * Generic masking: show first `showFirst` and last `showLast` chars.
 * Everything in between is replaced with the mask character.
 */
export function maskGeneric(
  value: string,
  options: {
    showFirst?: number;
    showLast?: number;
    maskChar?: string;
  } = {},
): string {
  const { showFirst = 0, showLast = 4, maskChar = '*' } = options;
  if (value.length <= showFirst + showLast) return value;
  const start = value.slice(0, showFirst);
  const end = value.slice(-showLast);
  const middle = maskChar.repeat(value.length - showFirst - showLast);
  return `${start}${middle}${end}`;
}
