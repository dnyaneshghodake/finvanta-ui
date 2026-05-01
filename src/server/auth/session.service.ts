import { cookies } from 'next/headers';
import { encryptSession, decryptSession } from '../security/encryption';

export interface Session {
  userId: string;
  username: string;
  email: string;
  tenantId: string;
  role: string;
  permissions: string[];
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  createdAt: number;
  lastAccessedAt: number;
}

export interface SessionMetadata {
  sessionId: string;
  deviceId: string;
  ipAddress: string;
  userAgent: string;
  lastActivity: number;
}

const SESSION_COOKIE = '__session';
const REFRESH_COOKIE = '__refresh';
const SESSION_MAX_AGE = 3600;
const REFRESH_MAX_AGE = 604800;

function generateSessionId(): string {
  return crypto.randomUUID();
}

function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

export async function createSession(
  userId: string,
  username: string,
  email: string,
  tenantId: string,
  role: string,
  permissions: string[],
  accessToken: string,
  refreshToken: string,
  expiresIn: number
): Promise<Session> {
  const now = getCurrentTimestamp();
  
  const session: Session = {
    userId,
    username,
    email,
    tenantId,
    role,
    permissions,
    accessToken,
    refreshToken,
    expiresAt: now + expiresIn,
    createdAt: now,
    lastAccessedAt: now,
  };

  const encrypted = encryptSession(JSON.stringify(session));
  
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });

  cookieStore.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REFRESH_MAX_AGE,
    path: '/',
  });

  return session;
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const encrypted = cookieStore.get(SESSION_COOKIE)?.value;
  
  if (!encrypted) return null;
  
  const decrypted = decryptSession(encrypted);
  if (!decrypted) return null;
  
  try {
    const session = JSON.parse(decrypted) as Session;
    
    if (getCurrentTimestamp() >= session.expiresAt) {
      await destroySession();
      return null;
    }
    
    return session;
  } catch {
    return null;
  }
}

export async function updateSessionAccess(session: Session): Promise<void> {
  const now = getCurrentTimestamp();
  session.lastAccessedAt = now;
  
  const encrypted = encryptSession(JSON.stringify(session));
  
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(REFRESH_COOKIE);
}

export async function validateSession(): Promise<boolean> {
  const session = await getSession();
  return session !== null && getCurrentTimestamp() < session.expiresAt;
}

export async function hasPermission(permission: string): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  return session.permissions.includes(permission);
}

export async function hasRole(role: string): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  return session.role === role;
}

export async function hasAnyRole(roles: string[]): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  return roles.includes(session.role);
}