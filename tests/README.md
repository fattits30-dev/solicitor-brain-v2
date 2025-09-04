# MCP Integration Testing Suite

This directory contains comprehensive integration tests for all MCP (Model Context Protocol) tools functionality implemented in the solicitor-brain-v2 project.

## Overview

The MCP integration testing suite validates the complete workflow from file changes to memory persistence, including:

- **Memory-Keeper Integration**: Context saving, retrieval, and search functionality
- **File Watcher Service**: File change detection with MCP memory persistence
- **Structured Logging**: PII-safe logging with memory-keeper persistence
- **Filesystem Operations**: MCP filesystem wrapper with fallback mechanisms
- **Git Service Integration**: Version control operations with MCP git tools
- **Workflow Services**: Cross-service communication and state management
- **End-to-End Workflows**: Complete document ingestion and processing flows

## Test Structure

```
tests/
├── integration/                    # Integration tests
│   ├── mcp-memory-keeper.test.ts  # Memory-keeper client tests
│   ├── file-watcher.test.ts       # File watcher integration tests
│   ├── structured-logger.test.ts  # Logging with memory persistence
│   ├── mcp-filesystem.test.ts     # Filesystem operations tests
│   ├── git-service.test.ts        # Git service integration tests
│   └── workflow-services.test.ts  # Cross-service integration tests
├── e2e/                            # End-to-end tests
│   └── mcp-workflow-complete.test.ts # Complete workflow validation
├── scripts/                        # Test automation scripts
│   ├── run-mcp-tests.ts           # Main test runner
│   └── validate-mcp-integration.ts # Pre-test validation
└── README.md                       # This file
```

## Quick Start

### Prerequisites

1. **Node.js**: Version 18 or higher
2. **Git**: Required for git service tests
3. **Dependencies**: Run `npm ci` to install all dependencies

### Validate Setup

Before running tests, validate your MCP integration setup:

```bash
npm run test:mcp:validate
```

This will check:
- ✅ Environment and dependencies
- ✅ Required files and services
- ✅ MCP client functionality
- ✅ Git integration
- ✅ Test file compilation

### Run MCP Tests

```bash
# Run all MCP integration tests
npm run test:mcp

# Run only critical tests
npm run test:mcp:critical

# Generate HTML report
npm run test:mcp:html

# Run specific test suite
npm run test:mcp --suite "Memory-Keeper Integration"

# Run integration tests only
npm run test:integration

# Watch mode for integration tests
npm run test:integration:watch
```

## Test Categories

### 🧠 Memory-Keeper Integration Tests
**File**: `tests/integration/mcp-memory-keeper.test.ts`

Tests the core MCP memory-keeper functionality:
- Context item saving and retrieval
- Search functionality with filters
- File caching and change detection
- Status monitoring
- Error handling when service unavailable

**Key Features Tested**:
- Context saving with categories and priorities
- File content caching for change detection
- Search across memory items
- PII-safe memory storage
- Fallback when MCP unavailable

### 📂 File Watcher Integration Tests
**File**: `tests/integration/file-watcher.test.ts`

Tests file watching with MCP memory integration:
- File change detection (add, modify, delete)
- Debouncing of rapid changes
- Memory-keeper persistence of file events
- Backup creation
- Ignore patterns and filtering

**Key Features Tested**:
- Real-time file change detection
- Memory persistence of file events
- Hash-based change detection
- High-priority file identification
- Error recovery and graceful degradation

### 📝 Structured Logging Integration Tests
**File**: `tests/integration/structured-logger.test.ts`

Tests structured logging with memory persistence:
- Log level handling and formatting
- PII sanitization and redaction
- Memory-keeper log persistence
- Context enrichment
- Specialized logging methods

**Key Features Tested**:
- Automatic PII redaction (emails, NI numbers, cards)
- Rich context logging (user, case, workflow IDs)
- AI/ML request logging
- Document processing logs
- Authentication event logging

### 💾 MCP Filesystem Operations Tests
**File**: `tests/integration/mcp-filesystem.test.ts`

Tests MCP filesystem wrapper functionality:
- File reading and writing operations
- Directory operations
- Pattern matching and search
- Error handling and fallbacks
- Performance with large files

**Key Features Tested**:
- Text and binary file operations
- Concurrent file operations
- Error recovery mechanisms
- Integration with file-watcher
- Performance optimization

### 🌿 Git Service Integration Tests
**File**: `tests/integration/git-service.test.ts`

Tests git service with MCP git tools:
- Repository status and state management
- File staging and commit operations
- Branch management
- Diff operations and history
- Integration with structured logging

**Key Features Tested**:
- Git status parsing
- File staging and commits
- Branch creation and switching
- Workflow context integration
- Error handling with logging

### 🔄 Workflow Services Integration Tests
**File**: `tests/integration/workflow-services.test.ts`

Tests integration between multiple services:
- File change to git workflow
- Cross-service communication
- Error propagation and handling
- Performance under load
- State consistency

**Key Features Tested**:
- End-to-end file → memory → git workflow
- Service coordination and communication
- Error recovery and fallback mechanisms
- Performance with concurrent operations
- State management across service restarts

### 🎯 End-to-End Workflow Tests
**File**: `tests/e2e/mcp-workflow-complete.test.ts`

Complete workflow validation:
- Document ingestion workflow
- Legal document processing
- Multi-file operations
- Error handling and recovery
- Performance under load

**Key Scenarios Tested**:
- Complete legal document workflow
- Contract analysis and case updates
- Multi-file batch operations
- Service failure recovery
- High-volume document processing

## Test Data and Fixtures

### Test Case Simulation

The tests simulate realistic legal document workflows:

```typescript
const testCaseId = 'case-2024-001';
const testWorkflowId = 'workflow-document-ingestion';
const testUserId = 'solicitor-001';
```

### PII Testing

Tests include realistic PII scenarios:
- Client names and contact information
- Email addresses and phone numbers
- UK National Insurance numbers
- Credit card numbers
- Contract terms and dates

**Note**: All PII in tests is fictional and designed to validate sanitization.

### Legal Document Types

Tests cover various document types:
- Client contracts and agreements
- Case analysis and notes
- Legal briefs and research
- Court documents and filings
- Compliance and audit records

## Environment Configuration

### Required Environment Variables

```bash
# Core testing
NODE_ENV=test
MCP_ENABLED=true

# Logging configuration
LOG_CONSOLE=false          # Reduce noise during tests
LOG_MEMORY_KEEPER=true     # Enable memory persistence

# Git configuration (for git tests)
GIT_USER_NAME="Test User"
GIT_USER_EMAIL="test@example.com"
```

### Optional Configuration

```bash
# HTML report generation
GENERATE_HTML_REPORT=true

# Test performance tuning
TEST_TIMEOUT=30000
JEST_WORKERS=4
```

## Continuous Integration

### GitHub Actions Integration

The tests are designed to run in CI environments:

```yaml
name: MCP Integration Tests
on: [push, pull_request]
jobs:
  mcp-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:mcp:validate
      - run: npm run test:mcp:critical
      - run: npm run test:mcp:html
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: mcp-test-results
          path: test-results/mcp-integration/
```

### Nightly E2E Runs

For comprehensive testing, run the full suite nightly:

```bash
# Comprehensive nightly test
npm run test:mcp:html
```

## Test Reports and Artifacts

### JSON Reports

Located in `test-results/mcp-integration/`:
- `mcp-test-results.json`: Detailed test results and metrics
- Includes performance data and error details
- Machine-readable for CI integration

### HTML Reports

When `--html` flag is used:
- `mcp-test-results.html`: Interactive HTML report
- Includes charts, statistics, and failure details
- Suitable for stakeholder review

### Test Coverage

Integration tests focus on:
- **Functionality Coverage**: All MCP integrations tested
- **Error Coverage**: Failure scenarios and recovery
- **Performance Coverage**: Load and stress testing
- **Integration Coverage**: Cross-service workflows

## Troubleshooting

### Common Issues

**Git Tests Failing**
```bash
# Ensure git is configured
git config --global user.name "Test User"
git config --global user.email "test@example.com"
```

**Memory-Keeper Tests Failing**
```bash
# Verify MCP environment
export MCP_ENABLED=true
npm run test:mcp:validate
```

**File Watcher Tests Timing Out**
```bash
# Increase timeout for slow systems
export TEST_TIMEOUT=60000
```

### Debug Mode

Enable debug logging:
```bash
DEBUG=true npm run test:mcp
```

### Test-Specific Issues

**Integration Test Isolation**:
- Each test creates its own temporary directory
- Git repositories are initialized fresh per test
- Memory-keeper state is reset between tests

**E2E Test Performance**:
- E2E tests may take 2-5 minutes
- Use `--critical-only` for faster feedback
- Monitor system resources during execution

## Contributing

### Adding New Tests

1. **Create Test File**:
   ```bash
   touch tests/integration/new-service.test.ts
   ```

2. **Follow Test Structure**:
   ```typescript
   describe('New Service Integration', () => {
     beforeAll(async () => {
       // Setup test environment
     });
     
     describe('Core Functionality', () => {
       it('should handle basic operations', async () => {
         // Test implementation
       });
     });
   });
   ```

3. **Update Test Runner**:
   Add new test to `tests/scripts/run-mcp-tests.ts`

### Test Guidelines

- **Isolation**: Each test should be independent
- **Cleanup**: Always clean up test artifacts
- **Realism**: Use realistic legal document scenarios
- **Performance**: Include performance assertions
- **Error Handling**: Test both success and failure cases

### Code Coverage

Aim for:
- **Line Coverage**: >90%
- **Function Coverage**: >95%
- **Branch Coverage**: >85%
- **Integration Coverage**: 100% of MCP services

## Support

For issues with MCP integration tests:

1. **Validation First**: Run `npm run test:mcp:validate`
2. **Check Dependencies**: Ensure all MCP services are available
3. **Environment**: Verify environment variables are set
4. **Logs**: Check test output for specific error messages

## Performance Benchmarks

Expected performance for the test suite:

| Test Category | Duration | Tests | Files |
|---------------|----------|-------|-------|
| Memory-Keeper | ~30s | 25+ | 1 |
| File Watcher | ~45s | 30+ | 1 |
| Structured Logger | ~30s | 35+ | 1 |
| MCP Filesystem | ~30s | 25+ | 1 |
| Git Service | ~45s | 30+ | 1 |
| Workflow Services | ~60s | 20+ | 1 |
| E2E Complete | ~120s | 15+ | 1 |
| **Total** | **~6-8min** | **180+** | **7** |

## License

This testing suite is part of the Solicitor Brain v2 project and follows the same licensing terms.