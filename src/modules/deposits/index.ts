/**
 * Deposits (CASA) domain module — co-located exports.
 * @file src/modules/deposits/index.ts
 *
 * CBS domain-bounded module pattern (Finacle CASA / T24 AC):
 * Groups all deposits-related types, services, and components
 * under a single import surface.
 *
 * Usage:
 *   import { accountService, type Account, type Transaction } from '@/modules/deposits';
 */

// Types
export type { Account, Transaction } from '@/types/deposits.types';

// Services
export { accountService } from '@/services/api/accountService';
export { transferService } from '@/services/api/transferService';
export type { TransferRequest, TransferResponse } from '@/services/api/transferService';
