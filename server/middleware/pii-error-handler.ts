import { NextFunction, Request, Response } from 'express';
import { piiRedactor } from '../services/pii-redactor';
import { AuditEventType, auditLogger, AuditSeverity } from '../utils/audit-logger';

/**
 * PII-aware error handling middleware
 */

interface PIIErrorOptions {
  includeStackTrace?: boolean;
  logErrors?: boolean;
  redactErrorDetails?: boolean;
  showDetailedErrors?: boolean;
}

const DEFAULT_ERROR_OPTIONS: PIIErrorOptions = {
  includeStackTrace: process.env.NODE_ENV === 'development',
  logErrors: true,
  redactErrorDetails: true,
  showDetailedErrors: process.env.NODE_ENV === 'development',
};

/**
 * Main PII error handler middleware
 */
export function piiErrorHandler(options: PIIErrorOptions = {}) {
  const config = { ...DEFAULT_ERROR_OPTIONS, ...options };

  return (error: any, req: Request, res: Response, _next: NextFunction) => {
    const userRole = req.user?.role || 'guest';
    const userId = req.user?.id || 'anonymous';

    // Extract error information
    const errorInfo = extractErrorInfo(error);

    // Redact PII from error message and details
    let redactedMessage = errorInfo.message;
    let redactedDetails = errorInfo.details;
    let redactedStack = errorInfo.stack;

    if (config.redactErrorDetails) {
      // Redact error message
      const messageResult = piiRedactor.redact(errorInfo.message, userRole);
      redactedMessage = messageResult.redactedText;

      // Redact error details if they exist
      if (errorInfo.details) {
        const { redacted } = piiRedactor.redactObject(errorInfo.details, userRole);
        redactedDetails = redacted;
      }

      // Redact stack trace for non-admin users
      if (errorInfo.stack && userRole !== 'admin') {
        const stackResult = piiRedactor.redact(errorInfo.stack, userRole);
        redactedStack = stackResult.redactedText;
      }
    }

    // Log the error with redaction
    if (config.logErrors) {
      auditLogger.log(AuditEventType.ERROR, mapErrorSeverity(errorInfo.status), 'FAILURE', {
        userId,
        resource: req.path,
        action: req.method,
        errorMessage: redactedMessage,
        stackTrace: userRole === 'admin' ? errorInfo.stack : redactedStack,
        details: {
          statusCode: errorInfo.status,
          errorType: errorInfo.name,
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          ...redactedDetails,
        },
      });
    }

    // Prepare response based on environment and user role
    const errorResponse = buildErrorResponse(
      errorInfo,
      redactedMessage,
      redactedDetails,
      redactedStack,
      userRole,
      config,
    );

    // Send response
    res.status(errorInfo.status).json(errorResponse);
  };
}

/**
 * Specific error handler for validation errors with PII redaction
 */
export function piiValidationErrorHandler() {
  return (error: any, req: Request, res: Response, next: NextFunction) => {
    if (error.name !== 'ValidationError' && !error.isJoi) {
      return next(error);
    }

    const userRole = req.user?.role || 'guest';
    const userId = req.user?.id || 'anonymous';

    // Extract validation error details
    const validationErrors = extractValidationErrors(error);

    // Redact PII from validation error messages
    const redactedErrors = validationErrors.map((validationError) => {
      const result = piiRedactor.redact(validationError.message, userRole);
      return {
        field: validationError.field,
        message: result.redactedText,
        value: validationError.value ? '[REDACTED]' : undefined,
      };
    });

    // Log validation error
    auditLogger.log(AuditEventType.ERROR, AuditSeverity.WARNING, 'FAILURE', {
      userId,
      resource: req.path,
      action: 'VALIDATION_ERROR',
      details: {
        errorCount: redactedErrors.length,
        fields: redactedErrors.map((e) => e.field),
      },
    });

    res.status(400).json({
      error: 'Validation failed',
      message: 'The submitted data contains errors',
      errors: redactedErrors,
      timestamp: new Date().toISOString(),
    });
  };
}

/**
 * Database error handler with PII redaction
 */
export function piiDatabaseErrorHandler() {
  return (error: any, req: Request, res: Response, next: NextFunction) => {
    if (!isDatabaseError(error)) {
      return next(error);
    }

    const userRole = req.user?.role || 'guest';
    const userId = req.user?.id || 'anonymous';

    // Redact PII from database error
    const redactedMessage = piiRedactor.redact(error.message, userRole).redactedText;

    // Log database error
    auditLogger.log(AuditEventType.ERROR, AuditSeverity.ERROR, 'FAILURE', {
      userId,
      resource: req.path,
      action: 'DATABASE_ERROR',
      errorMessage: redactedMessage,
      details: {
        errorCode: error.code,
        errorType: error.name,
        constraint: error.constraint,
        table: error.table,
        column: error.column,
      },
    });

    // Return generic database error message
    const errorResponse = {
      error: 'Database operation failed',
      message:
        userRole === 'admin'
          ? redactedMessage
          : 'A database error occurred. Please try again or contact support.',
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && {
        details: {
          code: error.code,
          constraint: error.constraint,
        },
      }),
    };

    res.status(500).json(errorResponse);
  };
}

/**
 * Authentication error handler with PII redaction
 */
export function piiAuthErrorHandler() {
  return (error: any, req: Request, res: Response, next: NextFunction) => {
    if (!isAuthError(error)) {
      return next(error);
    }

    const userId = req.user?.id || 'anonymous';

    // Log auth error (no PII redaction needed for auth errors)
    auditLogger.log(AuditEventType.LOGIN_FAILURE, AuditSeverity.WARNING, 'FAILURE', {
      userId,
      resource: req.path,
      action: 'AUTHENTICATION_ERROR',
      errorMessage: error.message,
      details: {
        errorType: error.name,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    res.status(error.status || 401).json({
      error: 'Authentication failed',
      message: 'Invalid credentials or session expired',
      timestamp: new Date().toISOString(),
    });
  };
}

/**
 * Extract structured error information
 */
function extractErrorInfo(error: any) {
  return {
    name: error.name || 'Error',
    message: error.message || 'An unexpected error occurred',
    status: error.status || error.statusCode || 500,
    stack: error.stack,
    details: error.details || error.data,
    code: error.code,
  };
}

/**
 * Extract validation error details
 */
function extractValidationErrors(
  error: any,
): Array<{ field: string; message: string; value?: any }> {
  const errors: Array<{ field: string; message: string; value?: any }> = [];

  if (error.details && Array.isArray(error.details)) {
    // Joi validation errors
    for (const detail of error.details) {
      errors.push({
        field: detail.path?.join('.') || 'unknown',
        message: detail.message,
        value: detail.context?.value,
      });
    }
  } else if (error.errors && Array.isArray(error.errors)) {
    // Mongoose validation errors
    for (const validationError of error.errors) {
      errors.push({
        field: validationError.path || 'unknown',
        message: validationError.message,
        value: validationError.value,
      });
    }
  } else {
    errors.push({
      field: 'unknown',
      message: error.message,
    });
  }

  return errors;
}

/**
 * Build error response based on configuration and user role
 */
function buildErrorResponse(
  errorInfo: any,
  redactedMessage: string,
  redactedDetails: any,
  redactedStack: string,
  userRole: string,
  config: PIIErrorOptions,
) {
  const response: any = {
    error: getErrorTitle(errorInfo.status),
    message: redactedMessage,
    timestamp: new Date().toISOString(),
    status: errorInfo.status,
  };

  // Include additional details for development or admin users
  if (config.showDetailedErrors || userRole === 'admin') {
    if (redactedDetails) {
      response.details = redactedDetails;
    }

    if (config.includeStackTrace && redactedStack) {
      response.stack = redactedStack;
    }

    response.errorType = errorInfo.name;
  }

  return response;
}

/**
 * Map error status codes to severity levels
 */
function mapErrorSeverity(status: number): AuditSeverity {
  if (status >= 500) return AuditSeverity.ERROR;
  if (status >= 400) return AuditSeverity.WARNING;
  return AuditSeverity.INFO;
}

/**
 * Get user-friendly error title
 */
function getErrorTitle(status: number): string {
  const titles: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Validation Error',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  };

  return titles[status] || 'Error';
}

/**
 * Check if error is a database error
 */
function isDatabaseError(error: any): boolean {
  const dbErrorNames = [
    'SequelizeError',
    'QueryError',
    'DatabaseError',
    'MongoError',
    'PostgresError',
  ];

  return (
    dbErrorNames.includes(error.name) ||
    error.code?.startsWith('23') || // PostgreSQL constraint violations
    error.code?.startsWith('42')
  ); // PostgreSQL syntax errors
}

/**
 * Check if error is an authentication error
 */
function isAuthError(error: any): boolean {
  const authErrorNames = [
    'AuthenticationError',
    'TokenExpiredError',
    'JsonWebTokenError',
    'UnauthorizedError',
  ];

  return authErrorNames.includes(error.name) || error.status === 401 || error.statusCode === 401;
}

export default {
  piiErrorHandler,
  piiValidationErrorHandler,
  piiDatabaseErrorHandler,
  piiAuthErrorHandler,
};
