import { testDb } from './test-db';

/**
 * Jest Global Setup for Server Tests
 * Sets up test database and environment before running tests
 */

// Global test setup
beforeAll(async () => {
  // Setup test database
  await testDb.setup();
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
  process.env.ENABLE_AI_FEATURES = 'true';
  process.env.ENABLE_OCR = 'true';
  process.env.ENABLE_VECTOR_SEARCH = 'true';
  process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
  process.env.OLLAMA_MODEL = 'llama3.2';
  
  console.log('Global test setup completed');
}, 60000); // Increase timeout for database setup

// Global test cleanup
afterAll(async () => {
  await testDb.cleanup();
  console.log('Global test cleanup completed');
}, 30000);

// Clean data between test suites
afterEach(async () => {
  // Only clear data, not the entire database structure
  try {
    await testDb.clearData();
  } catch (error) {
    console.warn('Failed to clear test data:', error);
  }
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions in tests
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});