// Multi-project Jest configuration: separate environments for server (Node) and client (jsdom)
/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'server',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/server/tests/**/*.test.ts'],
      moduleNameMapper: {
        '^@shared/(.*)$': '<rootDir>/shared/$1',
      },
      transform: {
        '^.+\\.(ts|tsx)$': [
          'ts-jest',
          {
            useESM: true,
            tsconfig: '<rootDir>/tsconfig.json',
            diagnostics: false,
            isolatedModules: true,
          },
        ],
      },
    },
    {
      displayName: 'client',
      preset: 'ts-jest',
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/client/src/setupTests.ts'],
      testMatch: ['<rootDir>/client/src/**/*.test.(ts|tsx)'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/client/src/$1',
        '^@shared/(.*)$': '<rootDir>/shared/$1',
      },
      transform: {
        '^.+\\.(ts|tsx)$': [
          'ts-jest',
          {
            useESM: true,
            tsconfig: '<rootDir>/tsconfig.json',
          },
        ],
      },
    },
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testTimeout: 30000,
  extensionsToTreatAsEsm: ['.ts'],
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
  // Coverage configuration
  collectCoverage: false,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/*.d.ts',
  ],
  // Debugging improvements
  verbose: true,
  // Clear mocks between tests for better isolation
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
