/**
 * AES-256-GCM wrapper for encrypting server-side session payloads.
 *
 * The plaintext is a compact JSON blob holding {accessToken,
 * refreshToken, user, branchCode, tenantId, mfa, issuedAt}. The
 * encrypted blob is stored as the value of the HttpOnly fv_sid cookie
 * (Secure in prod, SameSite=Lax). The browser never sees the access
 * token. A fresh 12-byte IV is generated per write; the tag is
 * concatenated to the ciphertext before base64url encoding.
 *
 * Key derivation: HKDF-SHA256(secret, salt='fv/session/v1').
 */
import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { serverEnv } from "./env";

const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

function deriveKey(secret: string, salt: string): Buffer {
  const prk = createHmac("sha256", salt).update(secret).digest();
  const out = createHmac("sha256", prk).update(Buffer.concat([Buffer.from([0x01])])).digest();
  return out.subarray(0, KEY_LEN);
}

function toB64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64Url(str: string): Buffer {
  const pad = 4 - (str.length % 4 || 4);
  const normalized = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad % 4);
  return Buffer.from(normalized, "base64");
}

export function encryptSession(payload: unknown): string {
  const key = deriveKey(serverEnv().sessionSecret, "fv/session/v1");
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return toB64Url(Buffer.concat([iv, tag, ct]));
}

export function decryptSession<T>(token: string): T | null {
  try {
    const key = deriveKey(serverEnv().sessionSecret, "fv/session/v1");
    const buf = fromB64Url(token);
    if (buf.length < IV_LEN + TAG_LEN + 1) return null;
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const ct = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return JSON.parse(pt.toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function generateCsrfToken(): string {
  return toB64Url(randomBytes(24));
}

export function constantTimeEquals(a: string, b: string): boolean {
  // Hash-pad both inputs to a fixed 32-byte HMAC so the comparison
  // runs in constant time regardless of raw input length. A length
  // short-circuit would leak the expected token size through timing.
  const key = deriveKey(serverEnv().sessionSecret, "fv/ct-eq/v1");
  const bufA = createHmac("sha256", key).update(a, "utf8").digest();
  const bufB = createHmac("sha256", key).update(b, "utf8").digest();
  return timingSafeEqual(bufA, bufB);
}
