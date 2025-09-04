import { Request, Response, NextFunction } from 'express';
import { piiRedactor, RedactionLevel } from '../services/pii-redactor';
import { auditLogger, AuditEventType, AuditSeverity } from '../utils/audit-logger';

/**
 * Middleware for PII-aware logging and response redaction
 */

interface PIILoggingOptions {
  logRequests?: boolean;
  logResponses?: boolean;
  redactResponses?: boolean;
  sensitiveRoutes?: string[];
  excludeRoutes?: string[];
  maxBodySize?: number;
}

const DEFAULT_OPTIONS: PIILoggingOptions = {
  logRequests: true,
  logResponses: true,
  redactResponses: true,
  sensitiveRoutes: ['/api/cases', '/api/persons', '/api/documents'],
  excludeRoutes: ['/api/health', '/api/ping'],
  maxBodySize: 10000, // 10KB max for logging
};

/**
 * PII-aware request/response logging middleware
 */
export function piiLoggingMiddleware(options: PIILoggingOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };

  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const userRole = req.user?.role || 'guest';
    const userId = req.user?.id || 'anonymous';

    // Skip excluded routes
    if (config.excludeRoutes?.some(route => req.path.startsWith(route))) {
      return next();
    }

    // Determine if this is a sensitive route
    const isSensitiveRoute = config.sensitiveRoutes?.some(route => req.path.startsWith(route));

    // Log incoming request (with redaction for sensitive routes)
    if (config.logRequests) {
      logRequest(req, userRole, isSensitiveRoute, config.maxBodySize);
    }

    // Capture original response methods
    const originalSend = res.send;
    const originalJson = res.json;
    
    let responseData: any;
    let responseCaptured = false;

    // Override res.json to capture response data
    res.json = function(body: any) {
      if (!responseCaptured) {
        responseData = body;
        responseCaptured = true;

        // Apply PII redaction to responses if enabled
        if (config.redactResponses && (isSensitiveRoute || shouldRedactResponse(req, res))) {
          const { redacted, summary } = piiRedactor.redactObject(body, userRole);
          
          // Log redaction summary if PII was found
          if (summary.length > 0) {
            auditLogger.log(
              AuditEventType.DATA_READ,
              AuditSeverity.INFO,
              'SUCCESS',
              {
                userId,
                resource: req.path,
                action: 'RESPONSE_REDACTION',
                details: {
                  redactionsSummary: summary.map(s => ({
                    level: s.level,
                    rulesApplied: s.redactionsApplied.length,
                    categories: s.redactionsApplied.map(r => r.category)
                  }))
                }
              }
            );
          }

          return originalJson.call(this, redacted);
        }
      }
      
      return originalJson.call(this, body);
    };

    // Override res.send to capture response data
    res.send = function(data: any) {
      if (!responseCaptured) {
        responseData = data;
        responseCaptured = true;

        // Apply redaction to string responses if needed
        if (config.redactResponses && typeof data === 'string' && isSensitiveRoute) {
          const result = piiRedactor.redact(data, userRole);
          
          if (result.redactionsApplied.length > 0) {
            auditLogger.log(
              AuditEventType.DATA_READ,
              AuditSeverity.INFO,
              'SUCCESS',
              {
                userId,
                resource: req.path,
                action: 'RESPONSE_REDACTION',
                details: {
                  redactionLevel: result.level,
                  rulesApplied: result.redactionsApplied.length
                }
              }
            );
          }

          return originalSend.call(this, result.redactedText);
        }
      }
      
      return originalSend.call(this, data);
    };

    // Log response when request completes
    res.on('finish', () => {
      const duration = Date.now() - startTime;

      if (config.logResponses) {
        logResponse(req, res, responseData, userRole, isSensitiveRoute, duration);
      }
    });

    next();
  };
}

/**
 * Log incoming request with PII redaction
 */
function logRequest(req: Request, userRole: string, isSensitive: boolean, maxBodySize?: number) {
  const userId = req.user?.id || 'anonymous';
  
  // Prepare request details
  const requestDetails: any = {
    method: req.method,
    path: req.path,
    query: req.query,
    headers: filterHeaders(req.headers),
    userAgent: req.get('User-Agent'),
    ipAddress: req.ip || req.connection.remoteAddress,
  };

  // Include body for sensitive routes or POST/PUT/PATCH requests
  if (req.body && (isSensitive || ['POST', 'PUT', 'PATCH'].includes(req.method))) {
    const bodyStr = JSON.stringify(req.body);
    
    if (!maxBodySize || bodyStr.length <= maxBodySize) {
      // Redact PII from request body
      const { redacted } = piiRedactor.redactObject(req.body, userRole);
      requestDetails.body = redacted;
    } else {
      requestDetails.body = '[BODY_TOO_LARGE_FOR_LOGGING]';
    }
  }

  // Log the request
  auditLogger.log(
    AuditEventType.DATA_READ,
    AuditSeverity.INFO,
    'SUCCESS',
    {
      userId,
      resource: req.path,
      action: 'REQUEST',
      details: requestDetails,
    }
  );
}

/**
 * Log outgoing response with PII redaction
 */
function logResponse(
  req: Request, 
  res: Response, 
  responseData: any,
  userRole: string,
  isSensitive: boolean,
  duration: number
) {
  const userId = req.user?.id || 'anonymous';

  const responseDetails: any = {
    statusCode: res.statusCode,
    statusMessage: res.statusMessage,
    duration,
    headers: filterHeaders(res.getHeaders()),
  };

  // Include response body for sensitive routes or error responses
  if (responseData && (isSensitive || res.statusCode >= 400)) {
    if (typeof responseData === 'string') {
      const result = piiRedactor.redact(responseData, userRole);
      responseDetails.body = result.redactedText;
    } else {
      const { redacted } = piiRedactor.redactObject(responseData, userRole);
      responseDetails.body = redacted;
    }
  }

  // Determine audit event type and severity
  const eventType = res.statusCode >= 400 ? AuditEventType.ERROR : AuditEventType.DATA_READ;
  const severity = res.statusCode >= 500 ? AuditSeverity.ERROR : 
                   res.statusCode >= 400 ? AuditSeverity.WARNING : AuditSeverity.INFO;

  auditLogger.log(
    eventType,
    severity,
    res.statusCode < 400 ? 'SUCCESS' : 'FAILURE',
    {
      userId,
      resource: req.path,
      action: 'RESPONSE',
      details: responseDetails,
    }
  );
}

/**
 * Filter sensitive headers for logging
 */
function filterHeaders(headers: any): any {
  const filtered = { ...headers };
  
  // Remove sensitive headers
  const sensitiveHeaders = [
    'authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'x-auth-token'
  ];

  sensitiveHeaders.forEach(header => {
    if (filtered[header]) {
      filtered[header] = '[REDACTED]';
    }
  });

  return filtered;
}

/**
 * Determine if response should be redacted based on content type and route
 */
function shouldRedactResponse(req: Request, res: Response): boolean {
  // Always redact JSON responses containing user data
  const contentType = res.get('Content-Type') || '';
  
  if (contentType.includes('application/json')) {
    // Check if route likely contains user data
    const userDataRoutes = ['/api/users', '/api/profile', '/api/cases', '/api/persons'];
    return userDataRoutes.some(route => req.path.startsWith(route));
  }

  return false;
}

/**
 * Middleware for PII redaction warnings before data export
 */
export function piiExportWarningMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check if this is an export endpoint
    if (req.path.includes('/export') || req.query.export === 'true') {
      const userRole = req.user?.role || 'guest';
      
      // Check request body for PII
      let hasPII = false;
      let piiSummary = '';

      if (req.body) {
        const bodyStr = JSON.stringify(req.body);
        const piiCheck = piiRedactor.containsPII(bodyStr);
        
        if (piiCheck.hasPII) {
          hasPII = true;
          piiSummary = `Found PII: ${piiCheck.categories.join(', ')} (${piiCheck.ruleMatches.length} patterns)`;
        }
      }

      if (hasPII && userRole !== 'admin') {
        // Log the export attempt with PII warning
        auditLogger.log(
          AuditEventType.DATA_EXPORT,
          AuditSeverity.WARNING,
          'FAILURE',
          {
            userId: req.user?.id || 'anonymous',
            resource: req.path,
            action: 'EXPORT_BLOCKED_PII',
            details: { piiSummary, userRole }
          }
        );

        return res.status(403).json({
          error: 'Export blocked: Personal data detected',
          message: 'This export contains personal identifiable information. Please review and redact sensitive data before exporting, or contact an administrator.',
          piiDetected: true,
          categories: piiSummary
        });
      }
    }

    next();
  };
}

/**
 * Create console logger with PII redaction for development
 */
export function createPIIConsoleLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV !== 'development') {
      return next();
    }

    const userRole = req.user?.role || 'guest';
    const method = req.method;
    const path = req.path;
    
    // Log request with redaction
    if (req.body && Object.keys(req.body).length > 0) {
      const { redacted } = piiRedactor.redactObject(req.body, userRole, RedactionLevel.PARTIAL);
      console.log(`[${method}] ${path}`, { body: redacted });
    } else {
      console.log(`[${method}] ${path}`);
    }

    next();
  };
}

export default {
  piiLoggingMiddleware,
  piiExportWarningMiddleware,
  createPIIConsoleLogger
};