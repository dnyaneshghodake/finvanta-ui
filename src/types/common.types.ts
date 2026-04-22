/**
 * Common / shared types used across CBS domains.
 * @file src/types/common.types.ts
 *
 * Split from entities.ts per CBS domain-bounded module pattern.
 * Contains address, KYC/AML status, alerts, and dashboard summary.
 */

export interface Address {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  type: 'RESIDENTIAL' | 'OFFICE' | 'MAILING';
}

export type KYCStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
export type AMLStatus = 'PENDING' | 'APPROVED' | 'FLAGGED' | 'REJECTED';

export interface Alert {
  id: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

export interface DashboardSummary {
  totalBalance: number;
  accountsCount: number;
  recentTransactions: import('./deposits.types').Transaction[];
  alerts: Alert[];
}

/**
 * Business day context from Spring `data.businessDay`.
 *
 * Shared across authStore, authService, and the server-side session.
 * Previously duplicated in three files — consolidated here as the
 * single source of truth per CBS domain-bounded module pattern.
 */
export interface BusinessDay {
  businessDate: string;
  dayStatus: string;
  isHoliday: boolean;
  previousBusinessDate?: string;
  nextBusinessDate?: string;
}

/**
 * Operational config from Spring `data.operationalConfig`.
 *
 * Shared across authStore, authService, and the server-side session.
 */
export interface OperationalConfig {
  baseCurrency: string;
  decimalPrecision: number;
  roundingMode: string;
  fiscalYearStartMonth: number;
  businessDayPolicy: string;
}

export interface Beneficiary {
  id: string;
  customerId: string;
  name: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  isInternal: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}
