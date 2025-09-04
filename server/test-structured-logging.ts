// Test script to verify structured logging functionality
// This can be run independently to test the logging service

import { structuredLogger, LogCategory, LogLevel } from './services/structured-logger';

async function testStructuredLogging() {
  console.log('🧪 Testing structured logging service...\n');

  try {
    // Test basic logging at different levels
    await structuredLogger.debug(
      'This is a debug message',
      LogCategory.SYSTEM,
      { metadata: { test: 'debug_test' } },
      ['test', 'debug']
    );

    await structuredLogger.info(
      'This is an info message',
      LogCategory.SYSTEM,
      { metadata: { test: 'info_test' } },
      ['test', 'info']
    );

    await structuredLogger.warn(
      'This is a warning message',
      LogCategory.SYSTEM,
      { metadata: { test: 'warn_test' } },
      ['test', 'warn']
    );

    await structuredLogger.error(
      'This is an error message',
      LogCategory.SYSTEM,
      new Error('Test error'),
      { metadata: { test: 'error_test' } },
      ['test', 'error']
    );

    // Test AI-specific logging
    await structuredLogger.logAIRequest(
      'test-model',
      'Test prompt for AI service',
      1500, // 1.5 seconds
      150, // tokens
      true,
      undefined,
      {
        userId: 'test-user-123',
        caseId: 'test-case-456',
        metadata: { temperature: 0.7 }
      }
    );

    // Test failed AI request
    await structuredLogger.logAIRequest(
      'test-model',
      'Failed prompt',
      2000,
      undefined,
      false,
      new Error('Model timeout'),
      {
        userId: 'test-user-123',
        metadata: { timeout: 30000 }
      }
    );

    // Test document processing logging
    await structuredLogger.logDocumentProcessing(
      'doc-123',
      'ocr_extraction',
      true,
      5000,
      undefined,
      {
        userId: 'test-user-123',
        caseId: 'test-case-456',
        metadata: { fileSize: 1024 * 1024, pages: 5 }
      }
    );

    // Test job processing logging
    await structuredLogger.logJobProcessing(
      'job-789',
      'case_analysis',
      'completed',
      15000,
      undefined,
      {
        userId: 'test-user-123',
        metadata: { priority: 1, subJobs: 3 }
      }
    );

    // Test auth event logging
    await structuredLogger.logAuthEvent(
      'login',
      'test-user-123',
      true,
      undefined,
      {
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 Test Browser',
        metadata: { loginMethod: 'password' }
      }
    );

    // Test PII sanitization
    await structuredLogger.info(
      'User with email john.doe@example.com and NI number AB123456C logged in',
      LogCategory.AUTH,
      {
        userId: 'test-user-123',
        metadata: {
          originalEmail: 'john.doe@example.com',
          creditCard: '4111-1111-1111-1111'
        }
      },
      ['test', 'pii-sanitization']
    );

    console.log('✅ All structured logging tests completed successfully!\n');
    
    // Test search functionality (mock)
    console.log('🔍 Testing log search functionality...');
    
    const searchResults = await structuredLogger.searchLogs(
      'test',
      LogCategory.SYSTEM,
      LogLevel.INFO,
      new Date(Date.now() - 60000), // Last minute
      new Date(),
      10
    );
    
    console.log(`Found ${searchResults.length} matching log entries`);
    
    console.log('✅ Structured logging integration test completed!');

  } catch (error) {
    console.error('❌ Structured logging test failed:', error);
    process.exit(1);
  }
}

// Test helper function to simulate Express request context
function createMockRequest(userId = 'test-user', method = 'GET', url = '/api/test') {
  return {
    user: { id: userId },
    method,
    url,
    headers: {
      'user-agent': 'Test Agent',
    },
    ip: '192.168.1.100',
    sessionID: 'test-session-123'
  };
}

async function testRequestContextLogging() {
  console.log('🧪 Testing request context logging...\n');

  const mockReq = createMockRequest();
  const context = structuredLogger.createRequestContext(mockReq);
  
  await structuredLogger.info(
    'API request processed',
    LogCategory.API,
    context,
    ['api', 'request']
  );

  console.log('✅ Request context logging test completed!\n');
}

// Run tests if this file is executed directly
if (require.main === module) {
  console.log('🚀 Starting structured logging tests...\n');
  
  Promise.resolve()
    .then(() => testStructuredLogging())
    .then(() => testRequestContextLogging())
    .then(() => {
      console.log('🎉 All tests completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test suite failed:', error);
      process.exit(1);
    });
}

export { testStructuredLogging, testRequestContextLogging };