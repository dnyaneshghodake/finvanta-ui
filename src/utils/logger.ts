/**
 * Logger utility for CBS Banking Application
 * @file src/utils/logger.ts
 *
 * Design:
 *   - Development: formatted, human-readable console output with
 *     a `data` payload when present. Useful for debugging a BFF
 *     round-trip.
 *   - Production browser: `data` is DROPPED before hitting
 *     `console.*` so an XSS foothold cannot scrape the devtools
 *     panel for PII (CWE-532). Only the level + message reach the
 *     console.
 *   - Production server: a pino-style JSON sink is written to
 *     stdout so Loki / Datadog / CloudWatch can ingest structured
 *     events directly. The sink is intentionally minimal (no
 *     runtime pino dep) because this module runs in both browser
 *     and server bundles.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  timestamp: string;
  message: string;
  data?: unknown;
}

interface JsonLogRecord {
  time: string;
  level: LogLevel;
  levelNum: number;
  msg: string;
  /**
   * Populated on the server only. On the browser this is always
   * omitted — see JSDoc above.
   */
  data?: unknown;
}

const LEVEL_NUM: Record<LogLevel, number> = {
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
};

function isServer(): boolean {
  return typeof window === 'undefined';
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Pino-style JSON sink stub. In real production this would be
 * replaced (or wrapped) by a pino transport that ships to the
 * observability pipeline. The stub's contract matches pino's
 * single-line JSON output so downstream parsers don't need to change
 * when the real transport is wired in.
 *
 * Exported so tests and server-side callers can swap it.
 */
export interface LogSink {
  write(record: JsonLogRecord): void;
}

let activeSink: LogSink = {
  write(record) {
    // Single-line JSON to stdout — matches `pino`'s default output.
    // The browser bundle never hits this path (see emit()).
    try {
      process.stdout.write(`${JSON.stringify(record)}\n`);
    } catch {
      // Fallback: if stdout is unavailable (edge runtime) write
      // to console.log. Edge runtime strips stdout but keeps console.
      console.log(JSON.stringify(record));
    }
  },
};

/**
 * Replace the active JSON sink (e.g. in tests, or to inject a real
 * pino transport in a server-entry bootstrap). Calls made before
 * the swap remain on the previous sink.
 */
export function setLogSink(sink: LogSink): void {
  activeSink = sink;
}

class Logger {
  /**
   * In-memory ring buffer — development only. In production, no log
   * entries are retained in browser memory to prevent PII exfiltration
   * via XSS (CWE-532). Production logging should be routed to a
   * server-side collector via the BFF.
   */
  private logs: LogEntry[] = [];
  private readonly isDev = !isProduction();
  private readonly debugMode = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true';
  private static readonly MAX_ENTRIES = 200;

  private formatMessage(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    if (data !== undefined && this.isDev) {
      try {
        return `${prefix} ${message}: ${JSON.stringify(data, null, 2)}`;
      } catch {
        return `${prefix} ${message}: [unserialisable]`;
      }
    }
    return `${prefix} ${message}`;
  }

  private addLog(level: LogLevel, message: string): void {
    // Only retain in-memory logs in development to prevent PII
    // accumulation in production browser sessions (CWE-532).
    if (!this.debugMode) return;

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

  /**
   * Central emit. In production on the browser, the `data` arg is
   * DROPPED before the console call so devtools never shows PII
   * and any XSS foothold scraping console output gets nothing.
   * On the server, structured JSON (including `data`) is written to
   * the active sink for the observability pipeline.
   */
  private emit(level: LogLevel, message: string, data?: unknown): void {
    const prod = isProduction();

    if (isServer() && prod) {
      const record: JsonLogRecord = {
        time: new Date().toISOString(),
        level,
        levelNum: LEVEL_NUM[level],
        msg: message,
      };
      if (data !== undefined) {
        record.data = data;
      }
      activeSink.write(record);
      return;
    }

    // Browser — production strips `data` before the console call.
    const safeData = prod ? undefined : data;
    const formatted = this.formatMessage(level, message, safeData);
    switch (level) {
      case 'debug':
        if (this.debugMode) console.debug(formatted);
        return;
      case 'info':
        console.info(formatted);
        return;
      case 'warn':
        console.warn(formatted);
        return;
      case 'error':
        console.error(formatted);
        return;
    }
  }

  debug(message: string, data?: unknown): void {
    this.addLog('debug', message);
    this.emit('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.addLog('info', message);
    this.emit('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.addLog('warn', message);
    this.emit('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.addLog('error', message);
    this.emit('error', message, data);
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
