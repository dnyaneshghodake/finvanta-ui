/**
 * Audit logging for security events.
 *
 * Per RBI IT Governance 2023 §8.2: all authentication events
 * (login success/failure, MFA, token refresh, logout) must be
 * logged with correlation ID for audit trail.
 */
import { logger } from '@/utils/logger';

/** Security audit event types */
export type AuditEvent =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'MFA_SUCCESS'
  | 'MFA_FAILURE'
  | 'LOGOUT'
  | 'TOKEN_REFRESH'
  | 'TOKEN_ROTATION'
  | 'REFRESH_TOKEN_REUSE_DETECTED'
  | 'SESSION_EXPIRED'
  | 'CONCURRENT_SESSION_DETECTED';

/** Audit event metadata */
export interface AuditContext {
  event: AuditEvent;
  correlationId: string;
  userId?: string | number;
  username?: string;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log security audit event.
 * In production, this should be forwarded to a SIEM.
 */
export function logAudit(context: AuditContext): void {
  const { event, correlationId, userId, username, tenantId, ipAddress, userAgent, reason, metadata } = context;

  // RBI §8.2: correlation ID links all audit records
  const auditRecord = {
    // Event classification
    event,
    // Traceability
    correlationId,
    // Actor
    userId,
    username,
    tenantId,
    // Context
    ipAddress,
    userAgent,
    // Context details
    reason,
    metadata,
    // Timestamp (ISO 8601)
    timestamp: new Date().toISOString(),
    // Source system
    source: 'finvanta-ui-bff',
  };

  // Log to standard logger (in production, forward to SIEM)
  switch (event) {
    case 'LOGIN_SUCCESS':
    case 'MFA_SUCCESS':
    case 'TOKEN_ROTATION':
      logger.security('audit', auditRecord);
      break;
    case 'LOGIN_FAILURE':
    case 'MFA_FAILURE':
    case 'REFRESH_TOKEN_REUSE_DETECTED':
    case 'CONCURRENT_SESSION_DETECTED':
      logger.security('audit', auditRecord);
      break;
    default:
      logger.info('audit', auditRecord);
  }
}

/**
 * Log failed authentication attempt.
 * Does NOT expose whether the account exists (prevent enumeration).
 */
export function logAuthFailure(
  event: 'LOGIN_FAILURE' | 'MFA_FAILURE',
  correlationId: string,
  metadata?: Record<string, unknown>
): void {
  // Generic message - do not reveal if account exists
  logAudit({
    event,
    correlationId,
    reason: 'Authentication failed',
    metadata,
  });
}