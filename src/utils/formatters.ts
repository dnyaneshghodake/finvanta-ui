/**
 * Formatter utility functions for CBS Banking Application
 * @file src/utils/formatters.ts
 */

import { format, parseISO } from 'date-fns';
import { enIN } from 'date-fns/locale';

/**
 * Format date to readable string
 */
export const formatDate = (date: string | Date, dateFormat: string = 'dd/MM/yyyy'): string => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, dateFormat, { locale: enIN });
  } catch {
    return '-';
  }
};

/**
 * Format date with time
 */
export const formatDateTime = (date: string | Date, dateTimeFormat: string = 'dd/MM/yyyy HH:mm'): string => {
  return formatDate(date, dateTimeFormat);
};

/**
 * Format currency to Indian Rupee format
 */
export const formatCurrency = (amount: number, currency: string = 'INR', decimals: number = 2): string => {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  } catch {
    return `${amount.toFixed(decimals)} ${currency}`;
  }
};

/**
 * Format large numbers with thousand separators
 */
export const formatNumber = (num: number, decimals: number = 0): string => {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

/**
 * Format phone number in Indian format: +91-XXXXX XXXXX
 */
export const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 10) return phone;
  
  const last10 = cleaned.slice(-10);
  const countryCode = cleaned.length > 10 ? '+' + cleaned.slice(0, -10) : '+91';
  
  return `${countryCode}-${last10.slice(0, 5)} ${last10.slice(5)}`;
};

/**
 * Format CBS account number for display.
 *
 * Finvanta uses composite alphanumeric keys (e.g. SB-HQ001-000001)
 * that already contain dashes as structural separators. These are
 * returned as-is. Only legacy digit-only account numbers (12+ chars)
 * are grouped into the traditional XXXX XX XXXXX format.
 */
export const formatAccountNumber = (accountNumber: string): string => {
  const cleaned = accountNumber.replace(/\s/g, '');
  // CBS alphanumeric keys already have structural separators — pass through.
  if (/[A-Za-z-]/.test(cleaned)) return cleaned;
  // Legacy digit-only format: group as XXXX XX XXXXX
  if (cleaned.length >= 12) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6)}`;
  }
  return accountNumber;
};

/**
 * Format PAN number: AAAAA1234A
 */
export const formatPANNumber = (pan: string): string => {
  return pan.toUpperCase().replace(/[^A-Z0-9]/g, '');
};

/**
 * Format Aadhar number: XXXX XXXX XXXX
 */
export const formatAadharNumber = (aadhar: string): string => {
  const cleaned = aadhar.replace(/\D/g, '');
  if (cleaned.length < 12) return aadhar;
  
  return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 8)} ${cleaned.slice(8)}`;
};

/**
 * Format IFSC code: ABCD0123456
 */
export const formatIFSCCode = (ifsc: string): string => {
  return ifsc.toUpperCase().replace(/[^A-Z0-9]/g, '');
};

/**
 * Format transaction ID for display
 */
export const formatTransactionId = (id: string): string => {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}...${id.slice(-6)}`;
};

/**
 * Format percentage
 */
export const formatPercentage = (percentage: number, decimals: number = 2): string => {
  return `${percentage.toFixed(decimals)}%`;
};

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text: string, maxLength: number = 50): string => {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
};

/**
 * Capitalize first letter
 */
export const capitalize = (text: string): string => {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

/**
 * Format transaction type for display
 */
export const formatTransactionType = (type: string): string => {
  const typeMap: Record<string, string> = {
    'DEBIT': 'Debit',
    'CREDIT': 'Credit',
    'TRANSFER': 'Transfer',
  };
  return typeMap[type] || type;
};

/**
 * Format transaction status for display
 */
export const formatTransactionStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    'PENDING': 'Pending',
    'COMPLETED': 'Completed',
    'FAILED': 'Failed',
    'REVERSED': 'Reversed',
  };
  return statusMap[status] || status;
};

/**
 * Format account type for display
 */
export const formatAccountType = (type: string): string => {
  const typeMap: Record<string, string> = {
    'SAVINGS': 'Savings Account',
    'CURRENT': 'Current Account',
    'SALARY': 'Salary Account',
  };
  return typeMap[type] || type;
};
