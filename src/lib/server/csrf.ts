/**
 * Double-submit CSRF validator.
 *
 * The browser can read the fv_csrf cookie (HttpOnly is NOT set on it
 * on purpose) and must echo the same value in the X-CSRF-Token header
 * on every mutating request. The BFF compares the header against the
 * csrfToken embedded inside the encrypted fv_sid session blob — not
 * the cookie — so an attacker who plants a fv_csrf cookie without a
 * matching session is rejected.
 */
import "server-only";
import type { NextRequest } from "next/server";
import { constantTimeEquals } from "./crypto";
import type { CbsSession } from "./session";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isCsrfExempt(req: NextRequest): boolean {
  return SAFE_METHODS.has(req.method.toUpperCase());
}

export function assertCsrf(req: NextRequest, session: CbsSession | null): void {
  if (isCsrfExempt(req)) return;
  if (!session) throw new Error("CSRF_NO_SESSION");
  const header = req.headers.get("x-csrf-token");
  if (!header) throw new Error("CSRF_MISSING_HEADER");
  if (!constantTimeEquals(header, session.csrfToken)) {
    throw new Error("CSRF_MISMATCH");
  }
}
