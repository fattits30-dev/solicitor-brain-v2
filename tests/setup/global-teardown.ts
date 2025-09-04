/**
 * Global Test Teardown
 * Runs after all tests to clean up the test environment
 */

export default async function globalTeardown() {
  console.log('🧹 Cleaning up MCP test environment...');
  
  // Clean up any global resources
  // Close database connections, clear caches, etc.
  
  // Clear any test data files
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Remove test export files if they exist
    const testExportsPath = path.join(process.cwd(), 'test-exports');
    if (fs.existsSync(testExportsPath)) {
      fs.rmSync(testExportsPath, { recursive: true, force: true });
    }
    
    // Clean up temporary test files
    const tempTestFiles = path.join(process.cwd(), 'temp-test-files');
    if (fs.existsSync(tempTestFiles)) {
      fs.rmSync(tempTestFiles, { recursive: true, force: true });
    }
  } catch (error) {
    console.warn('Warning: Could not clean up test files:', error.message);
  }
  
  // Reset environment variables
  delete process.env.MCP_BASE_URL;
  delete process.env.MCP_WS_URL;
  delete process.env.JWT_SECRET;
  
  console.log('✅ MCP test environment cleanup complete');
}