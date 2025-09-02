import { Request, Response, NextFunction } from 'express';
import { auditLogger, AuditEventType, AuditSeverity } from '../utils/audit-logger';

// Extend Request interface to include audit context
declare global {
  namespace Express {
    interface Request {
      auditContext?: {
        correlationId: string;
        startTime: number;
        beforeState?: any;
        skipAudit?: boolean;
      };
    }
  }
}

/**
 * Comprehensive audit middleware that logs all API requests
 * Tracks timing, user context, and request/response details
 */
export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const correlationId = generateCorrelationId();
  
  // Add audit context to request
  req.auditContext = {
    correlationId,
    startTime,
    skipAudit: false
  };

  // Skip audit for certain paths (health checks, static assets)
  if (shouldSkipAudit(req)) {
    req.auditContext.skipAudit = true;
    return next();
  }

  // Capture response data
  const originalSend = res.send;
  const originalJson = res.json;
  let responseBody: any;

  res.send = function(body: any) {
    responseBody = body;
    return originalSend.call(this, body);
  };

  res.json = function(body: any) {
    responseBody = body;
    return originalJson.call(this, body);
  };

  // Log the request when response finishes
  res.on('finish', () => {
    if (req.auditContext?.skipAudit) return;

    const duration = Date.now() - startTime;
    
    try {
      auditLogger.logApiRequest(req, res, duration);
      
      // Additional logging for sensitive operations
      if (isSensitiveOperation(req)) {
        logSensitiveOperation(req, res, responseBody, correlationId);
      }
    } catch (error) {
      console.error('Audit middleware error:', error);
    }
  });

  next();
}

/**
 * Middleware to capture "before" state for data modification operations
 * Should be used before operations that modify data
 */
export function captureBeforeState(resourceExtractor: (req: Request) => Promise<any>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.auditContext?.skipAudit) {
      return next();
    }

    try {
      if (isModificationOperation(req)) {
        const beforeState = await resourceExtractor(req);
        if (req.auditContext) {
          req.auditContext.beforeState = beforeState;
        }
      }
    } catch (error) {
      console.error('Failed to capture before state:', error);
    }

    next();
  };
}

/**
 * Log data modification with before/after state comparison
 */
export function logDataModification(
  req: Request,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  resource: string,
  resourceId: string,
  afterState?: any
): void {
  if (req.auditContext?.skipAudit) return;

  const userId = req.user?.id || 'anonymous';
  const beforeState = req.auditContext?.beforeState;

  auditLogger.logDataModification(
    userId,
    action,
    resource,
    resourceId,
    beforeState,
    afterState,
    {
      correlationId: req.auditContext?.correlationId,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent']
    }
  );
}

/**
 * Log authentication events with enhanced context
 */
export function logAuthEvent(
  eventType: 'LOGIN_SUCCESS' | 'LOGIN_FAILURE' | 'LOGOUT' | 'TOKEN_REFRESH' | 'PASSWORD_CHANGE',
  req: Request,
  userId?: string,
  additionalData?: Record<string, any>
): void {
  const auditEventType = {
    LOGIN_SUCCESS: AuditEventType.LOGIN_SUCCESS,
    LOGIN_FAILURE: AuditEventType.LOGIN_FAILURE,
    LOGOUT: AuditEventType.LOGOUT,
    TOKEN_REFRESH: AuditEventType.TOKEN_REFRESH,
    PASSWORD_CHANGE: AuditEventType.PASSWORD_CHANGE
  }[eventType];

  const severity = eventType === 'LOGIN_FAILURE' ? AuditSeverity.WARNING : AuditSeverity.INFO;
  const result = eventType === 'LOGIN_FAILURE' ? 'FAILURE' : 'SUCCESS';

  auditLogger.log(
    auditEventType,
    severity,
    result,
    {
      userId: userId || req.user?.id || 'anonymous',
      sessionId: req.sessionID || req.headers['x-session-id'] as string,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      resource: 'authentication',
      action: eventType,
      details: {
        timestamp: new Date().toISOString(),
        ...additionalData
      }
    }
  );
}

/**
 * Log export operations with PII detection
 */
export function logExportOperation(
  req: Request,
  exportType: string,
  resourceIds: string[],
  format: string,
  containsPII: boolean = true
): void {
  if (req.auditContext?.skipAudit) return;

  const userId = req.user?.id || 'anonymous';
  
  auditLogger.logExport(userId, exportType, resourceIds, format, containsPII);
  
  // Additional high-severity log for PII exports
  if (containsPII) {
    auditLogger.log(
      AuditEventType.DATA_EXPORT,
      AuditSeverity.WARNING,
      'SUCCESS',
      {
        userId,
        resource: 'pii-export',
        action: 'EXPORT_PII',
        details: {
          exportType,
          resourceCount: resourceIds.length,
          format,
          timestamp: new Date().toISOString(),
          requiresRetention: true
        }
      }
    );
  }
}

/**
 * Log permission changes
 */
export function logPermissionChange(
  req: Request,
  targetUserId: string,
  action: 'GRANT' | 'REVOKE',
  permissions: string[],
  reason?: string
): void {
  if (req.auditContext?.skipAudit) return;

  auditLogger.log(
    AuditEventType.PERMISSION_CHANGE,
    AuditSeverity.WARNING,
    'SUCCESS',
    {
      userId: req.user?.id || 'anonymous',
      sessionId: req.sessionID || req.headers['x-session-id'] as string,
      ipAddress: getClientIP(req),
      resource: 'permissions',
      action: action,
      details: {
        targetUserId,
        permissions,
        reason,
        timestamp: new Date().toISOString()
      }
    }
  );
}

/**
 * Log GDPR compliance events
 */
export function logGDPREvent(
  req: Request,
  eventType: 'CONSENT_GIVEN' | 'CONSENT_WITHDRAWN' | 'DATA_REQUEST' | 'DATA_DELETION',
  dataSubjectId: string,
  scope?: string,
  additionalData?: Record<string, any>
): void {
  if (req.auditContext?.skipAudit) return;

  auditLogger.logGDPREvent(
    eventType,
    dataSubjectId,
    {
      scope,
      requestedBy: req.user?.id || 'anonymous',
      ipAddress: getClientIP(req),
      timestamp: new Date().toISOString(),
      ...additionalData
    }
  );
}

/**
 * Log system errors with full context
 */
export function logError(
  req: Request,
  error: Error,
  context?: Record<string, any>
): void {
  if (req.auditContext?.skipAudit) return;

  auditLogger.logError(error, req.user?.id, {
    correlationId: req.auditContext?.correlationId,
    url: req.url,
    method: req.method,
    ipAddress: getClientIP(req),
    userAgent: req.headers['user-agent'],
    ...context
  });
}

// Helper functions

function generateCorrelationId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function shouldSkipAudit(req: Request): boolean {
  const skipPaths = [
    '/api/health',
    '/favicon.ico',
    '/ping',
    '/metrics'
  ];
  
  const skipPatterns = [
    /^\/static\//,
    /^\/assets\//,
    /^\/public\//,
    /\.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$/
  ];

  // Skip certain paths
  if (skipPaths.includes(req.path)) {
    return true;
  }

  // Skip asset patterns
  if (skipPatterns.some(pattern => pattern.test(req.path))) {
    return true;
  }

  // Skip OPTIONS requests
  if (req.method === 'OPTIONS') {
    return true;
  }

  return false;
}

function isSensitiveOperation(req: Request): boolean {
  const sensitivePaths = [
    '/api/auth',
    '/api/users',
    '/api/export',
    '/api/cases',
    '/api/documents'
  ];

  return sensitivePaths.some(path => req.path.startsWith(path)) ||
         isModificationOperation(req);
}

function isModificationOperation(req: Request): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
}

function logSensitiveOperation(
  req: Request,
  res: Response,
  responseBody: any,
  correlationId: string
): void {
  const severity = res.statusCode >= 400 ? AuditSeverity.ERROR : AuditSeverity.INFO;
  const result = res.statusCode < 400 ? 'SUCCESS' : 'FAILURE';

  let eventType = AuditEventType.DATA_READ;
  if (req.path.startsWith('/api/auth')) {
    eventType = AuditEventType.LOGIN_SUCCESS;
  } else if (req.path.includes('/export')) {
    eventType = AuditEventType.DATA_EXPORT;
  } else if (isModificationOperation(req)) {
    eventType = req.method === 'POST' ? AuditEventType.DATA_CREATE :
                req.method === 'DELETE' ? AuditEventType.DATA_DELETE :
                AuditEventType.DATA_UPDATE;
  }

  auditLogger.log(
    eventType,
    severity,
    result,
    {
      userId: req.user?.id || 'anonymous',
      sessionId: req.sessionID || req.headers['x-session-id'] as string,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      resource: extractResourceFromPath(req.path),
      action: req.method,
      correlationId,
      details: {
        url: req.url,
        statusCode: res.statusCode,
        responseSize: JSON.stringify(responseBody || {}).length,
        sensitive: true
      }
    }
  );
}

function extractResourceFromPath(path: string): string {
  const segments = path.split('/').filter(Boolean);
  if (segments.length >= 2 && segments[0] === 'api') {
    return segments[1];
  }
  return 'unknown';
}

function getClientIP(req: Request): string {
  return req.ip || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         (req.headers['x-forwarded-for'] as string || '').split(',')[0].trim() ||
         'unknown';
}

// Re-export audit logger for convenience
export { auditLogger };