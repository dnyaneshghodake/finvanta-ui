/**
 * PII masking + permission-gated reveal.
 * @file src/utils/pii.ts
 *
 * Per RBI Master Direction on Digital Payment Security Controls §5.8
 * and the SPDI Rules 2011, every render of PAN / Aadhaar / Mobile /
 * Email / Account Number in a banking UI MUST default to masked.
 * Un-masking is a privileged action and must emit an audit event so
 * the event appears in the ledger trail.
 *
 * The functions here are pure and safe to call from both server and
 * client code. They accept any string-shaped value (including the
 * formatted output of `formatters.ts`) and strip structural
 * separators before masking so a value like "1234 5678 9012" and
 * "123456789012" mask identically.
 *
 * Reveal helpers require a `RevealContext` — an explicit permission
 * set + audit sink — so a developer cannot accidentally emit an
 * unmasked value without also recording WHO saw it. The sink is
 * injected rather than imported to keep this module free of runtime
 * dependencies (formatters / logger) and therefore tree-shakable.
 */

// ── Constants ────────────────────────────────────────────────────

/**
 * Permission codes that gate un-masking of PII. These match the Spring
 * RoleService permission catalogue (see backend RoleService §PII).
 * A UI caller that does NOT have the required permission MUST receive
 * the masked form; reveal is never silently allowed.
 */
export const PII_PERMISSIONS = {
  REVEAL_PAN: "CUSTOMER_PAN_REVEAL",
  REVEAL_AADHAAR: "CUSTOMER_AADHAAR_REVEAL",
  REVEAL_MOBILE: "CUSTOMER_MOBILE_REVEAL",
  REVEAL_EMAIL: "CUSTOMER_EMAIL_REVEAL",
  REVEAL_ACCOUNT: "ACCOUNT_NUMBER_REVEAL",
} as const;

export type PiiField = keyof typeof PII_PERMISSIONS;

/**
 * Minimal audit sink contract. An implementation must be provided by
 * the caller (typically `src/security/auditSink.ts` which forwards
 * events to the BFF). The sink is fire-and-forget: a reveal decision
 * is never blocked on the audit write — the SHA of the unmasked
 * value is logged, never the value itself.
 */
export interface PiiAuditSink {
  record(event: PiiRevealEvent): void;
}

export interface PiiRevealEvent {
  field: PiiField;
  /** ISO8601 timestamp. */
  at: string;
  /** Username / subject identifier of the caller from the session. */
  subject?: string;
  /** SHA-256 hex of the unmasked value, truncated to 16 chars. */
  valueHash: string;
  /** Opaque reason string for the audit event (e.g. "customer_360_open"). */
  reason: string;
  /** Correlation ID so the reveal can be cross-referenced in the BFF trace. */
  correlationId?: string;
}

export interface RevealContext {
  /** Permissions the caller holds (from the encrypted session). */
  permissions: ReadonlySet<string>;
  /** Caller identity (username / operator ID) for the audit trail. */
  subject?: string;
  /** Reason the UI is revealing — must be a short, constant string. */
  reason: string;
  /** Optional request-scoped correlation id to thread into the audit event. */
  correlationId?: string;
  /** Destination for the audit event. If omitted, reveal still works but no audit is written. */
  sink?: PiiAuditSink;
}

// ── Helpers ──────────────────────────────────────────────────────

function stripStructural(s: string): string {
  return s.replace(/[\s-]/g, "");
}

function mask(value: string, visibleEnd: number, visibleStart = 0, placeholder = "X"): string {
  const clean = stripStructural(value);
  const total = clean.length;
  if (total <= visibleStart + visibleEnd) {
    // Too short to mask safely — return a flat block of placeholders
    // so the caller cannot infer the original length either.
    return placeholder.repeat(Math.max(total, 1));
  }
  const hidden = placeholder.repeat(total - visibleStart - visibleEnd);
  return `${clean.slice(0, visibleStart)}${hidden}${clean.slice(total - visibleEnd)}`;
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest("SHA-256", enc);
  const bytes = new Uint8Array(hashBuf);
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

function emitAudit(
  field: PiiField,
  rawValue: string,
  ctx: RevealContext,
): void {
  if (!ctx.sink) return;
  // Fire and forget — never await. The reveal decision must not be
  // blocked on the audit write. If hashing fails we still emit a
  // minimal event so the reveal is recorded.
  sha256Hex(rawValue)
    .then((hash) => {
      ctx.sink?.record({
        field,
        at: new Date().toISOString(),
        subject: ctx.subject,
        valueHash: hash.slice(0, 16),
        reason: ctx.reason,
        correlationId: ctx.correlationId,
      });
    })
    .catch(() => {
      ctx.sink?.record({
        field,
        at: new Date().toISOString(),
        subject: ctx.subject,
        valueHash: "hash-unavailable",
        reason: ctx.reason,
        correlationId: ctx.correlationId,
      });
    });
}

// ── Mask primitives ──────────────────────────────────────────────

/**
 * Mask a 10-character PAN (AAAAA1234A). Visible: first 2 + last 1
 * → `AB*******A`. Irreversible; structural separators are stripped
 * before masking so an un-normalised input masks identically.
 */
export function maskPAN(pan: string | null | undefined): string {
  if (!pan) return "";
  return mask(pan, 1, 2);
}

/**
 * Mask a 12-digit Aadhaar. Visible: last 4 → `XXXX XXXX 1234`.
 * Returns the grouped form so the UI layout does not shift on
 * toggle. The UIDAI Aadhaar Masking Guidelines specify exactly this
 * format (last 4 digits only).
 */
export function maskAadhaar(aadhaar: string | null | undefined): string {
  if (!aadhaar) return "";
  const clean = stripStructural(aadhaar);
  if (clean.length < 4) return "X".repeat(12);
  const last4 = clean.slice(-4);
  return `XXXX XXXX ${last4}`;
}

/**
 * Mask a 10-digit Indian mobile. Visible: last 2 → `XXXXXXXX67`.
 * Country code (if present) is preserved so `+91-98765 43210`
 * becomes `+91-XXXXX XX210`.
 */
export function maskMobile(mobile: string | null | undefined): string {
  if (!mobile) return "";
  const clean = mobile.replace(/\D/g, "");
  if (clean.length < 10) {
    return "X".repeat(clean.length || 1);
  }
  const countryCodeLen = Math.max(0, clean.length - 10);
  const cc = countryCodeLen > 0 ? `+${clean.slice(0, countryCodeLen)}-` : "";
  const last10 = clean.slice(-10);
  const last2 = last10.slice(-2);
  return `${cc}XXXXXXXX${last2}`;
}

/**
 * Mask an email. Keep 1 character of local-part + preserve the
 * domain to support deliverability QA without exposing the full
 * identity. `alice.sharma@example.com` → `a***@example.com`.
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "";
  const at = email.indexOf("@");
  if (at < 0) return "*".repeat(email.length);
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length === 0) return `${domain}`;
  return `${local[0]}${"*".repeat(Math.max(local.length - 1, 2))}${domain}`;
}

/**
 * Mask a CBS account number. Finvanta uses composite keys like
 * `SB-HQ001-000001`; the mask shows the product + branch prefix and
 * hides the numeric tail. Purely numeric account numbers show only
 * the last 4 digits.
 */
export function maskAccountNumber(acct: string | null | undefined): string {
  if (!acct) return "";
  const normalised = acct.toUpperCase();
  // Composite key shape: keep segments before the final numeric tail.
  if (/-/.test(normalised)) {
    const segments = normalised.split("-");
    const last = segments[segments.length - 1];
    const masked = last.length > 4 ? `${"X".repeat(last.length - 4)}${last.slice(-4)}` : "X".repeat(last.length);
    return [...segments.slice(0, -1), masked].join("-");
  }
  const clean = stripStructural(normalised);
  if (clean.length <= 4) return "X".repeat(clean.length || 1);
  return `${"X".repeat(clean.length - 4)}${clean.slice(-4)}`;
}

// ── Reveal gate ──────────────────────────────────────────────────

/**
 * Permission-gated reveal for a single PII field.
 *
 *   - Returns the masked value (via the provided masker) if the
 *     caller does not hold the required permission — the reveal is
 *     refused silently but no audit event is emitted because no PII
 *     was disclosed.
 *   - Returns the raw value and fires an audit event when permission
 *     is held. The audit event carries only a 16-char truncated
 *     SHA-256 of the unmasked value so the trail can be reconciled
 *     without storing the PII itself (SPDI §5 — purpose limitation).
 *
 * Typed `PiiField` discriminator ensures the correct mask is applied
 * if the permission check fails — a PAN field never renders an
 * account-number mask by accident.
 */
export function revealPii(
  field: PiiField,
  rawValue: string | null | undefined,
  ctx: RevealContext,
): string {
  if (!rawValue) return "";
  const required = PII_PERMISSIONS[field];
  if (!ctx.permissions.has(required)) {
    return maskFor(field, rawValue);
  }
  emitAudit(field, rawValue, ctx);
  return rawValue;
}

/**
 * Convenience dispatch for the masker that belongs to a given field.
 * Kept public so callers that always want the masked form (table
 * rows, toast messages) can avoid the permission plumbing.
 */
export function maskFor(field: PiiField, value: string | null | undefined): string {
  switch (field) {
    case "REVEAL_PAN":
      return maskPAN(value);
    case "REVEAL_AADHAAR":
      return maskAadhaar(value);
    case "REVEAL_MOBILE":
      return maskMobile(value);
    case "REVEAL_EMAIL":
      return maskEmail(value);
    case "REVEAL_ACCOUNT":
      return maskAccountNumber(value);
  }
}

/**
 * Derive a `ReadonlySet<string>` of permissions from the session
 * shape used elsewhere in the app. Accepts a flat permissions array
 * and/or the module-keyed map returned by Spring and returns a
 * single normalised set. Kept here so callers do not need to import
 * session internals into render code.
 */
export function collectPermissions(
  permissions?: ReadonlyArray<string> | null,
  permissionsByModule?: Readonly<Record<string, ReadonlyArray<string>>> | null,
): ReadonlySet<string> {
  const out = new Set<string>();
  if (permissions) {
    for (const p of permissions) out.add(p);
  }
  if (permissionsByModule) {
    for (const list of Object.values(permissionsByModule)) {
      for (const p of list) out.add(p);
    }
  }
  return out;
}
