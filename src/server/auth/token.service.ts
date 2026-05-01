import { api } from '../http/api-client';

export interface TokenPayload {
  sub: string;
  tenantId: string;
  role: string;
  permissions: string[];
  exp: number;
  iat: number;
}

export interface LoginCredentials {
  username: string;
  password: string;
  tenantId?: string;
  mfaCode?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    permissions: string[];
    tenantId: string;
    tenantName?: string;
  };
  requiresMfa?: boolean;
  mfaToken?: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

const TOKEN_BUFFER_SECONDS = 30;

export async function loginService(credentials: LoginCredentials): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/auth/login', credentials);
  
  if (response.error) {
    throw new Error(response.error.message);
  }
  
  if (!response.data) {
    throw new Error('Invalid response from auth service');
  }
  
  return response.data;
}

export async function refreshTokenService(refreshToken: string): Promise<RefreshResponse> {
  const response = await api.post<RefreshResponse>('/auth/refresh', { refreshToken }, { skipAuth: true });
  
  if (response.error) {
    throw new Error(response.error.message);
  }
  
  if (!response.data) {
    throw new Error('Invalid response from auth service');
  }
  
  return response.data;
}

export async function verifyMfaService(mfaToken: string, mfaCode: string): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/auth/mfa/verify', { mfaToken, mfaCode });
  
  if (response.error) {
    throw new Error(response.error.message);
  }
  
  if (!response.data) {
    throw new Error('Invalid response from auth service');
  }
  
  return response.data;
}

export async function logoutService(): Promise<void> {
  await api.post('/auth/logout');
}

export function isTokenExpiringSoon(expiresAt: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return expiresAt - now < TOKEN_BUFFER_SECONDS;
}

export function getTokenExpiration(expiresIn: number): number {
  return Math.floor(Date.now() / 1000) + expiresIn;
}