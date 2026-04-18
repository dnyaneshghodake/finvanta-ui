/**
 * Logger utility for CBS Banking Application
 * @file src/utils/logger.ts
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  timestamp: string;
  message: string;
  data?: any;
}

class Logger {
  private logs: LogEntry[] = [];
  private isDevelopment = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true';

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    if (data) {
      return `${prefix} ${message}: ${JSON.stringify(data, null, 2)}`;
    }
    return `${prefix} ${message}`;
  }

  private addLog(level: LogLevel, message: string, data?: any): void {
    const entry: LogEntry = {
      level,
      timestamp: new Date().toISOString(),
      message,
      data,
    };
    this.logs.push(entry);

    // Keep only last 1000 logs in memory
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }
  }

  debug(message: string, data?: any): void {
    this.addLog('debug', message, data);
    if (this.isDevelopment) {
      console.debug(this.formatMessage('debug', message, data));
    }
  }

  info(message: string, data?: any): void {
    this.addLog('info', message, data);
    console.info(this.formatMessage('info', message, data));
  }

  warn(message: string, data?: any): void {
    this.addLog('warn', message, data);
    console.warn(this.formatMessage('warn', message, data));
  }

  error(message: string, data?: any): void {
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
