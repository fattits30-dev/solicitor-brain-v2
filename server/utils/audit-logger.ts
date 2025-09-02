import { auditLog as auditLogTable, type InsertAuditLog } from '@shared/schema';
import { sql } from 'drizzle-orm';
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'fs';
import path from 'path';
import { db } from '../db';
import { piiRedactor } from '../services/pii-redactor';
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
  metadata?: Record<string, any>;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  correlationId?: string;
}

class AuditLogger {
  private readonly auditDir = path.join(process.cwd(), 'logs', 'audit');
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB
  private buffer: AuditEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly enableDatabase: boolean;
  private readonly enableFiles: boolean;

  constructor(options: { enableDatabase?: boolean; enableFiles?: boolean } = {}) {
    this.enableDatabase = options.enableDatabase ?? true;
    this.enableFiles = options.enableFiles ?? true;

    if (this.enableFiles) {
      this.ensureAuditDirectory();
    }
    this.startFlushInterval();
  }

  private ensureAuditDirectory(): void {
    if (!existsSync(this.auditDir)) {
      mkdirSync(this.auditDir, { recursive: true });
    }
  }

  private startFlushInterval(): void {
    // Flush buffer every 5 seconds
    this.flushInterval = setInterval(async () => {
      await this.flushBuffer();
    }, 5000);
  }

  private getCurrentLogFile(): string {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.auditDir, `audit-${date}.jsonl`);
  }

  private rotateLogFileIfNeeded(): void {
    const logFile = this.getCurrentLogFile();

    if (existsSync(logFile)) {
      const stats = statSync(logFile);

      if (stats.size > this.maxFileSize) {
        const timestamp = Date.now();
        const rotatedFile = logFile.replace('.jsonl', `-${timestamp}.jsonl`);
        renameSync(logFile, rotatedFile);
      }
    }
  }

  private sanitizeEntry(entry: AuditEntry): AuditEntry {
    // Redact sensitive data using PII redactor
    const sanitized = { ...entry };

    // Apply PII redaction to entry details
    if (sanitized.details) {
      const { redacted } = piiRedactor.redactObject(sanitized.details, 'audit-logger');
      sanitized.details = redacted;
    }

    // Redact error messages
    if (sanitized.errorMessage) {
      const result = piiRedactor.redact(sanitized.errorMessage, 'audit-logger');
      sanitized.errorMessage = result.redactedText;
    }

    // Redact stack traces
    if (sanitized.stackTrace) {
      const result = piiRedactor.redact(sanitized.stackTrace, 'audit-logger');
      sanitized.stackTrace = result.redactedText;
    }

    // Also apply legacy redaction for additional security patterns
    if (sanitized.details) {
      const detailsStr = JSON.stringify(sanitized.details);
      const legacyRedacted = devSecurity.redactSensitiveData(detailsStr);
      sanitized.details = JSON.parse(legacyRedacted);
    }

    return sanitized;
  }

  private writeToFile(entry: AuditEntry): void {
    if (!this.enableFiles) return;

    this.rotateLogFileIfNeeded();

    const logFile = this.getCurrentLogFile();
    const sanitized = this.sanitizeEntry(entry);
    const line = JSON.stringify(sanitized) + '\n';

    try {
      appendFileSync(logFile, line, 'utf-8');
    } catch (error) {
      console.error('Failed to write audit log to file:', error);
    }
  }

  private async writeToDatabase(entry: AuditEntry): Promise<void> {
    if (!this.enableDatabase) return;

    try {
      const sanitized = this.sanitizeEntry(entry);

      // Map audit entry to database schema
      const dbEntry: InsertAuditLog = {
        userId: sanitized.userId && sanitized.userId !== 'anonymous' ? sanitized.userId : null,
        action: `${sanitized.eventType}:${sanitized.action || 'unknown'}`,
        resource: sanitized.resource || 'system',
        resourceId: sanitized.details?.resourceId || sanitized.details?.id || 'unknown',
        metadata: {
          eventType: sanitized.eventType,
          severity: sanitized.severity,
          result: sanitized.result,
          sessionId: sanitized.sessionId,
          ipAddress: sanitized.ipAddress,
          userAgent: sanitized.userAgent,
          correlationId: sanitized.correlationId,
          beforeState: sanitized.beforeState,
          afterState: sanitized.afterState,
          details: sanitized.details,
          errorMessage: sanitized.errorMessage,
          stackTrace: sanitized.stackTrace,
          timestamp: sanitized.timestamp,
        },
        redactedData: sanitized.details ? JSON.stringify(sanitized.details) : null,
      };

      await db.insert(auditLogTable).values(dbEntry);
    } catch (error) {
      console.error('Failed to write audit log to database:', error);
      // Fallback to file logging if database fails
      if (this.enableFiles) {
        this.writeToFile(entry);
      }
    }
  }

  private async flushBuffer(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    // Process entries in parallel for better performance
    const promises = entries.map(async (entry) => {
      try {
        // Try database first, then file as backup
        if (this.enableDatabase) {
          await this.writeToDatabase(entry);
        } else if (this.enableFiles) {
          this.writeToFile(entry);
        }
      } catch (error) {
        console.error('Failed to flush audit entry:', error);
        // Fallback to file if database fails
        if (this.enableFiles && this.enableDatabase) {
          this.writeToFile(entry);
        }
      }
    });

    await Promise.allSettled(promises);
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
      correlationId: details?.correlationId || this.generateCorrelationId(),
      ...details,
    };

    // Add to buffer for batch writing
    this.buffer.push(entry);

    // Immediate flush for critical events
    if (severity === AuditSeverity.CRITICAL) {
      this.flushBuffer().catch(console.error);
    }

    // Console output in development
    if (process.env.NODE_ENV === 'development') {
      this.logToConsole(entry);
    }
  }

  private generateCorrelationId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
    startDate: Date,
    endDate: Date,
    filters?: {
      userId?: string;
      eventType?: AuditEventType;
      severity?: AuditSeverity;
      resource?: string;
      result?: 'SUCCESS' | 'FAILURE';
    },
  ): Promise<{
    entries: any[];
    summary: {
      total: number;
      byEventType: Record<string, number>;
      bySeverity: Record<string, number>;
      byResult: Record<string, number>;
      byUser: Record<string, number>;
    };
  }> {
    if (!this.enableDatabase) {
      throw new Error('Database audit logging must be enabled for report generation');
    }

    try {
      // Build dynamic WHERE clause based on filters
      let whereConditions = sql`${auditLogTable.timestamp} BETWEEN ${startDate.toISOString()} AND ${endDate.toISOString()}`;

      if (filters?.userId) {
        whereConditions = sql`${whereConditions} AND ${auditLogTable.userId} = ${filters.userId}`;
      }

      if (filters?.resource) {
        whereConditions = sql`${whereConditions} AND ${auditLogTable.resource} = ${filters.resource}`;
      }

      if (filters?.eventType) {
        whereConditions = sql`${whereConditions} AND ${auditLogTable.action} LIKE ${`%${filters.eventType}%`}`;
      }

      // Fetch audit entries
      const entries = await db
        .select()
        .from(auditLogTable)
        .where(whereConditions)
        .orderBy(sql`${auditLogTable.timestamp} DESC`);

      // Generate summary statistics
      const summary = {
        total: entries.length,
        byEventType: {} as Record<string, number>,
        bySeverity: {} as Record<string, number>,
        byResult: {} as Record<string, number>,
        byUser: {} as Record<string, number>,
      };

      entries.forEach((entry) => {
        const metadata = entry.metadata as any;
        if (metadata) {
          // Count by event type
          const eventType = metadata.eventType || 'unknown';
          summary.byEventType[eventType] = (summary.byEventType[eventType] || 0) + 1;

          // Count by severity
          const severity = metadata.severity || 'unknown';
          summary.bySeverity[severity] = (summary.bySeverity[severity] || 0) + 1;

          // Count by result
          const result = metadata.result || 'unknown';
          summary.byResult[result] = (summary.byResult[result] || 0) + 1;
        }

        // Count by user
        if (entry.userId) {
          summary.byUser[entry.userId] = (summary.byUser[entry.userId] || 0) + 1;
        }
      });

      return { entries, summary };
    } catch (error) {
      console.error('Failed to generate audit report:', error);
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    await this.flushBuffer();
  }

  // Enhanced logging methods for comprehensive audit trail

  public logApiRequest(req: any, res: any, duration: number): void {
    const eventType =
      req.method === 'GET'
        ? AuditEventType.DATA_READ
        : req.method === 'POST'
          ? AuditEventType.DATA_CREATE
          : req.method === 'PUT' || req.method === 'PATCH'
            ? AuditEventType.DATA_UPDATE
            : req.method === 'DELETE'
              ? AuditEventType.DATA_DELETE
              : AuditEventType.DATA_READ;

    this.log(
      eventType,
      res.statusCode >= 400 ? AuditSeverity.WARNING : AuditSeverity.INFO,
      res.statusCode < 400 ? 'SUCCESS' : 'FAILURE',
      {
        userId: req.user?.id || 'anonymous',
        sessionId: req.sessionID || req.headers['x-session-id'],
        ipAddress: this.getClientIP(req),
        userAgent: req.headers['user-agent'],
        resource: req.route?.path || req.path,
        action: req.method,
        details: {
          url: req.url,
          method: req.method,
          statusCode: res.statusCode,
          duration,
          bodySize: JSON.stringify(req.body || {}).length,
          query: req.query,
          params: req.params,
        },
      },
    );
  }

  public logDataModification(
    userId: string,
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    resource: string,
    resourceId: string,
    beforeState?: any,
    afterState?: any,
    metadata?: Record<string, any>,
  ): void {
    const eventType = {
      CREATE: AuditEventType.DATA_CREATE,
      UPDATE: AuditEventType.DATA_UPDATE,
      DELETE: AuditEventType.DATA_DELETE,
    }[action];

    this.log(eventType, AuditSeverity.INFO, 'SUCCESS', {
      userId,
      resource,
      action,
      beforeState,
      afterState,
      details: {
        resourceId,
        ...metadata,
      },
    });
  }

  public logExport(
    userId: string,
    exportType: string,
    resourceIds: string[],
    format: string,
    includesPII: boolean,
  ): void {
    this.log(
      AuditEventType.DATA_EXPORT,
      includesPII ? AuditSeverity.WARNING : AuditSeverity.INFO,
      'SUCCESS',
      {
        userId,
        resource: 'export',
        action: 'EXPORT',
        details: {
          exportType,
          resourceIds,
          format,
          includesPII,
          resourceCount: resourceIds.length,
        },
      },
    );
  }

  private getClientIP(req: any): string {
    return (
      req.ip ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      'unknown'
    );
  }
}

// Export singleton instance with default configuration
export const auditLogger = new AuditLogger({
  enableDatabase: process.env.AUDIT_ENABLE_DATABASE !== 'false',
  enableFiles: process.env.AUDIT_ENABLE_FILES !== 'false',
});

// Ensure clean shutdown
process.on('SIGINT', async () => {
  await auditLogger.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await auditLogger.shutdown();
  process.exit(0);
});

process.on('SIGQUIT', async () => {
  await auditLogger.shutdown();
  process.exit(0);
});

export default auditLogger;
