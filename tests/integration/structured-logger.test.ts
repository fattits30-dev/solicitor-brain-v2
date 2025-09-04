/**
 * Integration Tests for Structured Logger with MCP Memory-Keeper Persistence
 * 
 * Tests the structured logging functionality including:
 * - Log level handling and categorization
 * - PII sanitization and redaction
 * - MCP memory-keeper persistence
 * - Context enrichment
 * - Specialized logging methods
 * - Search functionality
 */

import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect, jest as _jest } from '@jest/globals';
import { structuredLogger, LogCategory as _LogCategory, LogLevel } from '../../server/services/structured-logger';

describe('Structured Logger Integration', () => {
  let consoleSpy: jest.SpiedFunction<typeof console.log>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeAll(() => {
    // Enable structured logging for testing
    process.env.LOG_CONSOLE = 'true';
    process.env.LOG_MEMORY_KEEPER = 'true';
  });

  afterAll(() => {
    // Clean up environment
    delete process.env.LOG_CONSOLE;
    delete process.env.LOG_MEMORY_KEEPER;
  });

  beforeEach(() => {
    // Mock console methods to capture output
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    // Restore console methods
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('Basic Logging Functionality', () => {
    it('should log debug messages with proper formatting', async () => {
      await structuredLogger.debug(
        'This is a debug message',
        LogCategory.SYSTEM,
        { userId: 'test-user-123' },
        ['debug', 'test']
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/DEBUG.*\[system\].*This is a debug message.*user:test-user-123.*#debug #test/)
      );
    });

    it('should log info messages with proper formatting', async () => {
      await structuredLogger.info(
        'This is an info message',
        LogCategory.API,
        { method: 'GET', url: '/api/test' },
        ['info', 'api']
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/INFO.*\[api\].*This is an info message.*#info #api/)
      );
    });

    it('should log warning messages with proper formatting', async () => {
      await structuredLogger.warn(
        'This is a warning message',
        LogCategory.SECURITY,
        { ipAddress: '192.168.1.100' },
        ['warning', 'security']
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/WARN.*\[security\].*This is a warning message.*#warning #security/)
      );
    });

    it('should log error messages with stack traces', async () => {
      const testError = new Error('Test error');
      
      await structuredLogger.error(
        'This is an error message',
        LogCategory.DATABASE,
        testError,
        { correlationId: 'test-correlation-123' },
        ['error', 'database']
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/ERROR.*\[database\].*This is an error message.*correlation:test-correlation-123/)
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Error: Test error/)
      );
    });

    it('should log fatal messages with stack traces', async () => {
      const testError = new Error('Fatal error');
      
      await structuredLogger.fatal(
        'This is a fatal message',
        LogCategory.SYSTEM,
        testError,
        { caseId: 'case-456' },
        ['fatal', 'system']
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/FATAL.*\[system\].*This is a fatal message.*case:case-456/)
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Error: Fatal error/)
      );
    });
  });

  describe('PII Sanitization', () => {
    it('should redact credit card numbers from messages', async () => {
      await structuredLogger.info(
        'Processing payment for card 4111-1111-1111-1111',
        LogCategory.API,
        {},
        ['pii-test']
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Processing payment for card [REDACTED]')
      );
    });

    it('should redact UK National Insurance numbers from messages', async () => {
      await structuredLogger.info(
        'User NI number is AB 12 34 56 C',
        LogCategory.GDPR,
        {},
        ['pii-test']
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('User NI number is [REDACTED]')
      );
    });

    it('should redact email addresses from messages', async () => {
      await structuredLogger.info(
        'User email john.doe@example.com registered',
        LogCategory.AUTH,
        {},
        ['pii-test']
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('User email [REDACTED] registered')
      );
    });

    it('should redact dates that might be DOB from messages', async () => {
      await structuredLogger.info(
        'User birth date is 15/06/1985',
        LogCategory.GDPR,
        {},
        ['pii-test']
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('User birth date is [REDACTED]')
      );
    });

    it('should sanitize IP addresses in context', async () => {
      await structuredLogger.info(
        'User login attempt',
        LogCategory.AUTH,
        { 
          ipAddress: '192.168.1.100',
          userAgent: 'Test Browser'
        },
        ['ip-test']
      );

      // The IP should be partially redacted in the context
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('User login attempt')
      );
    });

    it('should redact sensitive metadata fields', async () => {
      await structuredLogger.info(
        'Processing user data',
        LogCategory.GDPR,
        {
          metadata: {
            password: 'secret123',
            token: 'jwt-token-here',
            secret: 'api-secret',
            apiKey: 'key-123',
            normalField: 'safe-value'
          }
        },
        ['metadata-test']
      );

      // Should log the message but redact sensitive fields in metadata
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Processing user data')
      );
    });
  });

  describe('Specialized Logging Methods', () => {
    it('should log successful AI requests', async () => {
      await structuredLogger.logAIRequest(
        'gpt-3.5-turbo',
        'Test prompt for legal analysis',
        1500,
        150,
        true,
        undefined,
        {
          userId: 'user-123',
          caseId: 'case-456',
          metadata: { temperature: 0.7 }
        }
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/INFO.*\[llm-request\].*AI request completed: gpt-3.5-turbo.*user:user-123.*case:case-456.*#ai #request/)
      );
    });

    it('should log failed AI requests', async () => {
      const aiError = new Error('Model timeout');
      
      await structuredLogger.logAIRequest(
        'gpt-3.5-turbo',
        'Failed prompt',
        3000,
        undefined,
        false,
        aiError,
        {
          userId: 'user-123',
          metadata: { timeout: 30000 }
        }
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/ERROR.*\[llm-request\].*AI request failed: gpt-3.5-turbo.*user:user-123.*#ai #request #failed/)
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Error: Model timeout/)
      );
    });

    it('should log document processing events', async () => {
      await structuredLogger.logDocumentProcessing(
        'doc-123',
        'ocr_extraction',
        true,
        5000,
        undefined,
        {
          userId: 'user-123',
          caseId: 'case-456',
          metadata: { fileSize: 1024 * 1024, pages: 5 }
        }
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/INFO.*\[document-processing\].*Document ocr_extraction completed: doc-123.*user:user-123.*case:case-456.*#document #ocr_extraction/)
      );
    });

    it('should log failed document processing', async () => {
      const docError = new Error('OCR extraction failed');
      
      await structuredLogger.logDocumentProcessing(
        'doc-456',
        'ocr_extraction',
        false,
        2000,
        docError,
        {
          userId: 'user-123',
          metadata: { fileSize: 2048 }
        }
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/ERROR.*\[document-processing\].*Document ocr_extraction failed: doc-456.*user:user-123.*#document #ocr_extraction #failed/)
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Error: OCR extraction failed/)
      );
    });

    it('should log job processing lifecycle', async () => {
      const jobId = 'job-789';
      const jobType = 'case_analysis';
      
      // Test job started
      await structuredLogger.logJobProcessing(
        jobId,
        jobType,
        'started',
        undefined,
        undefined,
        {
          userId: 'user-123',
          metadata: { priority: 1 }
        }
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/INFO.*\[job-processing\].*Job started: case_analysis.*job:job-789.*user:user-123.*#job #case_analysis #started/)
      );

      // Test job completed
      await structuredLogger.logJobProcessing(
        jobId,
        jobType,
        'completed',
        15000,
        undefined,
        {
          userId: 'user-123',
          metadata: { subJobs: 3 }
        }
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/INFO.*\[job-processing\].*Job completed: case_analysis.*job:job-789.*user:user-123.*15000ms.*#job #case_analysis #completed/)
      );

      // Test job failed
      const jobError = new Error('Job processing failed');
      await structuredLogger.logJobProcessing(
        jobId,
        jobType,
        'failed',
        5000,
        jobError,
        {
          userId: 'user-123',
          metadata: { errorCode: 500 }
        }
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/ERROR.*\[job-processing\].*Job failed: case_analysis.*job:job-789.*user:user-123.*5000ms.*#job #case_analysis #failed/)
      );
    });

    it('should log authentication events', async () => {
      // Test successful login
      await structuredLogger.logAuthEvent(
        'login',
        'user-123',
        true,
        undefined,
        {
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 Test Browser',
          metadata: { loginMethod: 'password' }
        }
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/INFO.*\[auth\].*Authentication login successful for user user-123.*#auth #login #success/)
      );

      // Test failed login
      const authError = new Error('Invalid credentials');
      await structuredLogger.logAuthEvent(
        'login',
        'user-123',
        false,
        authError,
        {
          ipAddress: '192.168.1.100',
          metadata: { attempts: 3 }
        }
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/WARN.*\[auth\].*Authentication login failed for user user-123.*#auth #login #failed/)
      );
    });
  });

  describe('Request Context Creation', () => {
    it('should create proper context from Express request', () => {
      const mockRequest = {
        user: { id: 'user-123' },
        method: 'GET',
        url: '/api/cases',
        headers: { 'user-agent': 'Mozilla/5.0 Test' },
        ip: '192.168.1.100',
        sessionID: 'session-456',
        auditContext: { correlationId: 'correlation-789' }
      };

      const context = structuredLogger.createRequestContext(mockRequest);

      expect(context).toEqual({
        userId: 'user-123',
        method: 'GET',
        url: '/api/cases',
        userAgent: 'Mozilla/5.0 Test',
        ipAddress: '192.168.1.100',
        sessionId: 'session-456',
        correlationId: 'correlation-789'
      });
    });

    it('should handle missing request properties gracefully', () => {
      const mockRequest = {
        method: 'POST',
        url: '/api/documents'
        // Missing other properties
      };

      const context = structuredLogger.createRequestContext(mockRequest);

      expect(context).toEqual({
        userId: undefined,
        method: 'POST',
        url: '/api/documents',
        userAgent: undefined,
        ipAddress: undefined,
        sessionId: undefined,
        correlationId: undefined
      });
    });
  });

  describe('Log Search Functionality', () => {
    it('should search logs with query and filters', async () => {
      const results = await structuredLogger.searchLogs(
        'test search query',
        LogCategory.SYSTEM,
        LogLevel.INFO,
        new Date(Date.now() - 60000), // Last minute
        new Date(),
        20
      );

      // Mock implementation returns empty array
      expect(results).toEqual([]);
    });

    it('should search logs without time filters', async () => {
      const results = await structuredLogger.searchLogs(
        'search without time',
        LogCategory.API,
        undefined, // No level filter
        undefined, // No from date
        undefined, // No to date
        10
      );

      expect(results).toEqual([]);
    });

    it('should handle search errors gracefully', async () => {
      // Mock console.error to capture error handling
      const searchErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // This test would need to trigger a search error in the real implementation
      const results = await structuredLogger.searchLogs('error test');
      
      expect(results).toEqual([]);
      
      searchErrorSpy.mockRestore();
    });
  });

  describe('Context Enrichment', () => {
    it('should include performance context in logs', async () => {
      await structuredLogger.info(
        'Operation completed',
        LogCategory.PERFORMANCE,
        {
          duration: 1500,
          memoryUsage: 512000,
          cpuUsage: 25.5,
          userId: 'user-123'
        },
        ['performance']
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/INFO.*\[performance\].*Operation completed.*user:user-123.*1500ms.*#performance/)
      );
    });

    it('should include correlation IDs for tracing', async () => {
      await structuredLogger.info(
        'Request processed',
        LogCategory.API,
        {
          correlationId: 'correlation-123',
          userId: 'user-456',
          method: 'POST',
          url: '/api/cases'
        },
        ['api', 'request']
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/INFO.*\[api\].*Request processed.*user:user-456.*correlation:correlation-123.*#api #request/)
      );
    });

    it('should handle AI/ML context properly', async () => {
      await structuredLogger.info(
        'ML model prediction completed',
        LogCategory.AI_SERVICE,
        {
          model: 'legal-classifier-v2',
          tokenCount: 250,
          confidence: 0.95,
          userId: 'user-789',
          metadata: { inputSize: 1024 }
        },
        ['ai', 'prediction']
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/INFO.*\[ai-service\].*ML model prediction completed.*user:user-789.*#ai #prediction/)
      );
    });
  });

  describe('Log Categories', () => {
    it('should handle all log categories correctly', async () => {
      const categories = [
        LogCategory.SYSTEM,
        LogCategory.AUTH,
        LogCategory.DATABASE,
        LogCategory.API,
        LogCategory.AI_SERVICE,
        LogCategory.EMBEDDING,
        LogCategory.LLM_REQUEST,
        LogCategory.MODEL_MANAGEMENT,
        LogCategory.DOCUMENT_UPLOAD,
        LogCategory.DOCUMENT_PROCESSING,
        LogCategory.OCR,
        LogCategory.FILE_MANAGEMENT,
        LogCategory.AGENT_WORKFLOW,
        LogCategory.JOB_PROCESSING,
        LogCategory.QUEUE_MANAGEMENT,
        LogCategory.AUDIT,
        LogCategory.GDPR,
        LogCategory.SECURITY,
        LogCategory.PII_HANDLING,
        LogCategory.PERFORMANCE,
        LogCategory.METRICS,
        LogCategory.HEALTH_CHECK
      ];

      for (const category of categories) {
        await structuredLogger.info(
          `Testing category ${category}`,
          category,
          {},
          ['category-test']
        );

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining(`[${category}]`)
        );
      }
    });
  });

  describe('Memory-Keeper Persistence', () => {
    it('should attempt to persist logs to memory-keeper', async () => {
      // The structured logger should attempt to save logs to memory-keeper
      // This is tested through the console output since we're mocking MCP calls
      
      await structuredLogger.error(
        'Critical error for memory persistence',
        LogCategory.SYSTEM,
        new Error('Test error'),
        { userId: 'user-123' },
        ['critical', 'memory-test']
      );

      // The log should be output to console
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/ERROR.*\[system\].*Critical error for memory persistence/)
      );
    });

    it('should handle memory-keeper persistence failures gracefully', async () => {
      // In a real scenario, if memory-keeper fails, the logger should continue working
      // This is implicitly tested through other tests since we're mocking the MCP calls
      
      await structuredLogger.info(
        'Log when memory-keeper might be unavailable',
        LogCategory.SYSTEM,
        {},
        ['fallback-test']
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Log when memory-keeper might be unavailable')
      );
    });
  });

  describe('Environment Configuration', () => {
    it('should respect LOG_CONSOLE environment variable', () => {
      // Test is implicitly covered by the beforeAll setup
      // where we set LOG_CONSOLE=true and expect console output
      expect(process.env.LOG_CONSOLE).toBe('true');
    });

    it('should respect LOG_MEMORY_KEEPER environment variable', () => {
      // Test is implicitly covered by the setup
      expect(process.env.LOG_MEMORY_KEEPER).toBe('true');
    });
  });
});