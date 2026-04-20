/**
 * Maker-Checker Workflow domain module — co-located exports.
 * @file src/modules/workflow/index.ts
 *
 * CBS domain-bounded module pattern: Groups workflow types and
 * services for the maker-checker approval pipeline.
 *
 * Usage:
 *   import { workflowService, type WorkflowItem } from '@/modules/workflow';
 */

// Services + types
export {
  workflowService,
  type WorkflowItem,
  type DecisionRequest,
} from '@/services/api/workflowService';
