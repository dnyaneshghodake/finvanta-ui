/**
 * FINVANTA CBS Maker-Checker Workflow client.
 *
 * Maps to Spring `/api/v1/workflow/*` (approvals, rejections, recalls).
 * Every mutation is guarded by @Version optimistic locking on the
 * backend; a stale version triggers a 409 VERSION_CONFLICT which the
 * UI surfaces verbatim so the maker can refresh and retry.
 *
 * Self-approval is prevented server-side; the UI disables the
 * Approve/Reject buttons when `allowedActions[]` does not include them.
 */
import { apiClient } from './apiClient';
import type { ApiResponse, PaginatedResponse } from '@/types/api';

export interface WorkflowItem {
  id: number;
  entityType: string;
  entityId: string | number;
  action: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'RECALLED';
  makerId: string;
  makerName?: string;
  checkerId?: string;
  checkerName?: string;
  submittedAt: string;
  decidedAt?: string;
  remarks?: string;
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
}

export const workflowService = new WorkflowService();
