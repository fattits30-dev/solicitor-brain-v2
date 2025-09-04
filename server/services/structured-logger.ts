import { mcp__memory_keeper__context_save } from '../utils/mcp-client';
import { randomUUID } from 'crypto';

// Log levels matching standard severity levels
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info', 
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

// Log categories for structured organization
export enum LogCategory {
  // Core system categories
  SYSTEM = 'system',
  AUTH = 'auth',
  DATABASE = 'database',
  API = 'api',
  
  // AI/ML specific categories
  AI_SERVICE = 'ai-service',
  EMBEDDING = 'embedding',
  LLM_REQUEST = 'llm-request',
  MODEL_MANAGEMENT = 'model-management',
  
  // Document handling
  DOCUMENT_UPLOAD = 'document-upload',
  DOCUMENT_PROCESSING = 'document-processing',
  OCR = 'ocr',
  FILE_MANAGEMENT = 'file-management',
  
  // Workflow and agents
  AGENT_WORKFLOW = 'agent-workflow',
  JOB_PROCESSING = 'job-processing',
  QUEUE_MANAGEMENT = 'queue-management',
  
  // Security and compliance
  AUDIT = 'audit',
  GDPR = 'gdpr',
  SECURITY = 'security',
  PII_HANDLING = 'pii-handling',
  
  // Performance and monitoring
  PERFORMANCE = 'performance',
  METRICS = 'metrics',
  HEALTH_CHECK = 'health-check'
}

// Context interface for rich logging
interface LogContext {
  // Core identifiers
  userId?: string;
  caseId?: string;
  documentId?: string;
  sessionId?: string;
  jobId?: string;
  correlationId?: string;
  
  // Request context
  method?: string;
  url?: string;
  userAgent?: string;
  ipAddress?: string;
  
  // Performance context
  duration?: number;
  memoryUsage?: number;
  cpuUsage?: number;
  
  // AI/ML context
  model?: string;
  tokenCount?: number;
  confidence?: number;
  
  // Additional metadata
  metadata?: Record<string, any>;
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  tags?: string[];
}

class StructuredLogger {
  private serviceName: string;
  private environment: string;
  private enableConsole: boolean;
  private enableMemoryKeeper: boolean;
  
  constructor() {
    this.serviceName = 'solicitor-brain-v2';
    this.environment = process.env.NODE_ENV || 'development';
    this.enableConsole = process.env.LOG_CONSOLE !== 'false';
    this.enableMemoryKeeper = process.env.LOG_MEMORY_KEEPER !== 'false';
  }

  private async createLogEntry(
    level: LogLevel,
    category: LogCategory,
    message: string,
    context?: LogContext,
    error?: Error,
    tags?: string[]
  ): Promise<LogEntry> {
    const entry: LogEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      level,
      category,
      message: this.sanitizeMessage(message),
      context: context ? this.sanitizeContext(context) : undefined,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined,
      tags: tags || []
    };

    return entry;
  }

  private sanitizeMessage(message: string): string {
    // Remove potential PII from log messages
    const piiPatterns = [
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit card numbers
      /\b[A-Za-z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-Za-z]\b/g, // UK National Insurance numbers
      /\b[\w.-]+@[\w.-]+\.\w+\b/g, // Email addresses (basic pattern)
      /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, // Dates that might be DOB
    ];

    let sanitized = message;
    piiPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });

    return sanitized;
  }

  private sanitizeContext(context: LogContext): LogContext {
    const sanitized = { ...context };
    
    // Remove or redact sensitive fields
    if (sanitized.ipAddress) {
      // Keep first 3 octets, redact last
      const parts = sanitized.ipAddress.split('.');
      if (parts.length === 4) {
        sanitized.ipAddress = `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
      }
    }
    
    // Sanitize metadata
    if (sanitized.metadata) {
      sanitized.metadata = this.sanitizeMetadata(sanitized.metadata);
    }
    
    return sanitized;
  }

  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(metadata)) {
      const lowerKey = key.toLowerCase();
      
      // Skip sensitive fields
      if (lowerKey.includes('password') || 
          lowerKey.includes('token') || 
          lowerKey.includes('secret') ||
          lowerKey.includes('key')) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string') {
        sanitized[key] = this.sanitizeMessage(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  private async persistToMemoryKeeper(entry: LogEntry): Promise<void> {
    if (!this.enableMemoryKeeper) return;

    try {
      const key = `log-${entry.level}-${entry.category}-${entry.timestamp}`;
      const value = JSON.stringify(entry);
      
      // Determine priority based on log level
      const priority = entry.level === LogLevel.ERROR || entry.level === LogLevel.FATAL 
        ? 'high' : entry.level === LogLevel.WARN ? 'normal' : 'low';
      
      // Determine category for memory-keeper
      const memoryCategory = entry.level === LogLevel.ERROR || entry.level === LogLevel.FATAL 
        ? 'error' : entry.level === LogLevel.WARN ? 'warning' : 'note';

      await mcp__memory_keeper__context_save({
        key,
        value,
        category: memoryCategory,
        priority,
        channel: `logs-${entry.category}`,
        private: false // Make logs searchable across sessions
      });
    } catch (error) {
      // Fallback to console if memory-keeper fails
      console.error('Failed to persist log to memory-keeper:', error);
    }
  }

  private outputToConsole(entry: LogEntry): void {
    if (!this.enableConsole) return;

    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const levelColor = this.getLevelColor(entry.level);
    const categoryTag = `[${entry.category}]`;
    
    let output = `${timestamp} ${levelColor}${entry.level.toUpperCase()}\x1b[0m ${categoryTag} ${entry.message}`;
    
    // Add context information if available
    if (entry.context) {
      const contextParts: string[] = [];
      
      if (entry.context.userId) contextParts.push(`user:${entry.context.userId}`);
      if (entry.context.caseId) contextParts.push(`case:${entry.context.caseId}`);
      if (entry.context.jobId) contextParts.push(`job:${entry.context.jobId}`);
      if (entry.context.correlationId) contextParts.push(`correlation:${entry.context.correlationId}`);
      if (entry.context.duration) contextParts.push(`${entry.context.duration}ms`);
      
      if (contextParts.length > 0) {
        output += ` (${contextParts.join(', ')})`;
      }
    }
    
    // Add tags if present
    if (entry.tags && entry.tags.length > 0) {
      output += ` #${entry.tags.join(' #')}`;
    }

    console.log(output);
    
    // Show error details if present
    if (entry.error && entry.level === LogLevel.ERROR || entry.level === LogLevel.FATAL) {
      console.error(`  Error: ${entry.error.message}`);
      if (entry.error.stack && this.environment === 'development') {
        console.error(entry.error.stack);
      }
    }
  }

  private getLevelColor(level: LogLevel): string {
    const colors = {
      [LogLevel.DEBUG]: '\x1b[36m', // Cyan
      [LogLevel.INFO]: '\x1b[32m',  // Green
      [LogLevel.WARN]: '\x1b[33m',  // Yellow
      [LogLevel.ERROR]: '\x1b[31m', // Red
      [LogLevel.FATAL]: '\x1b[35m'  // Magenta
    };
    return colors[level] || '';
  }

  // Public logging methods

  async debug(message: string, category: LogCategory, context?: LogContext, tags?: string[]): Promise<void> {
    const entry = await this.createLogEntry(LogLevel.DEBUG, category, message, context, undefined, tags);
    this.outputToConsole(entry);
    await this.persistToMemoryKeeper(entry);
  }

  async info(message: string, category: LogCategory, context?: LogContext, tags?: string[]): Promise<void> {
    const entry = await this.createLogEntry(LogLevel.INFO, category, message, context, undefined, tags);
    this.outputToConsole(entry);
    await this.persistToMemoryKeeper(entry);
  }

  async warn(message: string, category: LogCategory, context?: LogContext, tags?: string[]): Promise<void> {
    const entry = await this.createLogEntry(LogLevel.WARN, category, message, context, undefined, tags);
    this.outputToConsole(entry);
    await this.persistToMemoryKeeper(entry);
  }

  async error(message: string, category: LogCategory, error?: Error, context?: LogContext, tags?: string[]): Promise<void> {
    const entry = await this.createLogEntry(LogLevel.ERROR, category, message, context, error, tags);
    this.outputToConsole(entry);
    await this.persistToMemoryKeeper(entry);
  }

  async fatal(message: string, category: LogCategory, error?: Error, context?: LogContext, tags?: string[]): Promise<void> {
    const entry = await this.createLogEntry(LogLevel.FATAL, category, message, context, error, tags);
    this.outputToConsole(entry);
    await this.persistToMemoryKeeper(entry);
  }

  // Convenience methods for specific use cases

  async logAIRequest(
    model: string,
    prompt: string,
    responseTime: number,
    tokenCount?: number,
    success: boolean = true,
    error?: Error,
    context?: LogContext
  ): Promise<void> {
    const message = `AI request ${success ? 'completed' : 'failed'}: ${model}`;
    const enrichedContext: LogContext = {
      ...context,
      model,
      duration: responseTime,
      tokenCount,
      metadata: {
        promptLength: prompt.length,
        success,
        ...context?.metadata
      }
    };

    if (success) {
      await this.info(message, LogCategory.LLM_REQUEST, enrichedContext, ['ai', 'request']);
    } else {
      await this.error(message, LogCategory.LLM_REQUEST, error, enrichedContext, ['ai', 'request', 'failed']);
    }
  }

  async logDocumentProcessing(
    documentId: string,
    operation: string,
    success: boolean,
    duration?: number,
    error?: Error,
    context?: LogContext
  ): Promise<void> {
    const message = `Document ${operation} ${success ? 'completed' : 'failed'}: ${documentId}`;
    const enrichedContext: LogContext = {
      ...context,
      documentId,
      duration,
      metadata: {
        operation,
        success,
        ...context?.metadata
      }
    };

    if (success) {
      await this.info(message, LogCategory.DOCUMENT_PROCESSING, enrichedContext, ['document', operation]);
    } else {
      await this.error(message, LogCategory.DOCUMENT_PROCESSING, error, enrichedContext, ['document', operation, 'failed']);
    }
  }

  async logJobProcessing(
    jobId: string,
    jobType: string,
    status: 'started' | 'completed' | 'failed',
    duration?: number,
    error?: Error,
    context?: LogContext
  ): Promise<void> {
    const message = `Job ${status}: ${jobType} (${jobId})`;
    const enrichedContext: LogContext = {
      ...context,
      jobId,
      duration,
      metadata: {
        jobType,
        status,
        ...context?.metadata
      }
    };

    const level = status === 'failed' ? LogLevel.ERROR : LogLevel.INFO;
    const category = LogCategory.JOB_PROCESSING;
    const tags = ['job', jobType, status];

    if (status === 'failed' && error) {
      await this.error(message, category, error, enrichedContext, tags);
    } else {
      await this[level](message, category, enrichedContext, tags);
    }
  }

  async logAuthEvent(
    event: 'login' | 'logout' | 'register' | 'token_refresh',
    userId: string,
    success: boolean,
    error?: Error,
    context?: LogContext
  ): Promise<void> {
    const message = `Authentication ${event} ${success ? 'successful' : 'failed'} for user ${userId}`;
    const enrichedContext: LogContext = {
      ...context,
      userId,
      metadata: {
        event,
        success,
        ...context?.metadata
      }
    };

    const level = success ? LogLevel.INFO : LogLevel.WARN;
    const tags = ['auth', event, success ? 'success' : 'failed'];

    if (!success && error) {
      await this.warn(message, LogCategory.AUTH, enrichedContext, tags);
    } else {
      await this[level](message, LogCategory.AUTH, enrichedContext, tags);
    }
  }

  // Utility method to create context from Express request
  createRequestContext(req: any): LogContext {
    return {
      userId: req.user?.id,
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.connection?.remoteAddress,
      sessionId: req.sessionID,
      correlationId: req.auditContext?.correlationId
    };
  }

  // Search logs in memory-keeper
  async searchLogs(
    query: string,
    category?: LogCategory,
    level?: LogLevel,
    fromDate?: Date,
    toDate?: Date,
    limit: number = 50
  ): Promise<any[]> {
    try {
      const searchParams: any = {
        query,
        limit,
        searchIn: ['key', 'value'],
        sort: 'created_desc'
      };

      // Add time filters if provided
      if (fromDate) {
        searchParams.createdAfter = fromDate.toISOString();
      }
      if (toDate) {
        searchParams.createdBefore = toDate.toISOString();
      }

      // Add category filter through channel
      if (category) {
        searchParams.channels = [`logs-${category}`];
      }

      const results = await this.memoryKeeperSearch(searchParams);
      
      // Filter by level if specified
      if (level) {
        return results.filter((result: any) => {
          try {
            const entry = JSON.parse(result.value);
            return entry.level === level;
          } catch {
            return false;
          }
        });
      }
      
      return results;
    } catch (error) {
      console.error('Failed to search logs in memory-keeper:', error);
      return [];
    }
  }

  private async memoryKeeperSearch(_params: any): Promise<any[]> {
    // This would be replaced with actual MCP call
    // For now, return empty array as placeholder
    return [];
  }
}

// Create singleton instance
export const structuredLogger = new StructuredLogger();

// Export types and enums
export type { LogContext, LogEntry };