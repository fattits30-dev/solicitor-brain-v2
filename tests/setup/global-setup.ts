/**
 * Global Test Setup
 * Runs before all tests to set up the test environment
 */

export default async function globalSetup() {
  console.log('🧪 Setting up MCP test environment...');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.CI = process.env.CI || 'false';
  
  // Mock environment variables for MCP services
  process.env.MCP_BASE_URL = 'http://localhost:3001/api/mcp';
  process.env.MCP_WS_URL = 'ws://localhost:3001/ws/mcp';
  process.env.ENABLE_MCP_FEATURES = 'true';
  
  // Database configuration for tests
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/solicitor_brain_test';
  }
  
  if (!process.env.REDIS_URL) {
    process.env.REDIS_URL = 'redis://localhost:6379';
  }
  
  // JWT configuration for tests
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
  
  // Disable AI features for most tests (unless specifically enabled)
  if (!process.env.ENABLE_AI_FEATURES) {
    process.env.ENABLE_AI_FEATURES = 'false';
  }
  
  console.log('✅ MCP test environment setup complete');
}