import { cookies } from 'next/headers';
import { type HttpClientResponse, type HttpClientOptions } from './http-client';
import { httpClient } from './http-client';

const BACKEND_URL = process.env.BACKEND_API_URL || 'http://localhost:8080';
const API_VERSION = 'v1';

export interface ApiClientOptions extends HttpClientOptions {
  tenantId?: string;
  skipAuth?: boolean;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  
  if (!sessionCookie) return null;
  
  try {
    const decoded = Buffer.from(sessionCookie, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    return parsed.accessToken || null;
  } catch {
    return null;
  }
}

async function getTenantId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('X-Tenant-Id')?.value || null;
}

export async function apiClient<T = unknown>(
  endpoint: string,
  options: ApiClientOptions = {}
): Promise<HttpClientResponse<T>> {
  const {
    tenantId: providedTenantId,
    skipAuth = false,
    headers = {},
    ...rest
  } = options;

  const authToken = skipAuth ? null : await getAccessToken();
  const tenantId = providedTenantId || await getTenantId();

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (authToken && !skipAuth) {
    requestHeaders['Authorization'] = `Bearer ${authToken}`;
  }

  if (tenantId) {
    requestHeaders['X-Tenant-Id'] = tenantId;
    requestHeaders['X-Tenant-Schema'] = `tenant_${tenantId}`;
  }

  requestHeaders['X-Request-ID'] = crypto.randomUUID();
  requestHeaders['X-Correlation-ID'] = requestHeaders['X-Correlation-ID'] || crypto.randomUUID();

  const fullEndpoint = endpoint.startsWith('http')
    ? endpoint
    : `${BACKEND_URL}/api/${API_VERSION}${endpoint}`;

  let response = await httpClient.request<T>(fullEndpoint, {
    ...rest,
    headers: requestHeaders,
  });

  if (response.status === 401 && !skipAuth && response.error?.code === 'UNAUTHORIZED' && rest.retryOnUnauthorized !== false) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      requestHeaders['Authorization'] = `Bearer ${refreshed}`;
      response = await httpClient.request<T>(fullEndpoint, {
        ...rest,
        headers: requestHeaders,
      });
    }
  }

  return response;
}

async function refreshAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('__refresh')?.value;
  
  if (!refreshToken) return null;
  
  try {
    const response = await httpClient.post<TokenResponse>('/api/v1/auth/refresh', {
      refreshToken,
    });
    
    if (response.data?.accessToken) {
      return response.data.accessToken;
    }
  } catch {
    // Silent failure
  }
  
  return null;
}

export const api = {
  get: <T = unknown>(endpoint: string, options?: ApiClientOptions) => 
    apiClient<T>(endpoint, { ...options, method: 'GET' }),
  
  post: <T = unknown>(endpoint: string, body?: unknown, options?: ApiClientOptions) => 
    apiClient<T>(endpoint, { 
      ...options, 
      method: 'POST', 
      body: body ? JSON.stringify(body) as unknown as BodyInit : undefined 
    }),
  
  put: <T = unknown>(endpoint: string, body?: unknown, options?: ApiClientOptions) => 
    apiClient<T>(endpoint, { 
      ...options, 
      method: 'PUT', 
      body: body ? JSON.stringify(body) as unknown as BodyInit : undefined 
    }),
  
  patch: <T = unknown>(endpoint: string, body?: unknown, options?: ApiClientOptions) => 
    apiClient<T>(endpoint, { 
      ...options, 
      method: 'PATCH', 
      body: body ? JSON.stringify(body) as unknown as BodyInit : undefined 
    }),
  
  delete: <T = unknown>(endpoint: string, options?: ApiClientOptions) => 
    apiClient<T>(endpoint, { ...options, method: 'DELETE' }),
};