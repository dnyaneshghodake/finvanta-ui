import { cookies } from 'next/headers';

export interface TenantContext {
  id: string;
  name: string;
  schema: string;
  timezone: string;
  currency: string;
}

const TENANT_COOKIE_NAME = 'X-Tenant-Id';

export async function getTenantId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(TENANT_COOKIE_NAME)?.value || null;
}

export function validateTenantId(tenantId: string): boolean {
  const normalized = tenantId.replace(/[^a-zA-Z0-9_-]/g, '');
  return normalized.length > 0 && normalized.length <= 64;
}

export function sanitizeTenantId(tenantId: string): string {
  return tenantId.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 64);
}

export function getTenantHeaders(tenantId: string): Record<string, string> {
  return {
    'X-Tenant-Id': sanitizeTenantId(tenantId),
    'X-Tenant-Schema': `tenant_${sanitizeTenantId(tenantId)}`,
  };
}