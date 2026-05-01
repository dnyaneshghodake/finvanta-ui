import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

function getKey(secret: string): Buffer {
  const salt = Buffer.alloc(SALT_LENGTH, 'finvanta-salt-v1');
  return scryptSync(secret, salt, KEY_LENGTH);
}

export function encryptSession(payload: string): string {
  const secret = process.env.SESSION_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || 'default-dev-secret-change-in-prod';
  const key = getKey(secret);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([cipher.update(payload, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptSession(encryptedData: string): string | null {
  try {
    const secret = process.env.SESSION_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || 'default-dev-secret-change-in-prod';
    const key = getKey(secret);
    const raw = Buffer.from(encryptedData, 'base64');
    
    const iv = raw.subarray(0, IV_LENGTH);
    const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = raw.subarray(IV_LENGTH + TAG_LENGTH);
    
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    return decipher.update(encrypted) + decipher.final('utf-8');
  } catch {
    return null;
  }
}

export function createSessionPayload(data: {
  accessToken: string;
  refreshToken: string;
  tenantId: string;
  role: string;
  expiresAt: number;
}): string {
  const payload = JSON.stringify({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    tenantId: data.tenantId,
    role: data.role,
    exp: data.expiresAt,
  });
  return encryptSession(payload);
}

export interface DecodedSession {
  accessToken: string;
  refreshToken?: string;
  tenantId: string;
  role: string;
  exp: number;
}

export function parseSessionPayload(encryptedPayload: string): DecodedSession | null {
  const decrypted = decryptSession(encryptedPayload);
  if (!decrypted) return null;
  
  try {
    const parsed = JSON.parse(decrypted);
    if (!parsed.accessToken || !parsed.exp) return null;
    return parsed as DecodedSession;
  } catch {
    return null;
  }
}