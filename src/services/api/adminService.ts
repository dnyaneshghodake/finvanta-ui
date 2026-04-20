/**
 * FINVANTA CBS — Admin API client (browser-side).
 *
 * Maps to Spring `/v1/admin/**` endpoints for operator provisioning,
 * branch management, holiday calendar, and tenant configuration.
 * Every call routes through the BFF at `/api/cbs/**` which injects
 * server-side JWT, tenant, branch, correlation-id, and CSRF headers.
 *
 * All admin mutations are subject to maker-checker governance on the
 * backend. The UI only surfaces what the backend authorises via the
 * operator's role and branch context.
 *
 * @file src/services/api/adminService.ts
 */
import { apiClient } from './apiClient';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type {
  Operator,
  Branch,
  Holiday,
  Tenant,
} from '@/types/entities';

// ── Spring envelope adapter (same pattern as accountService) ───────

interface SpringEnvelope<T> {
  status: 'SUCCESS' | 'ERROR';
  data?: T;
  errorCode?: string;
  message?: string;
  timestamp?: string;
}

interface SpringPage<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
}

function okEnvelope<T>(data: T): ApiResponse<T> {
  return { success: true, data, timestamp: new Date().toISOString(), requestId: '' };
}

function errEnvelope<T>(code: string, message: string, status: number): ApiResponse<T> {
  return {
    success: false,
    error: { code, message, statusCode: status },
    timestamp: new Date().toISOString(),
    requestId: '',
  };
}

function adaptPage<T>(
  body: SpringEnvelope<SpringPage<T>>,
): ApiResponse<PaginatedResponse<T>> {
  if (body.status === 'SUCCESS' && body.data) {
    const d = body.data;
    const totalPages = d.size > 0 ? Math.max(1, Math.ceil(d.totalElements / d.size)) : 1;
    const uiPage = d.page + 1;
    return okEnvelope({
      items: d.content,
      total: d.totalElements,
      page: uiPage,
      pageSize: d.size,
      totalPages,
      hasNextPage: uiPage < totalPages,
      hasPreviousPage: uiPage > 1,
    });
  }
  return errEnvelope(body.errorCode || 'UNKNOWN', body.message || 'Request failed', 400);
}

function adaptSingle<T>(body: SpringEnvelope<T>): ApiResponse<T> {
  // Use loose inequality (`!= null`) so both `null` and `undefined`
  // are rejected. Spring can return `"data": null` on empty results
  // and `null !== undefined` is `true` — same fix as accountService.ts.
  if (body.status === 'SUCCESS' && body.data != null) {
    return okEnvelope(body.data);
  }
  // For void operations (DELETE), Spring returns {status:"SUCCESS", data:null}.
  // Treat SUCCESS with null data as a successful void response rather than
  // an error — otherwise HolidayService.remove() always reports failure.
  if (body.status === 'SUCCESS') {
    return okEnvelope(null as unknown as T);
  }
  return errEnvelope(body.errorCode || 'UNKNOWN', body.message || 'Request failed', 400);
}

// ── Operator (User) Management ─────────────────────────────────────

class OperatorService {
  async list(params?: { page?: number; size?: number; status?: string; branchCode?: string }) {
    const res = await apiClient.get<SpringEnvelope<SpringPage<Operator>>>(
      '/admin/users',
      { params },
    );
    return adaptPage(res.data);
  }

  async get(id: number) {
    const res = await apiClient.get<SpringEnvelope<Operator>>(`/admin/users/${id}`);
    return adaptSingle(res.data);
  }

  async create(data: {
    username: string;
    firstName: string;
    lastName: string;
    email?: string;
    roles: string[];
    branchCode: string;
    password: string;
  }) {
    const res = await apiClient.post<SpringEnvelope<Operator>>('/admin/users', data);
    return adaptSingle(res.data);
  }

  async update(id: number, data: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    roles: string[];
    branchCode: string;
    status: string;
  }>) {
    const res = await apiClient.put<SpringEnvelope<Operator>>(`/admin/users/${id}`, data);
    return adaptSingle(res.data);
  }

  async resetPassword(id: number) {
    const res = await apiClient.post<SpringEnvelope<{ temporaryPassword: string }>>(
      `/admin/users/${id}/reset-password`,
    );
    return adaptSingle(res.data);
  }

  async toggleLock(id: number, lock: boolean) {
    const res = await apiClient.post<SpringEnvelope<Operator>>(
      `/admin/users/${id}/${lock ? 'lock' : 'unlock'}`,
    );
    return adaptSingle(res.data);
  }
}

// ── Branch Management ──────────────────────────────────────────────

class BranchService {
  async list(params?: { page?: number; size?: number; status?: string }) {
    const res = await apiClient.get<SpringEnvelope<SpringPage<Branch>>>(
      '/admin/branches',
      { params },
    );
    return adaptPage(res.data);
  }

  async get(id: number) {
    const res = await apiClient.get<SpringEnvelope<Branch>>(`/admin/branches/${id}`);
    return adaptSingle(res.data);
  }

  async create(data: Partial<Branch>) {
    const res = await apiClient.post<SpringEnvelope<Branch>>('/admin/branches', data);
    return adaptSingle(res.data);
  }

  async update(id: number, data: Partial<Branch>) {
    const res = await apiClient.put<SpringEnvelope<Branch>>(`/admin/branches/${id}`, data);
    return adaptSingle(res.data);
  }
}

// ── Holiday Calendar ───────────────────────────────────────────────

class HolidayService {
  async list(params?: { year?: number; page?: number; size?: number }) {
    const res = await apiClient.get<SpringEnvelope<SpringPage<Holiday>>>(
      '/admin/calendar/holidays',
      { params },
    );
    return adaptPage(res.data);
  }

  async create(data: Partial<Holiday>) {
    const res = await apiClient.post<SpringEnvelope<Holiday>>('/admin/calendar/holidays', data);
    return adaptSingle(res.data);
  }

  async remove(id: number) {
    const res = await apiClient.delete<SpringEnvelope<null>>(`/admin/calendar/holidays/${id}`);
    return adaptSingle(res.data);
  }
}

// ── Tenant Configuration ───────────────────────────────────────────

class TenantService {
  async getCurrent() {
    const res = await apiClient.get<SpringEnvelope<Tenant>>('/admin/tenant');
    return adaptSingle(res.data);
  }

  async update(data: Partial<Tenant>) {
    const res = await apiClient.put<SpringEnvelope<Tenant>>('/admin/tenant', data);
    return adaptSingle(res.data);
  }
}

// ── Exports ────────────────────────────────────────────────────────

export const operatorService = new OperatorService();
export const branchService = new BranchService();
export const holidayService = new HolidayService();
export const tenantService = new TenantService();
