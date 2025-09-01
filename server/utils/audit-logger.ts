import { existsSync, mkdirSync, appendFileSync } from 'fs';
import path from 'path';
import { devSecurity } from './dev-security';

export enum AuditEventType {
  // Authentication
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGOUT = 'LOGOUT',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',

  // Authorization
  ACCESS_GRANTED = 'ACCESS_GRANTED',
  ACCESS_DENIED = 'ACCESS_DENIED',
  PERMISSION_CHANGE = 'PERMISSION_CHANGE',

  // Data Operations
  DATA_CREATE = 'DATA_CREATE',
  DATA_READ = 'DATA_READ',
  DATA_UPDATE = 'DATA_UPDATE',
  DATA_DELETE = 'DATA_DELETE',
  DATA_EXPORT = 'DATA_EXPORT',

  // File Operations
  FILE_UPLOAD = 'FILE_UPLOAD',
  FILE_DOWNLOAD = 'FILE_DOWNLOAD',
  FILE_DELETE = 'FILE_DELETE',

  // Security Events
  SECURITY_ALERT = 'SECURITY_ALERT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',

  // System Events
  SYSTEM_START = 'SYSTEM_START',
  SYSTEM_STOP = 'SYSTEM_STOP',
  CONFIG_CHANGE = 'CONFIG_CHANGE',
  ERROR = 'ERROR',

  // GDPR Compliance
  CONSENT_GIVEN = 'CONSENT_GIVEN',
  CONSENT_WITHDRAWN = 'CONSENT_WITHDRAWN',
  DATA_REQUEST = 'DATA_REQUEST',
  DATA_DELETION = 'DATA_DELETION',
}

export enum AuditSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

interface AuditEntry {
  timestamp: string;
  eventType: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  result: 'SUCCESS' | 'FAILURE';
  details?: Record<string, any>;
  errorMessage?: string;
  stackTrace?: string;
}

class AuditLogger {
  private readonly auditDir = path.join(process.cwd(), 'logs', 'audit');
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB
  private buffer: AuditEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.ensureAuditDirectory();
    this.startFlushInterval();
  }

  private ensureAuditDirectory(): void {
    if (!existsSync(this.auditDir)) {
      mkdirSync(this.auditDir, { recursive: true });
    }
  }

  private startFlushInterval(): void {
    // Flush buffer every 5 seconds
    this.flushInterval = setInterval(() => {
      this.flushBuffer();
    }, 5000);
  }

  private getCurrentLogFile(): string {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.auditDir, `audit-${date}.jsonl`);
  }

  private rotateLogFileIfNeeded(): void {
    const logFile = this.getCurrentLogFile();

    if (existsSync(logFile)) {
      const stats = require('fs').statSync(logFile);

      if (stats.size > this.maxFileSize) {
        const timestamp = Date.now();
        const rotatedFile = logFile.replace('.jsonl', `-${timestamp}.jsonl`);
        require('fs').renameSync(logFile, rotatedFile);
      }
    }
  }

  private sanitizeEntry(entry: AuditEntry): AuditEntry {
    // Redact sensitive data
    const sanitized = { ...entry };

    if (sanitized.details) {
      const detailsStr = JSON.stringify(sanitized.details);
      const redacted = devSecurity.redactSensitiveData(detailsStr);
      sanitized.details = JSON.parse(redacted);
    }

    if (sanitized.errorMessage) {
      sanitized.errorMessage = devSecurity.redactSensitiveData(sanitized.errorMessage);
    }

    if (sanitized.stackTrace) {
      sanitized.stackTrace = devSecurity.redactSensitiveData(sanitized.stackTrace);
    }

    return sanitized;
  }

  private writeToFile(entry: AuditEntry): void {
    this.rotateLogFileIfNeeded();

    const logFile = this.getCurrentLogFile();
    const sanitized = this.sanitizeEntry(entry);
    const line = JSON.stringify(sanitized) + '\n';

    try {
      appendFileSync(logFile, line, 'utf-8');
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }

  private flushBuffer(): void {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    for (const entry of entries) {
      this.writeToFile(entry);
    }
  }

  public log(
    eventType: AuditEventType,
    severity: AuditSeverity,
    result: 'SUCCESS' | 'FAILURE',
    details?: Partial<AuditEntry>,
  ): void {
    const entry: AuditEntry = {
      timestamp: new Date().toISOString(),
      eventType,
      severity,
      result,
      ...details,
    };

    // Add to buffer for batch writing
    this.buffer.push(entry);

    // Immediate flush for critical events
    if (severity === AuditSeverity.CRITICAL) {
      this.flushBuffer();
    }

    // Console output in development
    if (process.env.NODE_ENV === 'development') {
      this.logToConsole(entry);
    }
  }

  private logToConsole(entry: AuditEntry): void {
    const color = {
      [AuditSeverity.INFO]: '\x1b[36m', // Cyan
      [AuditSeverity.WARNING]: '\x1b[33m', // Yellow
      [AuditSeverity.ERROR]: '\x1b[31m', // Red
      [AuditSeverity.CRITICAL]: '\x1b[35m', // Magenta
    }[entry.severity];

    const reset = '\x1b[0m';

    console.log(
      `${color}[AUDIT]${reset} ${entry.timestamp} | ${entry.severity} | ${entry.eventType} | ${entry.result}`,
    );

    if (entry.details) {
      console.log('  Details:', entry.details);
    }
  }

  // Convenience methods for common events

  public logLogin(userId: string, success: boolean, ipAddress?: string): void {
    this.log(
      success ? AuditEventType.LOGIN_SUCCESS : AuditEventType.LOGIN_FAILURE,
      success ? AuditSeverity.INFO : AuditSeverity.WARNING,
      success ? 'SUCCESS' : 'FAILURE',
      { userId, ipAddress },
    );
  }

  public logDataAccess(
    userId: string,
    resource: string,
    action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE',
    success: boolean,
  ): void {
    const eventType = {
      CREATE: AuditEventType.DATA_CREATE,
      READ: AuditEventType.DATA_READ,
      UPDATE: AuditEventType.DATA_UPDATE,
      DELETE: AuditEventType.DATA_DELETE,
    }[action];

    this.log(
      eventType,
      success ? AuditSeverity.INFO : AuditSeverity.WARNING,
      success ? 'SUCCESS' : 'FAILURE',
      { userId, resource, action },
    );
  }

  public logSecurityEvent(
    type: 'RATE_LIMIT' | 'SUSPICIOUS' | 'ALERT',
    details: Record<string, any>,
  ): void {
    const eventType = {
      RATE_LIMIT: AuditEventType.RATE_LIMIT_EXCEEDED,
      SUSPICIOUS: AuditEventType.SUSPICIOUS_ACTIVITY,
      ALERT: AuditEventType.SECURITY_ALERT,
    }[type];

    this.log(eventType, AuditSeverity.WARNING, 'FAILURE', { details });
  }

  public logError(error: Error, userId?: string, context?: Record<string, any>): void {
    this.log(AuditEventType.ERROR, AuditSeverity.ERROR, 'FAILURE', {
      userId,
      errorMessage: error.message,
      stackTrace: error.stack,
      details: context,
    });
  }

  public logGDPREvent(
    type: 'CONSENT_GIVEN' | 'CONSENT_WITHDRAWN' | 'DATA_REQUEST' | 'DATA_DELETION',
    userId: string,
    details?: Record<string, any>,
  ): void {
    const eventType = {
      CONSENT_GIVEN: AuditEventType.CONSENT_GIVEN,
      CONSENT_WITHDRAWN: AuditEventType.CONSENT_WITHDRAWN,
      DATA_REQUEST: AuditEventType.DATA_REQUEST,
      DATA_DELETION: AuditEventType.DATA_DELETION,
    }[type];

    this.log(eventType, AuditSeverity.INFO, 'SUCCESS', { userId, details });
  }

  public async generateAuditReport(
    _startDate: Date,
    _endDate: Date,
    _filters?: {
      userId?: string;
      eventType?: AuditEventType;
      severity?: AuditSeverity;
    },
  ): Promise<AuditEntry[]> {
    // This would read from log files and generate a report
    // For now, return empty array
    return [];
  }

  public shutdown(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    this.flushBuffer();
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();

// Ensure clean shutdown
process.on('SIGINT', () => {
  auditLogger.shutdown();
});

process.on('SIGTERM', () => {
  auditLogger.shutdown();
});

export default auditLogger;
