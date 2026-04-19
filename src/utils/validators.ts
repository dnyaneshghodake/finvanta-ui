/**
 * Validator utility functions for CBS Banking Application
 * @file src/utils/validators.ts
 */

/**
 * Validate email format
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate Indian phone number (10 digits)
 */
export const validatePhoneNumber = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10 && /^[6-9]/.test(cleaned);
};

/**
 * Validate PAN format: AAAAA1234A
 */
export const validatePAN = (pan: string): boolean => {
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test(pan.toUpperCase());
};

/**
 * Validate Aadhar number (12 digits)
 */
export const validateAadhar = (aadhar: string): boolean => {
  const cleaned = aadhar.replace(/\D/g, '');
  return cleaned.length === 12;
};

/**
 * Validate IFSC code format: ABCD0123456
 */
export const validateIFSC = (ifsc: string): boolean => {
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  return ifscRegex.test(ifsc.toUpperCase());
};

/**
 * Validate CBS account number.
 *
 * Finvanta uses a composite alphanumeric key shaped
 * `<product>-<branchSol>-<serial>` (e.g. SB-HQ001-000001). The
 * pattern mirrors the Zod schema on the transfer form and the
 * AccountNo CBS primitive: `[A-Z0-9][A-Z0-9-]{5,24}`.
 */
export const validateAccountNumber = (accountNumber: string): boolean => {
  return /^[A-Z0-9][A-Z0-9-]{5,24}$/.test(accountNumber.toUpperCase());
};

/**
 * Validate password strength
 * Requirements: at least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
 */
export const validatePasswordStrength = (password: string): {
  isValid: boolean;
  strength: 'weak' | 'medium' | 'strong';
  feedback: string[];
} => {
  const feedback: string[] = [];

  if (password.length < 8) {
    feedback.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    feedback.push('Include at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    feedback.push('Include at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    feedback.push('Include at least one number');
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    feedback.push('Include at least one special character');
  }

  const isValid = feedback.length === 0;

  // Strength is derived from BOTH length AND policy compliance.
  // A long password that fails policy checks is not "strong".
  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  if (isValid) {
    strength = password.length >= 12 ? 'strong' : 'medium';
  }

  return {
    isValid,
    strength,
    feedback,
  };
};

/**
 * Validate amount (must be positive number)
 */
export const validateAmount = (amount: string | number, minAmount: number = 1, maxAmount: number = 100000000): boolean => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return !isNaN(num) && num >= minAmount && num <= maxAmount;
};

/**
 * Validate date format (YYYY-MM-DD)
 */
export const validateDateFormat = (date: string): boolean => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;
  
  const d = new Date(date);
  return d instanceof Date && !isNaN(d.getTime());
};

/**
 * Validate that date of birth is valid (age >= 18 and <= 120).
 *
 * Uses precise month/day comparison — a naive year-difference would
 * accept a 17-year-old born late in the year (KYC compliance issue).
 */
export const validateDateOfBirth = (dob: string): boolean => {
  if (!validateDateFormat(dob)) return false;
  
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age >= 18 && age <= 120;
};

/**
 * Validate URL format
 */
export const validateURL = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate that two values match (for confirm password, etc.)
 */
export const validateMatch = (value1: string, value2: string): boolean => {
  return value1 === value2;
};

/**
 * Validate that required field is not empty
 */
export const validateRequired = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

/**
 * Validate GSTIN format: 15 alphanumeric characters
 */
export const validateGSTIN = (gstin: string): boolean => {
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin.toUpperCase());
};

/**
 * Validate minimum length
 */
export const validateMinLength = (value: string, minLength: number): boolean => {
  return value.length >= minLength;
};

/**
 * Validate maximum length
 */
export const validateMaxLength = (value: string, maxLength: number): boolean => {
  return value.length <= maxLength;
};

/**
 * Generic validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate multiple conditions
 */
export const validateMultiple = (validations: { isValid: boolean; error?: string }[]): ValidationResult => {
  const errors = validations.filter(v => !v.isValid).map(v => v.error || 'Validation failed').filter(Boolean);
  return {
    isValid: errors.length === 0,
    errors,
  };
};
