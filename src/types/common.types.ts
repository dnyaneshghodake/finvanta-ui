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
