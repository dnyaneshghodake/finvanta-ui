/**
 * FINVANTA CBS — Customer CIF client (browser-side).
 *
 * Maps 1:1 to Spring `CustomerApiController` at `/v1/customers/**`.
 * Every call routes through the BFF at `/api/cbs/**` which injects the
 * server-side JWT, tenant, branch, correlation id and double-submit
 * CSRF header (see src/lib/server/proxy.ts).
 *
 * Spring envelope is `{ status: "SUCCESS" | "ERROR", data, errorCode,
 * message, timestamp }`. This client normalises it to the UI's
 * `ApiResponse<T>` (`{ success, data, error, timestamp, requestId }`)
 * so the existing Zustand stores and presentation components keep
 * working without change.
 *
 * Per CIF_API_CONTRACT.md v2.0:
 *   - POST   /customers           → Create CIF (MAKER, ADMIN)
 *   - GET    /customers/{id}      → CIF Lookup — audit-logged (MAKER, CHECKER, ADMIN)
 *   - PUT    /customers/{id}      → Update mutable fields (MAKER, ADMIN)
 *   - POST   /customers/{id}/verify-kyc → KYC verification (CHECKER, ADMIN)
 *   - POST   /customers/{id}/deactivate → Deactivate CIF (ADMIN)
 *   - GET    /customers/search?q= → Search — branch-scoped (MAKER, CHECKER, ADMIN)
 *
 * Regulatory: RBI KYC MD 2016, PMLA 2002, CERSAI CKYC v2.0, FATCA IGA
 *
 * @file src/services/api/customerService.ts
 */
import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';
import type {
  CreateCustomerRequest,
  CustomerResponse,
} from '@/types/customer.types';
import type { CifCustomer } from '@/components/cbs/CifLookup';

/* ── Spring Envelope ────────────────────────────────────────────── */

interface SpringEnvelope<T> {
  status: 'SUCCESS' | 'ERROR';
  data?: T;
  errorCode?: string;
  message?: string;
  error?: string;
  meta?: {
    apiVersion?: string;
    correlationId?: string;
    timestamp?: string;
  };
}

/* ── Envelope Helpers ───────────────────────────────────────────── */

function okEnvelope<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    requestId: '',
  };
}

function errEnvelope<T>(code: string, message: string, status: number): ApiResponse<T> {
  return {
    success: false,
    error: { code, message, statusCode: status },
    timestamp: new Date().toISOString(),
    requestId: '',
  };
}

/**
 * Normalise a Spring ApiResponse<T> body to a UI ApiResponse<T>.
 * Success flag is derived from Spring's `status` discriminator.
 */
function adapt<TSpring, TUi>(
  body: SpringEnvelope<TSpring>,
  mapper: (d: TSpring) => TUi,
): ApiResponse<TUi> {
  if (body.status === 'SUCCESS' && body.data != null) {
    return okEnvelope(mapper(body.data));
  }
  // Read from `message` first (Spring's descriptive error), then `error`
  // (HTTP reason phrase like "Bad Request"), then fallback. Some backend
  // endpoints put the meaningful text in `error` instead of `message`.
  return errEnvelope(body.errorCode || 'UNKNOWN', body.message || body.error || 'Request failed', 400);
}

/**
 * Propagate correlation ID from Spring v3.0 envelope `meta` block
 * or from response headers (fallback for v2.x envelopes).
 */
function extractCorrelationId(
  envelope: SpringEnvelope<unknown>,
  headers?: Record<string, unknown>,
): string | undefined {
  return envelope.meta?.correlationId
    || (headers?.['x-correlation-id'] as string | undefined)
    || undefined;
}

/* ── Service ────────────────────────────────────────────────────── */

class CustomerService {
  /**
   * Create a new CIF.
   * Per CIF_API_CONTRACT.md §1 endpoint 1: `POST /customers`
   * Roles: MAKER, ADMIN.
   *
   * Accepts all 67 fields per the contract. The backend uses
   * `@JsonIgnoreProperties(ignoreUnknown = true)` so fields it
   * doesn't yet support are silently ignored.
   */
  async createCustomer(
    data: CreateCustomerRequest,
  ): Promise<ApiResponse<CustomerResponse>> {
    const response = await apiClient.post<SpringEnvelope<CustomerResponse>>(
      '/customers',
      data,
    );
    const result = adapt(response.data, (d) => d);
    const corrId = extractCorrelationId(response.data, response.headers);
    if (corrId) result.correlationId = corrId;
    return result;
  }

  /**
   * CIF Lookup — audit-logged.
   * Per CIF_API_CONTRACT.md §1 endpoint 2: `GET /customers/{id}`
   * Roles: MAKER, CHECKER, ADMIN.
   *
   * Returns CifLookupResponse (30 fields) optimised for the
   * frontend CifLookup.tsx widget. Field names match the
   * CifCustomer TypeScript interface.
   *
   * Every call is audit-logged via `AuditService.logEvent()`.
   */
  async getCustomer(
    id: string | number,
  ): Promise<ApiResponse<CifCustomer>> {
    const response = await apiClient.get<SpringEnvelope<CifCustomer>>(
      `/customers/${encodeURIComponent(String(id))}`,
    );
    const result = adapt(response.data, (d) => d);
    const corrId = extractCorrelationId(response.data, response.headers);
    if (corrId) result.correlationId = corrId;
    return result;
  }

  /**
   * Update mutable CIF fields.
   * Per CIF_API_CONTRACT.md §1 endpoint 3: `PUT /customers/{id}`
   * Roles: MAKER, ADMIN.
   *
   * PAN and Aadhaar are immutable after creation (§6). The backend
   * rejects attempts to change them with `IMMUTABLE_FIELD` (400).
   * The service-layer also silently skips them as a defence-in-depth.
   *
   * Uses Partial<CreateCustomerRequest> so callers can send only
   * the fields they want to update. `firstName`, `lastName`, and
   * `branchId` are required by the backend on every PUT.
   */
  async updateCustomer(
    id: string | number,
    data: Partial<CreateCustomerRequest> & {
      firstName: string;
      lastName: string;
      branchId: number;
    },
  ): Promise<ApiResponse<CustomerResponse>> {
    const response = await apiClient.put<SpringEnvelope<CustomerResponse>>(
      `/customers/${encodeURIComponent(String(id))}`,
      data,
    );
    const result = adapt(response.data, (d) => d);
    const corrId = extractCorrelationId(response.data, response.headers);
    if (corrId) result.correlationId = corrId;
    return result;
  }

  /**
   * KYC Verification — checker action.
   * Per CIF_API_CONTRACT.md §1 endpoint 4: `POST /customers/{id}/verify-kyc`
   * Roles: CHECKER, ADMIN.
   *
   * Self-verification is blocked: the same operator who created
   * the CIF cannot verify it (`SELF_VERIFY_PROHIBITED`, 403).
   */
  async verifyKyc(
    id: string | number,
  ): Promise<ApiResponse<CustomerResponse>> {
    const response = await apiClient.post<SpringEnvelope<CustomerResponse>>(
      `/customers/${encodeURIComponent(String(id))}/verify-kyc`,
    );
    const result = adapt(response.data, (d) => d);
    const corrId = extractCorrelationId(response.data, response.headers);
    if (corrId) result.correlationId = corrId;
    return result;
  }

  /**
   * Deactivate CIF — admin-only.
   * Per CIF_API_CONTRACT.md §1 endpoint 5: `POST /customers/{id}/deactivate`
   * Roles: ADMIN only.
   *
   * Blocked if customer has active loans (`CUSTOMER_HAS_ACTIVE_LOANS`)
   * or non-closed CASA accounts (`CUSTOMER_HAS_ACTIVE_DEPOSITS`).
   */
  async deactivateCustomer(
    id: string | number,
  ): Promise<ApiResponse<CustomerResponse>> {
    const response = await apiClient.post<SpringEnvelope<CustomerResponse>>(
      `/customers/${encodeURIComponent(String(id))}/deactivate`,
    );
    const result = adapt(response.data, (d) => d);
    const corrId = extractCorrelationId(response.data, response.headers);
    if (corrId) result.correlationId = corrId;
    return result;
  }

  /**
   * Search customers — branch-scoped.
   * Per CIF_API_CONTRACT.md §1 endpoint 6 and §10:
   *   `GET /customers/search?q={query}`
   *
   * Search behavior:
   *   - Empty / < 2 chars: returns all active customers (branch-scoped)
   *   - PAN format (AAAAA0000A): SHA-256 hash lookup (exact match)
   *   - Otherwise: LIKE search on customer_number, first_name, last_name, mobile
   *   - ADMIN/AUDITOR: sees all branches
   *   - MAKER/CHECKER: sees own branch only
   */
  async searchCustomers(
    query: string,
  ): Promise<ApiResponse<CustomerResponse[]>> {
    const response = await apiClient.get<SpringEnvelope<CustomerResponse[]>>(
      '/customers/search',
      { params: { q: query } },
    );
    const result = adapt(response.data, (d) => d);
    const corrId = extractCorrelationId(response.data, response.headers);
    if (corrId) result.correlationId = corrId;
    return result;
  }
}

export const customerService = new CustomerService();
