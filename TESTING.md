# Solicitor Brain v2 - Testing Documentation

This document provides comprehensive information about the testing infrastructure, execution, and coverage for the Solicitor Brain v2 legal case management system.

## Testing Strategy Overview

Our testing pyramid follows industry best practices with:
- **Unit Tests** (70%) - Fast, isolated tests for individual components
- **Integration Tests** (20%) - Tests for component interactions and database operations  
- **End-to-End Tests** (10%) - Full user journey validation with Playwright

## Test Architecture

```
tests/
├── unit/                   # Jest unit tests
├── integration/            # Integration tests with test database
├── e2e/                   # Playwright E2E tests
│   ├── auth-flow.spec.ts
│   ├── ingest-to-ask-flow.spec.ts
│   └── global-setup.ts
└── fixtures/              # Test data and mock files

server/
└── __tests__/             # Server-side unit tests
    ├── storage.test.ts
    ├── auth.test.ts
    ├── ai-service.test.ts
    └── setup/
        ├── test-db.ts
        └── jest-setup.ts

client/src/
└── __tests__/             # Client-side unit tests
```

## Test Coverage Requirements

- **Minimum 90% coverage** across all test types
- **Critical paths must have 100% coverage**:
  - Authentication flow
  - Document ingestion
  - AI chat functionality
  - Database operations
  - Legal API integrations

## Running Tests

### Local Development

#### Unit Tests
```bash
# Run all unit tests
npm run test

# Run with watch mode
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run specific test file
npm run test storage.test.ts

# Run tests for specific pattern
npm run test -- --testNamePattern="should authenticate user"
```

#### Integration Tests
```bash
# Run integration tests (requires PostgreSQL)
npm run test -- --testPathPattern=integration

# Run with test database setup
DATABASE_URL=postgresql://postgres:password@localhost:5432/test_db npm run test
```

#### End-to-End Tests
```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests in headed mode (visible browser)
npm run test:e2e:headed

# Run E2E tests with UI mode
npm run test:e2e:ui

# Run specific E2E test file
npx playwright test auth-flow.spec.ts

# Run on specific browser
npx playwright test --project=chromium
```

#### Complete Test Suite
```bash
# Run all test types
npm run test:all

# CI-style test run
npm run test:coverage && npm run test:e2e
```

### Prerequisites

#### Database Setup
```bash
# Start PostgreSQL (via Docker)
npm run docker:up

# Or manual setup
createdb solicitor_brain_test
psql solicitor_brain_test -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

#### Environment Variables
```bash
# .env.test
NODE_ENV=test
DATABASE_URL=postgresql://postgres:password@localhost:5432/solicitor_brain_test
JWT_SECRET=test-jwt-secret-for-testing
ENABLE_AI_FEATURES=true
ENABLE_OCR=true
ENABLE_VECTOR_SEARCH=true
OLLAMA_BASE_URL=http://localhost:11434
```

## Test Database Management

### Isolated Test Databases
- Each test run creates a unique database: `solicitor_brain_test_{pid}_{timestamp}`
- Automatic setup and teardown prevents test interference
- Migrations and seed data applied automatically

### Test Data Management
```javascript
// Access test database utilities
import { testDb } from './server/__tests__/setup/test-db';

// Get test user
const testUser = await testDb.getTestUser('admin');

// Get test case
const testCase = await testDb.getTestCase('TEST-2024-001');

// Create test document
const testDoc = await testDb.createTestDocument(caseId, 'test.pdf');

// Clear data between tests
await testDb.clearData();
```

## CI/CD Integration

### GitHub Actions Workflow
Our CI/CD pipeline runs comprehensive tests on:
- **Push to main/develop branches**
- **Pull requests**
- **Nightly scheduled runs**

#### Pipeline Stages
1. **Lint & Type Check** - Code quality validation
2. **Unit Tests** - Fast feedback on individual components  
3. **Integration Tests** - Database and service integration
4. **E2E Tests** - Complete user journeys
5. **Security Scan** - Vulnerability assessment
6. **Performance Tests** - Load and stress testing (nightly)

#### Browser Matrix (Nightly)
- Chromium
- Firefox  
- WebKit (Safari)
- Mobile Chrome
- Mobile Safari

### Coverage Reporting
- **Codecov integration** for coverage tracking
- **HTML reports** generated in `coverage/` directory
- **LCOV format** for CI integration
- **Cobertura XML** for compatibility

## Test Categories

### Unit Tests

#### Server Tests (`server/__tests__/`)
- **Storage Service** - Database operations, CRUD, transactions
- **Authentication** - JWT generation, password validation, session management
- **AI Service** - Ollama integration, embeddings, chat responses
- **PII Redaction** - Data privacy and sanitization
- **Legal APIs** - External service integrations

#### Client Tests (`client/src/__tests__/`)
- **Components** - React component behavior and rendering
- **Hooks** - Custom React hooks functionality
- **Utils** - Helper functions and utilities
- **Context** - State management and global state

### Integration Tests
- **API Routes** - Complete request/response cycles
- **Database Migrations** - Schema changes and data integrity
- **File Upload** - Document processing pipeline
- **Authentication Flow** - Login, logout, session management
- **AI Pipeline** - Document ingestion to embeddings

### End-to-End Tests

#### Critical User Journeys
1. **Authentication Flow**
   - Login/logout functionality
   - Role-based access control
   - Session persistence
   - Security validations

2. **Ingest-to-Ask Happy Path**
   - Document upload and processing
   - OCR text extraction
   - Vector embedding generation
   - AI question answering
   - Contextual responses

3. **Case Management**
   - Creating and managing cases
   - Document organization
   - User collaboration
   - Audit trail verification

## Test Data and Fixtures

### Mock Data
```javascript
// Test users (pre-seeded)
const testUsers = {
  admin: 'admin@test.com / password123',
  solicitor: 'solicitor@test.com / password123', 
  paralegal: 'paralegal@test.com / password123'
};

// Test cases
const testCases = [
  { reference: 'TEST-2024-001', title: 'Test Case 1', status: 'active' },
  { reference: 'TEST-2024-002', title: 'Test Case 2', status: 'pending' }
];
```

### File Fixtures
```
tests/fixtures/
├── legal-documents/
│   ├── contract-sample.pdf
│   ├── legal-memo.docx
│   └── evidence-photo.jpg
├── api-responses/
│   ├── ollama-chat-response.json
│   └── legislation-api-response.json
└── test-data/
    ├── users.json
    └── cases.json
```

## Debugging Tests

### Jest Debugging
```bash
# Run tests with debugging
node --inspect-brk node_modules/.bin/jest --runInBand

# Debug specific test
npm run test -- --testNamePattern="should login" --verbose

# Show console.log output
npm run test -- --verbose
```

### Playwright Debugging
```bash
# Run with browser visible
npm run test:e2e:headed

# Run in debug mode
npx playwright test --debug

# Open trace viewer
npx playwright show-trace trace.zip
```

### Common Issues and Solutions

#### Database Connection Issues
```bash
# Check PostgreSQL status
pg_isready -h localhost -p 5432

# Reset test database
npm run db:reset

# Check environment variables
echo $DATABASE_URL
```

#### Playwright Browser Issues
```bash
# Install browsers
npx playwright install

# Install system dependencies
npx playwright install-deps

# Check browser installation
npx playwright install --dry-run
```

## Performance Testing

### Load Testing with k6
```javascript
// tests/performance/load-test.js
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  vus: 10,
  duration: '30s',
};

export default function () {
  let response = http.get('http://localhost:3333/api/health');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

### Performance Benchmarks
- **API Response Time**: < 500ms (95th percentile)
- **Document Upload**: < 5s for 10MB files
- **AI Response Time**: < 10s for complex queries
- **Database Queries**: < 100ms for simple operations

## Security Testing

### Automated Security Scans
- **npm audit** - Dependency vulnerability scanning
- **Snyk** - Advanced security analysis
- **OWASP ZAP** - Web application security testing

### Security Test Coverage
- SQL injection prevention
- XSS protection
- CSRF token validation
- JWT token security
- Input sanitization
- PII redaction accuracy

## Accessibility Testing

### WCAG 2.2 AA Compliance
- Keyboard navigation
- Screen reader compatibility
- Color contrast ratios
- Focus management
- ARIA labels and roles

### Testing Tools
- **axe-core** - Automated accessibility testing
- **Lighthouse** - Performance and accessibility audits
- **pa11y** - Command-line accessibility testing

## Test Reporting

### Coverage Reports
- **HTML Report**: Open `coverage/lcov-report/index.html`
- **Terminal Output**: Summary with file-level breakdown
- **CI Integration**: Codecov dashboard and PR comments

### E2E Test Reports
- **HTML Report**: `npx playwright show-report`
- **Video Recordings**: Automatically captured on failures
- **Screenshots**: Captured on test failures
- **Trace Files**: Full browser interaction logs

### Test Artifacts
```
test-results/
├── coverage/
│   ├── lcov-report/
│   ├── cobertura-coverage.xml
│   └── lcov.info
├── e2e/
│   ├── screenshots/
│   ├── videos/
│   └── traces/
└── reports/
    ├── junit.xml
    └── test-results.json
```

## Continuous Improvement

### Test Metrics Tracking
- Test execution time trends
- Flaky test identification
- Coverage progression
- Performance regression detection

### Test Maintenance
- Regular test data cleanup
- Mock service updates
- Browser compatibility updates
- Test infrastructure optimization

## Troubleshooting

### Common Test Failures

#### "Database connection failed"
```bash
# Check PostgreSQL service
sudo service postgresql status

# Verify connection string
psql $DATABASE_URL -c "SELECT 1"

# Reset test database
npm run db:reset
```

#### "Timeout waiting for element"
```javascript
// Increase timeout in Playwright
await page.waitForSelector('.element', { timeout: 60000 });

// Or in playwright.config.ts
use: {
  actionTimeout: 30000,
  navigationTimeout: 60000,
}
```

#### "Jest did not exit within 10 seconds"
```javascript
// Add proper cleanup in test
afterAll(async () => {
  await testDb.cleanup();
  // Close any open connections
});
```

## Contributing to Tests

### Writing New Tests

#### Unit Tests
```javascript
describe('New Feature', () => {
  it('should handle edge case', async () => {
    // Arrange
    const input = 'test input';
    
    // Act  
    const result = await newFeature(input);
    
    // Assert
    expect(result).toBe('expected output');
  });
});
```

#### E2E Tests
```javascript
test('should complete new user journey', async ({ page }) => {
  // Navigate to feature
  await page.goto('/new-feature');
  
  // Interact with elements
  await page.fill('[data-testid="input"]', 'test data');
  await page.click('[data-testid="submit"]');
  
  // Verify results
  await expect(page.locator('[data-testid="success"]')).toBeVisible();
});
```

### Test Best Practices

1. **Follow AAA Pattern** - Arrange, Act, Assert
2. **Use meaningful test names** - Describe expected behavior
3. **Test edge cases** - Null values, empty strings, large datasets
4. **Keep tests independent** - No test should depend on another
5. **Use data-testid attributes** - Stable element selection
6. **Mock external dependencies** - Reliable and fast tests
7. **Clean up resources** - Prevent test interference

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Testing Library Best Practices](https://testing-library.com/docs/guiding-principles)
- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)

---

For questions about testing or to report issues with the test infrastructure, please contact the development team or create an issue in the project repository.