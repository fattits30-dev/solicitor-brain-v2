# GitHub Copilot Agent Instructions

## Project Context

This is Solicitor Brain v2 - a trauma-informed UK legal case management system built with:

- Frontend: React + TypeScript + Vite + shadcn/ui + Tailwind CSS
- Backend: Express.js + TypeScript (migrating to FastAPI)
- Database: PostgreSQL with pgvector + Redis
- AI: Ollama for local LLMs + Tesseract.js for OCR

## Agent Mode Instructions

### Code Style

- Use TypeScript with strict typing
- Follow existing patterns in the codebase
- Use async/await instead of callbacks
- Prefer functional components with hooks in React
- Use Zod for validation schemas

### Testing

- Write tests for all new features
- Use Playwright for E2E tests
- Use Jest for unit tests
- Test files should be co-located with source files

### Security

- Never expose sensitive data in logs
- Always sanitize user inputs
- Use parameterized queries for database operations
- Implement proper authentication checks
- Follow OWASP security guidelines

### Fix Mode Guidelines

When fixing code:

1. Preserve existing functionality
2. Add type safety where missing
3. Fix ESLint/TypeScript errors
4. Improve error handling
5. Add appropriate logging

### Refactoring Guidelines

When refactoring:

1. Extract reusable components/functions
2. Reduce complexity (max 20 lines per function preferred)
3. Improve naming for clarity
4. Add JSDoc comments for complex logic
5. Use design patterns where appropriate

### Documentation Guidelines

When documenting:

1. Use JSDoc for all exported functions
2. Include parameter types and return types
3. Add examples for complex functions
4. Document edge cases and assumptions
5. Keep comments concise and valuable

### Test Generation Guidelines

When generating tests:

1. Test happy path and edge cases
2. Test error conditions
3. Use descriptive test names
4. Mock external dependencies
5. Aim for 80% coverage minimum

### Performance Optimization

When optimizing:

1. Use React.memo for expensive components
2. Implement proper caching strategies
3. Optimize database queries
4. Use lazy loading where appropriate
5. Profile before and after changes

## Specific Instructions

### Database Operations

- Always use transactions for multi-table operations
- Implement proper connection pooling
- Use pgvector for semantic search operations
- Cache frequently accessed data in Redis

### API Endpoints

- Follow RESTful conventions
- Return consistent error responses
- Implement rate limiting
- Use proper HTTP status codes
- Validate all inputs with Zod

### Frontend Components

- Use shadcn/ui components as base
- Follow accessibility guidelines (WCAG 2.2 AA)
- Implement proper loading states
- Handle errors gracefully
- Use React Query for data fetching

### AI Integration

- Use Ollama for local LLM operations
- Implement proper prompt engineering
- Handle AI failures gracefully
- Provide fallback options
- Monitor token usage

## Forbidden Actions

- Never commit secrets or API keys
- Never bypass authentication
- Never log sensitive user data
- Never use eval() or similar
- Never disable security features
- Never use synchronous file operations in production

## Common Tasks

### Fix TypeScript Errors

@workspace /fix #typescript-errors Focus on type safety and proper interface definitions

### Generate Tests

@workspace /tests #missing-coverage Generate comprehensive test suites for untested code

### Optimize Performance

@workspace /optimize #performance Identify and fix performance bottlenecks

### Security Audit

@workspace /audit #security Review code for security vulnerabilities

### Refactor Complex Code

@workspace /refactor #complexity Simplify complex functions and components

### Add Documentation

@workspace /doc #missing-docs Add JSDoc comments and update README
