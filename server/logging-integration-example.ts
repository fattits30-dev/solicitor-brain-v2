// Example integration of structured logging across the server
// This shows how to properly use the structured logger in different contexts

import { structuredLogger, LogCategory } from './services/structured-logger';
import type { Request, Response, NextFunction } from 'express';

// ==========================================
// 1. Server Startup and Initialization
// ==========================================

export async function initializeServer() {
  try {
    await structuredLogger.info(
      'Server initialization started',
      LogCategory.SYSTEM,
      {
        metadata: {
          nodeEnv: process.env.NODE_ENV,
          port: process.env.PORT || 3000,
          operation: 'server_init_start'
        }
      },
      ['server', 'init', 'start']
    );

    // Database connection
    await connectDatabase();
    
    // Redis connection  
    await connectRedis();
    
    // Initialize AI services
    await initializeAI();

    await structuredLogger.info(
      'Server initialization completed successfully',
      LogCategory.SYSTEM,
      {
        metadata: {
          uptime: process.uptime(),
          operation: 'server_init_complete'
        }
      },
      ['server', 'init', 'complete']
    );

  } catch (error) {
    await structuredLogger.fatal(
      'Server initialization failed',
      LogCategory.SYSTEM,
      error as Error,
      {
        metadata: {
          operation: 'server_init_failed'
        }
      },
      ['server', 'init', 'failed']
    );
    throw error;
  }
}

async function connectDatabase() {
  try {
    // Database connection logic here
    await structuredLogger.info(
      'Database connected successfully',
      LogCategory.DATABASE,
      {
        metadata: {
          dbUrl: process.env.DATABASE_URL ? '[REDACTED]' : 'not_set',
          operation: 'db_connect'
        }
      },
      ['database', 'connect', 'success']
    );
  } catch (error) {
    await structuredLogger.error(
      'Database connection failed',
      LogCategory.DATABASE,
      error as Error,
      {
        metadata: {
          operation: 'db_connect_failed'
        }
      },
      ['database', 'connect', 'failed']
    );
    throw error;
  }
}

async function connectRedis() {
  try {
    // Redis connection logic here
    await structuredLogger.info(
      'Redis connected successfully',
      LogCategory.SYSTEM,
      {
        metadata: {
          redisUrl: process.env.REDIS_URL ? '[REDACTED]' : 'not_set',
          operation: 'redis_connect'
        }
      },
      ['redis', 'connect', 'success']
    );
  } catch (error) {
    await structuredLogger.error(
      'Redis connection failed',
      LogCategory.SYSTEM,
      error as Error,
      {
        metadata: {
          operation: 'redis_connect_failed'
        }
      },
      ['redis', 'connect', 'failed']
    );
    throw error;
  }
}

async function initializeAI() {
  try {
    // AI service initialization
    await structuredLogger.info(
      'AI services initialization started',
      LogCategory.AI_SERVICE,
      {
        metadata: {
          aiEnabled: process.env.ENABLE_AI_FEATURES === 'true',
          operation: 'ai_init_start'
        }
      },
      ['ai', 'init', 'start']
    );
  } catch (error) {
    await structuredLogger.error(
      'AI services initialization failed',
      LogCategory.AI_SERVICE,
      error as Error,
      {
        metadata: {
          operation: 'ai_init_failed'
        }
      },
      ['ai', 'init', 'failed']
    );
  }
}

// ==========================================
// 2. Middleware Integration
// ==========================================

export function createLoggingMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Add request ID to context
    (req as any).requestId = requestId;

    // Skip logging for certain endpoints
    const skipPaths = ['/health', '/ping', '/metrics'];
    if (skipPaths.includes(req.path)) {
      return next();
    }

    const requestContext = structuredLogger.createRequestContext(req);
    requestContext.correlationId = requestId;

    await structuredLogger.info(
      `Incoming request: ${req.method} ${req.path}`,
      LogCategory.API,
      requestContext,
      ['api', 'request', 'incoming']
    );

    // Capture response
    const originalSend = res.send;
    res.send = function(body: any) {
      const duration = Date.now() - startTime;
      const responseContext = {
        ...requestContext,
        duration,
        metadata: {
          ...requestContext.metadata,
          statusCode: res.statusCode,
          responseSize: typeof body === 'string' ? body.length : JSON.stringify(body).length
        }
      };

      // Log response
      if (res.statusCode >= 400) {
        structuredLogger.error(
          `Request failed: ${req.method} ${req.path} - ${res.statusCode}`,
          LogCategory.API,
          new Error(`HTTP ${res.statusCode}`),
          responseContext,
          ['api', 'request', 'failed']
        );
      } else {
        structuredLogger.info(
          `Request completed: ${req.method} ${req.path} - ${res.statusCode}`,
          LogCategory.API,
          responseContext,
          ['api', 'request', 'completed']
        );
      }

      return originalSend.call(this, body);
    };

    next();
  };
}

// ==========================================
// 3. Error Handling Integration
// ==========================================

export function createErrorHandler() {
  return async (error: Error, req: Request, res: Response, _next: NextFunction) => {
    const requestContext = structuredLogger.createRequestContext(req);
    requestContext.correlationId = (req as any).requestId;

    await structuredLogger.error(
      `Unhandled error in request: ${error.message}`,
      LogCategory.SYSTEM,
      error,
      requestContext,
      ['error', 'unhandled', 'api']
    );

    // Send generic error response (don't leak internal details)
    res.status(500).json({
      error: 'Internal server error',
      requestId: (req as any).requestId
    });
  };
}

// ==========================================
// 4. Database Operation Logging
// ==========================================

export class LoggedDatabase {
  static async executeQuery(query: string, params: any[], userId?: string) {
    const startTime = Date.now();
    
    try {
      await structuredLogger.debug(
        'Database query started',
        LogCategory.DATABASE,
        {
          userId,
          metadata: {
            queryType: query.split(' ')[0].toUpperCase(),
            paramCount: params.length,
            operation: 'db_query_start'
          }
        },
        ['database', 'query', 'start']
      );

      // Execute actual query here
      const result = await this.performQuery(query, params);
      
      const duration = Date.now() - startTime;
      
      await structuredLogger.debug(
        'Database query completed',
        LogCategory.DATABASE,
        {
          userId,
          duration,
          metadata: {
            queryType: query.split(' ')[0].toUpperCase(),
            rowCount: result.rows?.length || 0,
            operation: 'db_query_complete'
          }
        },
        ['database', 'query', 'complete']
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      await structuredLogger.error(
        'Database query failed',
        LogCategory.DATABASE,
        error as Error,
        {
          userId,
          duration,
          metadata: {
            queryType: query.split(' ')[0].toUpperCase(),
            operation: 'db_query_failed'
          }
        },
        ['database', 'query', 'failed']
      );
      
      throw error;
    }
  }

  private static async performQuery(_query: string, _params: any[]): Promise<any> {
    // Actual database query implementation
    return { rows: [] };
  }
}

// ==========================================
// 5. Business Logic Integration Example
// ==========================================

export class DocumentService {
  static async processDocument(documentId: string, userId: string, operation: string) {
    const startTime = Date.now();
    
    try {
      await structuredLogger.logDocumentProcessing(
        documentId,
        operation,
        false, // not completed yet
        undefined,
        undefined,
        {
          userId,
          metadata: {
            operation: `${operation}_start`
          }
        }
      );

      // Simulate document processing
      await this.performDocumentOperation(documentId, operation);

      const duration = Date.now() - startTime;

      await structuredLogger.logDocumentProcessing(
        documentId,
        operation,
        true, // completed successfully
        duration,
        undefined,
        {
          userId,
          metadata: {
            operation: `${operation}_complete`
          }
        }
      );

    } catch (error) {
      const duration = Date.now() - startTime;

      await structuredLogger.logDocumentProcessing(
        documentId,
        operation,
        false, // failed
        duration,
        error as Error,
        {
          userId,
          metadata: {
            operation: `${operation}_failed`
          }
        }
      );

      throw error;
    }
  }

  private static async performDocumentOperation(_documentId: string, _operation: string) {
    // Actual document processing logic
    return true;
  }
}

// ==========================================
// 6. Graceful Shutdown Logging
// ==========================================

export async function gracefulShutdown(signal: string) {
  await structuredLogger.info(
    `Graceful shutdown initiated by ${signal}`,
    LogCategory.SYSTEM,
    {
      metadata: {
        signal,
        uptime: process.uptime(),
        operation: 'graceful_shutdown_start'
      }
    },
    ['server', 'shutdown', 'start']
  );

  try {
    // Close database connections
    // Close Redis connections
    // Stop background jobs
    
    await structuredLogger.info(
      'Server shut down completed',
      LogCategory.SYSTEM,
      {
        metadata: {
          signal,
          operation: 'graceful_shutdown_complete'
        }
      },
      ['server', 'shutdown', 'complete']
    );

  } catch (error) {
    await structuredLogger.error(
      'Error during graceful shutdown',
      LogCategory.SYSTEM,
      error as Error,
      {
        metadata: {
          signal,
          operation: 'graceful_shutdown_error'
        }
      },
      ['server', 'shutdown', 'error']
    );
  }
}

// ==========================================
// 7. Performance Monitoring Integration
// ==========================================

export class PerformanceMonitor {
  static async monitorSystemHealth() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    await structuredLogger.info(
      'System health check',
      LogCategory.PERFORMANCE,
      {
        metadata: {
          memoryUsage: {
            rss: Math.round(memUsage.rss / 1024 / 1024), // MB
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
          },
          cpuUsage: {
            user: cpuUsage.user,
            system: cpuUsage.system
          },
          uptime: process.uptime(),
          operation: 'health_check'
        }
      },
      ['system', 'health', 'metrics']
    );
  }

  static startPeriodicHealthChecks(intervalMs: number = 60000) {
    setInterval(() => {
      this.monitorSystemHealth().catch(error => {
        structuredLogger.error(
          'Health check failed',
          LogCategory.PERFORMANCE,
          error,
          { metadata: { operation: 'health_check_failed' } },
          ['system', 'health', 'failed']
        );
      });
    }, intervalMs);
  }
}