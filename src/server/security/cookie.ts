import { cookies } from 'next/headers';
import { encryptSession, decryptSession } from './encryption';

const SESSION_COOKIE_NAME = '__session';
const REFRESH_COOKIE_NAME = '__refresh';
const SESSION_MAX_AGE = 3600;
const REFRESH_MAX_AGE = 604800;

export interface SessionData {
  accessToken: string;
  refreshToken: string;
  tenantId: string;
  role: string;
  permissions: string[];
  exp: number;
}

export async function setSessionCookie(data: SessionData): Promise<void> {
  const cookieStore = await cookies();
  
  const payload = JSON.stringify({
    accessToken: data.accessToken,
    tenantId: data.tenantId,
    role: data.role,
    permissions: data.permissions,
    exp: data.exp,
  });
  
  const encrypted = encryptSession(payload);
  
  cookieStore.set(SESSION_COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
  
  cookieStore.set(REFRESH_COOKIE_NAME, data.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REFRESH_MAX_AGE,
    path: '/',
  });
}

export async function getSessionCookie(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const encrypted = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  
  if (!encrypted) return null;
  
  const decrypted = decryptSession(encrypted);
  if (!decrypted) return null;
  
  try {
    const parsed = JSON.parse(decrypted);
    return parsed as SessionData;
  } catch {
    return null;
  }
}

export async function getRefreshToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(REFRESH_COOKIE_NAME)?.value || null;
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(REFRESH_COOKIE_NAME);
}

export function getSessionCookieHeaders(data: SessionData): string {
  const payload = JSON.stringify({
    accessToken: data.accessToken,
    tenantId: data.tenantId,
    role: data.role,
    permissions: data.permissions,
    exp: data.exp,
  });
  
  const encrypted = encryptSession(payload);
  
  const sessionAttr = `__session=${encrypted}; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}; Path=/`;
  const refreshAttr = `__refresh=${data.refreshToken}; HttpOnly; Secure; SameSite=Lax; Max-Age=${REFRESH_MAX_AGE}; Path=/`;
  
  return `${sessionAttr}, ${refreshAttr}`;
}