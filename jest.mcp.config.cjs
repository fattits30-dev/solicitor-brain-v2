/**
 * Jest configuration for MCP tests
 * Specialized configuration for testing MCP contexts, hooks, and integrations
 */

/* eslint-env node */

// Base config available if needed for future extension
// const _baseConfig = require('./jest.config.cjs');

module.exports = {
  // Don't inherit projects from base config
  preset: 'ts-jest',
  
  // Test environment setup
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [
    '<rootDir>/client/src/setupTests.ts',
    '<rootDir>/tests/setup/mcp-test-setup.ts'
  ],

  // Test patterns for MCP-specific tests
  testMatch: [
    '<rootDir>/client/src/contexts/__tests__/**/*.test.{ts,tsx}',
    '<rootDir>/tests/integration/**/*.test.{ts,tsx}',
    '<rootDir>/tests/unit/**/*.test.{ts,tsx}'
  ],

  // Coverage configuration focused on MCP functionality
  collectCoverageFrom: [
    'client/src/contexts/**/*.{ts,tsx}',
    'client/src/hooks/useMCPIntegration.ts',
    'client/src/types/mcp.ts',
    '!client/src/**/*.d.ts',
    '!client/src/**/index.ts'
  ],

  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    'client/src/contexts/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },

  // Module name mapping for MCP tests
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/client/src/$1',
    '^@server/(.*)$': '<rootDir>/server/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@/mcp-test-utils$': '<rootDir>/tests/utils/mcp-helpers',
    '^@/auth-test-utils$': '<rootDir>/tests/utils/auth-helpers'
  },

  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json'
    }],
    '^.+\\.(js|jsx)$': 'babel-jest'
  },

  // Test timeout for async operations
  testTimeout: 15000,

  // Verbose output for detailed test results
  verbose: true,

  // Run tests in sequence for integration tests
  maxWorkers: typeof process !== 'undefined' && process.env.CI ? 2 : '50%', // eslint-disable-line no-undef

  // Reporter configuration
  reporters: ['default'],

  // Coverage reporters
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json-summary'
  ],

  coverageDirectory: './coverage/mcp',

  // Global test setup
  globalSetup: '<rootDir>/tests/setup/global-setup.ts',
  globalTeardown: '<rootDir>/tests/setup/global-teardown.ts',

  // Mock configurations specific to MCP testing
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Error handling
  bail: typeof process !== 'undefined' && process.env.CI ? 1 : 0, // eslint-disable-line no-undef
  
  // Watch mode configuration
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/',
    '<rootDir>/test-results/'
  ]
};