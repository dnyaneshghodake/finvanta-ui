/**
 * Logger unit tests — audit trail and PII protection validation.
 * @file src/utils/__tests__/logger.test.ts
 *
 * Per RBI IT Governance Direction 2023 §8.5: logging must not
 * retain PII in browser memory in production, and must support
 * log export for audit investigations.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// We need a fresh logger instance for each test, so we use dynamic import
// after setting the env var.

describe('Logger', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('exports a singleton logger instance', async () => {
    const { logger } = await import('../logger');
    expect(logger).toBeDefined();
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('getLogs returns entries in development mode', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEBUG_MODE', 'true');
    const { logger } = await import('../logger');
    logger.clearLogs();
    logger.info('test message');
    const logs = logger.getLogs();
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[logs.length - 1].message).toBe('test message');
    expect(logs[logs.length - 1].level).toBe('info');
  });

  it('getLogs supports level filter', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEBUG_MODE', 'true');
    const { logger } = await import('../logger');
    logger.clearLogs();
    logger.info('info msg');
    logger.warn('warn msg');
    logger.error('error msg');
    const warns = logger.getLogs({ level: 'warn' });
    expect(warns.length).toBe(1);
    expect(warns[0].message).toBe('warn msg');
  });

  it('getLogs supports limit', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEBUG_MODE', 'true');
    const { logger } = await import('../logger');
    logger.clearLogs();
    for (let i = 0; i < 10; i++) logger.info(`msg ${i}`);
    const limited = logger.getLogs({ limit: 3 });
    expect(limited.length).toBe(3);
  });

  it('clearLogs empties the buffer', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEBUG_MODE', 'true');
    const { logger } = await import('../logger');
    logger.info('to be cleared');
    logger.clearLogs();
    expect(logger.getLogs().length).toBe(0);
  });

  it('exportLogs returns valid JSON', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEBUG_MODE', 'true');
    const { logger } = await import('../logger');
    logger.clearLogs();
    logger.info('export test');
    const json = logger.exportLogs();
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThanOrEqual(1);
  });

  it('does not store data payload in log entries (PII protection)', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEBUG_MODE', 'true');
    const { logger } = await import('../logger');
    logger.clearLogs();
    logger.info('sensitive op', { password: 'secret123', pan: 'ABCPK1234A' });
    const logs = logger.getLogs();
    const entry = logs[logs.length - 1];
    // The data field must be undefined in stored entries per CWE-532
    expect(entry.data).toBeUndefined();
  });

  it('respects MAX_ENTRIES ring buffer limit', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEBUG_MODE', 'true');
    const { logger } = await import('../logger');
    logger.clearLogs();
    // Logger.MAX_ENTRIES is 200 (private static)
    for (let i = 0; i < 250; i++) logger.info(`msg ${i}`);
    const logs = logger.getLogs();
    expect(logs.length).toBeLessThanOrEqual(200);
  });
});
