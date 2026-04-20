/**
 * FINVANTA CBS Maker-Checker Workflow client.
 *
 * Maps to Spring `/v1/workflow/*` (approvals, rejections, recalls).
 * Every mutation is guarded by @Version optimistic locking on the
 * backend; a stale version triggers a 409 VERSION_CONFLICT which the
 * UI surfaces verbatim so the maker can refresh and retry.
 *
 * Self-approval is prevented server-side; the UI disables the
 * Approve/Reject buttons when `allowedActions[]` does not include them.
 */
import { apiClient } from './apiClient';
import type { ApiResponse, PaginatedResponse } from '@/types/api';

/**
 * WorkflowResponse — per API_REFERENCE.md §15 (15 fields).
 *
 * Field naming: the backend returns `makerUserId` / `checkerUserId`
 * (per API §15 Response — Users). We alias `makerId` / `checkerId`
 * for backward compat with the workflow page, and map from either
 * shape in the BFF response.
 */
export interface WorkflowItem {
  id: number;
  entityType: string;
  entityId: string | number;
  /** Per API §15: `actionType` — the operation being approved. */
  action: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'RECALLED';
  // ── Users (per API §15 Response — Users) ──
  /** Backend field: `makerUserId`. */
  makerId: string;
  makerName?: string;
  /** Backend field: `checkerUserId`. */
  checkerId?: string;
  checkerName?: string;
  // ── Remarks (per API §15 Response — Remarks) ──
  makerRemarks?: string;
  checkerRemarks?: string;
  /** Legacy alias — maps to makerRemarks for backward compat. */
  remarks?: string;
  // ── Timestamps (per API §15 Response — Timestamps) ──
  submittedAt: string;
  /** Backend field: `actionedAt`. */
  decidedAt?: string;
  // ── SLA (per API §15 Response — SLA) ──
  slaBreached?: boolean;
  slaDeadline?: string;
  escalationCount?: number;
  escalatedTo?: string;
  // ── Client-side extras ──
  version: number;
  allowedActions?: Array<'APPROVE' | 'REJECT' | 'RECALL'>;
  payloadSummary?: Record<string, string | number | boolean | null>;
  auditHashPrefix?: string;
}

export interface DecisionRequest {
  id: number;
  version: number;
  remarks?: string;
}

class WorkflowService {
  async listPending(params?: { page?: number; size?: number; entityType?: string }) {
    const res = await apiClient.get<ApiResponse<PaginatedResponse<WorkflowItem>>>(
      '/workflow/pending',
      { params },
    );
    return res.data;
  }

  async listMine(params?: { page?: number; size?: number }) {
    const res = await apiClient.get<ApiResponse<PaginatedResponse<WorkflowItem>>>(
      '/workflow/mine',
      { params },
    );
    return res.data;
  }

  async get(id: number) {
    const res = await apiClient.get<ApiResponse<WorkflowItem>>(`/workflow/${id}`);
    return res.data;
  }

  async approve(req: DecisionRequest) {
    const res = await apiClient.post<ApiResponse<WorkflowItem>>(
      `/workflow/${req.id}/approve`,
      { version: req.version, remarks: req.remarks },
    );
    return res.data;
  }

  async reject(req: DecisionRequest) {
    const res = await apiClient.post<ApiResponse<WorkflowItem>>(
      `/workflow/${req.id}/reject`,
      { version: req.version, remarks: req.remarks },
    );
    return res.data;
  }

  async recall(req: DecisionRequest) {
    const res = await apiClient.post<ApiResponse<WorkflowItem>>(
      `/workflow/${req.id}/recall`,
      { version: req.version, remarks: req.remarks },
    );
    return res.data;
  }

  /**
   * Per API_REFERENCE.md §15 endpoint 70:
   * GET /workflow/sla-breached — SLA-breached workflows (ADMIN only).
   */
  async listSlaBreached(params?: { page?: number; size?: number }) {
    const res = await apiClient.get<ApiResponse<PaginatedResponse<WorkflowItem>>>(
      '/workflow/sla-breached',
      { params },
    );
    return res.data;
  }

  /**
   * Per API_REFERENCE.md §15 endpoint 73:
   * POST /workflow/escalate — Escalate all SLA-breached workflows to ADMIN.
   */
  async escalate() {
    const res = await apiClient.post<ApiResponse<{ escalatedCount: number }>>(
      '/workflow/escalate',
    );
    return res.data;
  }

  /**
   * Per API_REFERENCE.md §15 endpoint 69:
   * GET /workflow/history/{entityType}/{entityId} — Workflow history.
   */
  async getHistory(entityType: string, entityId: string) {
    const res = await apiClient.get<ApiResponse<WorkflowItem[]>>(
      `/workflow/history/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`,
    );
    return res.data;
  }
}

export const workflowService = new WorkflowService();
