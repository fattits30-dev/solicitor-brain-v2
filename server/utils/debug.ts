import type { ChalkInstance } from 'chalk';
let chalk: ChalkInstance | null = null;

// Dynamic import for ESM module
(async () => {
  try {
    const chalkModule = await import('chalk');
    chalk = chalkModule.default;
  } catch (error) {
    console.warn('Chalk not available, using plain console output');
  }
})();

// Debug levels for controlling logging verbosity
export const DEBUG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4,
} as const;

export type DebugLevel = keyof typeof DEBUG_LEVELS;

// Color scheme for different log levels (will be applied if chalk is available)
const getColorFn = (level: DebugLevel) => {
  if (!chalk) return (str: string) => str;
  
  switch (level) {
    case 'ERROR': return chalk.red;
    case 'WARN': return chalk.yellow;
    case 'INFO': return chalk.blue;
    case 'DEBUG': return chalk.green;
    case 'TRACE': return chalk.gray;
    default: return (str: string) => str;
  }
};

const LEVEL_EMOJIS = {
  ERROR: '❌',
  WARN: '⚠️',
  INFO: 'ℹ️',
  DEBUG: '🔍',
  TRACE: '📝',
};

interface LogEntry {
  level: DebugLevel;
  message: string;
  timestamp: Date;
  data?: any;
  category?: string;
  correlationId?: string;
}

export class DebugLogger {
  private static level: number = this.getDebugLevel();
  private static logs: LogEntry[] = [];
  private static maxLogs = 1000;
  private static categories = new Set<string>();

  private static getDebugLevel(): number {
    const envLevel = process.env.DEBUG_LEVEL as DebugLevel;
    if (envLevel && envLevel in DEBUG_LEVELS) {
      return DEBUG_LEVELS[envLevel];
    }
    // Default to INFO in production, DEBUG in development
    return process.env.NODE_ENV === 'production' ? DEBUG_LEVELS.INFO : DEBUG_LEVELS.DEBUG;
  }

  private static shouldLog(level: DebugLevel): boolean {
    return DEBUG_LEVELS[level] <= this.level;
  }

  private static formatMessage(level: DebugLevel, message: string, category?: string): string {
    const timestamp = new Date().toISOString();
    const emoji = LEVEL_EMOJIS[level];
    const levelStr = level.padEnd(5);
    const categoryStr = category ? `[${category}]` : '';
    
    if (process.env.NODE_ENV === 'development') {
      const colorFn = getColorFn(level);
      return colorFn(`${emoji} ${timestamp} ${levelStr} ${categoryStr} ${message}`);
    }
    return `${timestamp} ${levelStr} ${categoryStr} ${message}`;
  }

  private static log(level: DebugLevel, message: string, data?: any, category?: string, correlationId?: string) {
    if (!this.shouldLog(level)) return;

    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      data,
      category,
      correlationId,
    };

    // Store log entry for retrieval
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    if (category) {
      this.categories.add(category);
    }

    const formattedMessage = this.formatMessage(level, message, category);

    // Output to console
    switch (level) {
      case 'ERROR':
        console.error(formattedMessage, data || '');
        break;
      case 'WARN':
        console.warn(formattedMessage, data || '');
        break;
      case 'INFO':
        console.info(formattedMessage, data || '');
        break;
      case 'DEBUG':
      case 'TRACE':
        console.log(formattedMessage, data || '');
        break;
    }
  }

  static error(message: string, data?: any, category?: string, correlationId?: string) {
    this.log('ERROR', message, data, category, correlationId);
  }

  static warn(message: string, data?: any, category?: string, correlationId?: string) {
    this.log('WARN', message, data, category, correlationId);
  }

  static info(message: string, data?: any, category?: string, correlationId?: string) {
    this.log('INFO', message, data, category, correlationId);
  }

  static debug(message: string, data?: any, category?: string, correlationId?: string) {
    this.log('DEBUG', message, data, category, correlationId);
  }

  static trace(message: string, data?: any, category?: string, correlationId?: string) {
    this.log('TRACE', message, data, category, correlationId);
  }

  // Performance timing utilities
  static time(label: string): void {
    if (this.shouldLog('DEBUG')) {
      console.time(label);
    }
  }

  static timeEnd(label: string): void {
    if (this.shouldLog('DEBUG')) {
      console.timeEnd(label);
    }
  }

  // Get stored logs for debugging UI
  static getLogs(filter?: { level?: DebugLevel; category?: string; limit?: number }): LogEntry[] {
    let filtered = [...this.logs];
    
    if (filter?.level) {
      filtered = filtered.filter(log => log.level === filter.level);
    }
    
    if (filter?.category) {
      filtered = filtered.filter(log => log.category === filter.category);
    }
    
    if (filter?.limit) {
      filtered = filtered.slice(-filter.limit);
    }
    
    return filtered;
  }

  static getCategories(): string[] {
    return Array.from(this.categories);
  }

  static clearLogs(): void {
    this.logs = [];
  }

  static setLevel(level: DebugLevel): void {
    this.level = DEBUG_LEVELS[level];
    this.info(`Debug level set to ${level}`);
  }

  static getLevel(): DebugLevel {
    const entries = Object.entries(DEBUG_LEVELS);
    const entry = entries.find(([_, value]) => value === this.level);
    return (entry?.[0] as DebugLevel) || 'INFO';
  }
}

// Database query debugging
export class QueryDebugger {
  static logQuery(query: string, params?: any[], duration?: number) {
    if (DebugLogger.getLevel() !== 'DEBUG' && DebugLogger.getLevel() !== 'TRACE') return;
    
    const message = `SQL Query executed${duration ? ` in ${duration}ms` : ''}`;
    DebugLogger.debug(message, { query, params }, 'DATABASE');
  }

  static logError(query: string, error: any) {
    DebugLogger.error('SQL Query failed', { query, error }, 'DATABASE');
  }
}

// API request/response debugging
export class ApiDebugger {
  static logRequest(method: string, path: string, body?: any, headers?: any) {
    DebugLogger.debug(`${method} ${path}`, { body, headers }, 'API_REQUEST');
  }

  static logResponse(method: string, path: string, status: number, duration: number, body?: any) {
    const level = status >= 400 ? 'ERROR' : 'DEBUG';
    DebugLogger[level.toLowerCase() as 'error' | 'debug'](
      `${method} ${path} - ${status} (${duration}ms)`,
      { body },
      'API_RESPONSE'
    );
  }
}

// Performance monitoring
export class PerformanceMonitor {
  private static timers = new Map<string, number>();

  static start(label: string): void {
    this.timers.set(label, Date.now());
    DebugLogger.trace(`Performance timer started: ${label}`, undefined, 'PERFORMANCE');
  }

  static end(label: string): number {
    const start = this.timers.get(label);
    if (!start) {
      DebugLogger.warn(`No timer found for label: ${label}`, undefined, 'PERFORMANCE');
      return 0;
    }

    const duration = Date.now() - start;
    this.timers.delete(label);
    
    DebugLogger.debug(`${label}: ${duration}ms`, { duration }, 'PERFORMANCE');
    return duration;
  }

  static measure<T>(label: string, fn: () => T): T {
    this.start(label);
    try {
      const result = fn();
      return result;
    } finally {
      this.end(label);
    }
  }

  static async measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    this.start(label);
    try {
      const result = await fn();
      return result;
    } finally {
      this.end(label);
    }
  }
}

// Export a singleton instance for convenience
export const debug = DebugLogger;
export const queryDebug = QueryDebugger;
export const apiDebug = ApiDebugger;
export const perfMonitor = PerformanceMonitor;