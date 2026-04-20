/**
 * Domain modules barrel — CBS domain-bounded module pattern.
 * @file src/modules/index.ts
 *
 * Tier-1 CBS convention (Finacle / T24 / Flexcube): code is organised
 * by banking domain, not by technical layer. Each module groups its
 * types, services, store, and security guards together.
 *
 * Usage:
 *   import { accountService, type Account } from '@/modules/deposits';
 *   import { authService, useAuthStore, hasRole } from '@/modules/auth';
 *   import { operatorService, type Branch } from '@/modules/admin';
 *   import { workflowService, type WorkflowItem } from '@/modules/workflow';
 */

export * from './auth';
export * from './deposits';
export * from './admin';
export * from './workflow';
