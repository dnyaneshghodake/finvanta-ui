/**
 * Logger utility for CBS Banking Application
 * @file src/utils/logger.ts
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  timestamp: string;
  message: string;
  data?: unknown;
}

class Logger {
  /**
   * In-memory ring buffer — development only. In production, no log
   * entries are retained in browser memory to prevent PII exfiltration
   * via XSS (CWE-532). Production logging should be routed to a
   * server-side collector via the BFF.
   */
  private logs: LogEntry[] = [];
  private isDevelopment = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true';
  private static readonly MAX_ENTRIES = 200;

  private formatMessage(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    if (data) {
      return `${prefix} ${message}: ${JSON.stringify(data, null, 2)}`;
    }
    return `${prefix} ${message}`;
  }

  private addLog(level: LogLevel, message: string, data?: unknown): void {
    // Only retain in-memory logs in development to prevent PII
    // accumulation in production browser sessions (CWE-532).
    if (!this.isDevelopment) return;

    const entry: LogEntry = {
      level,
      timestamp: new Date().toISOString(),
      message,
      // Strip data payload from stored entries to limit PII surface.
      // The full payload is still written to console for dev debugging.
      data: undefined,
    };
    this.logs.push(entry);

    if (this.logs.length > Logger.MAX_ENTRIES) {
      this.logs = this.logs.slice(-Logger.MAX_ENTRIES);
    }
  }

  debug(message: string, data?: unknown): void {
    this.addLog('debug', message, data);
    if (this.isDevelopment) {
      console.debug(this.formatMessage('debug', message, data));
    }
  }

  info(message: string, data?: unknown): void {
    this.addLog('info', message, data);
    console.info(this.formatMessage('info', message, data));
  }

  warn(message: string, data?: unknown): void {
    this.addLog('warn', message, data);
    console.warn(this.formatMessage('warn', message, data));
  }

  error(message: string, data?: unknown): void {
    this.addLog('error', message, data);
    console.error(this.formatMessage('error', message, data));
  }

  getLogs(filter?: { level?: LogLevel; limit?: number }): LogEntry[] {
    let result = [...this.logs];

    if (filter?.level) {
      result = result.filter(log => log.level === filter.level);
    }

    if (filter?.limit) {
      result = result.slice(-filter.limit);
    }

    return result;
  }

  clearLogs(): void {
    this.logs = [];
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export const logger = new Logger();
