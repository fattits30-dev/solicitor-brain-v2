# Testing Solicitor Brain v2

## Overview

This project uses:
- Jest for unit/integration tests (frontend/backend)
- Playwright for end-to-end (e2e) browser tests
- ESLint and Prettier for linting and formatting

## Running Tests

### Unit/Integration

```bash
npm test
```

### End-to-End (E2E)

```bash
npx playwright test
```

### Linting

```bash
npx eslint .
```

### Formatting

```bash
npx prettier --check .
```

## Directory Structure
- `tests/` - Frontend tests
- `server/tests/` - Backend tests
- `tests/e2e/` - Playwright e2e tests
