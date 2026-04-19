/**
 * Maker-Checker workflow types for CBS Banking Application
 * @file src/types/workflow.ts
 *
 * State machine: DRAFT → SUBMITTED → VERIFIED → APPROVED | REJECTED
 *
 * Tier-1 CBS requirements enforced:
 * - Self-approval prevention (maker !== checker)
 * - Mandatory rejection reason
 * - Optimistic locking via version field
 * - Immutable audit trail
 */

/**
 * Workflow status — state machine states
 */
export type WorkflowStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

/**
 * Workflow action — transitions between states
 */
export type WorkflowAction =
  | 'SUBMIT'
  | 'VERIFY'
  | 'APPROVE'
  | 'REJECT'
  | 'CANCEL'
  | 'RETURN_TO_MAKER';

/**
 * Workflow record — attached to any entity requiring maker-checker
 */
export interface WorkflowRecord {
  id: string;
  entityType: string;
  entityId: string;
  status: WorkflowStatus;
  version: number; // Optimistic locking

  // Maker details
  makerId: string;
  makerName: string;
  makerBranch: string;
  madeAt: string;

  // Checker details (populated after verification/approval)
  checkerId?: string;
  checkerName?: string;
  checkerBranch?: string;
  checkedAt?: string;

  // Approver details (for multi-level approval)
  approverId?: string;
  approverName?: string;
  approvedAt?: string;

  // Rejection
  rejectionReason?: string;
  rejectedBy?: string;
  rejectedAt?: string;

  // Audit
  auditHash?: string; // SHA-256 hash for immutable audit chain
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Workflow action request — sent to backend for state transition
 */
export interface WorkflowActionRequest {
  action: WorkflowAction;
  entityId: string;
  entityType: string;
  version: number; // Must match current version (optimistic lock)
  remarks?: string;
  rejectionReason?: string; // Required when action = REJECT
}

/**
 * Workflow queue item — displayed in the checker's queue
 */
export interface WorkflowQueueItem {
  id: string;
  entityType: string;
  entityId: string;
  entityDescription: string;
  status: WorkflowStatus;
  makerName: string;
  makerBranch: string;
  madeAt: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  amount?: number;
  currency?: string;
}

/**
 * Allowed transitions map — which actions are valid from each state
 */
export const WORKFLOW_TRANSITIONS: Record<WorkflowStatus, WorkflowAction[]> = {
  DRAFT: ['SUBMIT', 'CANCEL'],
  SUBMITTED: ['VERIFY', 'REJECT', 'RETURN_TO_MAKER'],
  PENDING_VERIFICATION: ['VERIFY', 'REJECT', 'RETURN_TO_MAKER'],
  VERIFIED: ['APPROVE', 'REJECT'],
  PENDING_APPROVAL: ['APPROVE', 'REJECT'],
  APPROVED: [],
  REJECTED: [],
  CANCELLED: [],
};

/**
 * Check if a workflow action is valid for the current status
 */
export const isValidTransition = (
  currentStatus: WorkflowStatus,
  action: WorkflowAction
): boolean => {
  return WORKFLOW_TRANSITIONS[currentStatus]?.includes(action) ?? false;
};
