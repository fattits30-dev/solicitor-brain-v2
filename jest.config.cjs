module.exports = {
  preset: 'ts-jest',
  projects: [
    // Unit tests that don't require database
    {
      displayName: 'server-unit',
      testEnvironment: 'node',
      roots: ['<rootDir>/server'],
      testMatch: [
        '**/server/**/__tests__/**/!(integration|e2e|storage|auth|ai-service)*.test.(ts|tsx|js)',
        '**/server/**/**/!(integration|e2e|storage|auth|ai-service)*.(test|spec).(ts|tsx|js)',
      ],
      transform: {
        '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
      },
      collectCoverageFrom: [
        'server/**/*.{ts,tsx,js,jsx}',
        '!server/**/*.d.ts',
        '!**/*.config.{ts,js}',
        '!**/node_modules/**',
        '!**/dist/**',
        '!**/build/**',
        '!**/setup/**',
      ],
    },
    // Integration tests that require database
    {
      displayName: 'server-integration',
      testEnvironment: 'node',
      roots: ['<rootDir>/server', '<rootDir>/shared'],
      testMatch: [
        '**/server/**/__tests__/**/{storage,auth,ai-service,integration}*.test.(ts|tsx|js)',
        '**/server/**/**/{storage,auth,ai-service,integration}*.(test|spec).(ts|tsx|js)',
        '**/shared/**/__tests__/**/*.test.(ts|tsx|js)',
        '**/shared/**/*.(test|spec).(ts|tsx|js)',
      ],
      transform: {
        '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
      },
      setupFilesAfterEnv: ['<rootDir>/server/__tests__/setup/jest-setup.ts'],
      collectCoverageFrom: [
        'server/**/*.{ts,tsx,js,jsx}',
        'shared/**/*.{ts,tsx,js,jsx}',
        '!server/**/*.d.ts',
        '!shared/**/*.d.ts',
        '!**/*.config.{ts,js}',
        '!**/node_modules/**',
        '!**/dist/**',
        '!**/build/**',
        '!**/setup/**',
      ],
    },
    {
      displayName: 'client',
      testEnvironment: 'jsdom',
      roots: ['<rootDir>/client/src', '<rootDir>/shared'],
      testMatch: [
        '**/client/src/**/__tests__/**/*.test.(ts|tsx|js)',
        '**/client/src/**/*.(test|spec).(ts|tsx|js)',
        '**/shared/**/__tests__/**/*.test.(ts|tsx|js)',
        '**/shared/**/*.(test|spec).(ts|tsx|js)',
      ],
      transform: {
        '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
      },
      collectCoverageFrom: [
        'client/src/**/*.{ts,tsx,js,jsx}',
        'shared/**/*.{ts,tsx,js,jsx}',
        '!client/src/**/*.d.ts',
        '!shared/**/*.d.ts',
        '!**/*.config.{ts,js}',
        '!**/node_modules/**',
        '!**/dist/**',
        '!**/build/**',
      ],
      setupFilesAfterEnv: ['<rootDir>/client/src/setupTests.ts'],
    },
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'cobertura', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/client/src/$1',
    '^@server/(.*)$': '<rootDir>/server/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
  },
  testTimeout: 10000,
  verbose: true,
};
