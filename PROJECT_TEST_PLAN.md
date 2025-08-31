# Solicitor Brain v2 Testing System Plan

## Goal
Implement a full-stack, policy-compliant testing system for Solicitor Brain v2, covering:
- Frontend (React/TypeScript): unit, integration, and e2e tests
- Backend (Express/TypeScript): unit and integration tests
- Linting and type-checking for both
- Test scripts and CI hooks

## Minimal Surface to Touch
- package.json (add scripts, devDeps)
- Makefile (enable test targets)
- jest.config.cjs (frontend/backend unit/integration)
- playwright.config.ts (frontend e2e)
- tests/ (sample tests)
- server/tests/ (backend tests)
- .eslintrc, .prettierrc (linting)
- docs/TESTING.md (usage docs)

## Risks & Test Points
- Test coverage gaps (start with smoke tests)
- CI integration (ensure scripts are portable)
- Lint/type errors blocking tests
- Playwright/Node version mismatches

## Next Steps
1. Add Jest, Playwright, ESLint, Prettier, and types as devDeps
2. Add jest.config.cjs, playwright.config.ts, .eslintrc, .prettierrc
3. Add sample tests for frontend and backend
4. Update Makefile and package.json scripts
5. Add docs/TESTING.md
6. Run all tests and lint checks

