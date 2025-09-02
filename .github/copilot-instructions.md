# GitHub Copilot Instructions for Solicitor Brain v2

## Project Overview
Solicitor Brain v2 is a trauma-informed UK legal case management system built with TypeScript, React, and Express.js. The application helps UK solicitors manage cases, documents, and client communications with built-in AI assistance.

## Tech Stack
- **Frontend**: React + TypeScript + Vite + shadcn/ui + Tailwind CSS
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with pgvector extension + Redis
- **AI/ML**: Ollama (local LLMs) + Tesseract.js (OCR)
- **Auth**: JWT + bcrypt + role-based access control
- **Testing**: Jest + Playwright

## Code Style Guidelines

### TypeScript/JavaScript
- Use TypeScript for all new code
- Prefer `const` over `let`, never use `var`
- Use async/await over promises
- Use optional chaining `?.` and nullish coalescing `??`
- Export types separately from implementations
- Use type inference where possible, explicit types for function parameters

### React Components
- Use functional components with hooks
- Place component files in `/client/src/components/`
- Use shadcn/ui components from `@/components/ui/`
- Follow this structure:
```typescript
import statements
type/interface definitions
export const ComponentName: React.FC<Props> = ({ props }) => {
  // hooks
  // state
  // effects
  // handlers
  // render
};
```

### API Endpoints
- RESTful naming: `/api/resource` for collections, `/api/resource/:id` for items
- Use proper HTTP methods: GET, POST, PUT, PATCH, DELETE
- Always validate input with Zod schemas
- Return consistent error formats: `{ error: string, details?: any }`
- Include authentication middleware for protected routes

### Database Queries
- Use parameterized queries to prevent SQL injection
- Transaction wrapper for multi-step operations
- Include proper error handling and rollback
- Follow schema in `/shared/schema.ts`

## Security Requirements
- **Never** log sensitive data (passwords, tokens, PII)
- Always hash passwords with bcrypt
- Validate and sanitize all user inputs
- Use parameterized SQL queries
- Apply rate limiting to auth endpoints
- Redact PII in audit logs

## UK Legal Domain Context
- Use UK legal terminology (solicitor, barrister, tribunal)
- Reference UK legislation (DWP, HMCTS, Companies House)
- Date format: DD/MM/YYYY
- Phone format: UK (+44)
- Postcode validation: UK format

## Component Patterns

### Form Handling
```typescript
const [formData, setFormData] = useState<FormType>(initialValues);
const [errors, setErrors] = useState<ErrorType>({});
const [loading, setLoading] = useState(false);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  try {
    const validated = schema.parse(formData);
    await api.submit(validated);
    toast.success('Success message');
  } catch (error) {
    handleError(error);
  } finally {
    setLoading(false);
  }
};
```

### API Calls
```typescript
// Use the fetch wrapper with auth headers
const response = await fetch('/api/endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(data)
});

if (!response.ok) {
  throw new Error(`API error: ${response.status}`);
}

const result = await response.json();
```

### Error Handling
```typescript
try {
  // operation
} catch (error) {
  console.error('Context-specific error message:', error);
  
  if (error instanceof ZodError) {
    // Handle validation errors
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: error.errors 
    });
  }
  
  // Generic error response
  res.status(500).json({ 
    error: 'Internal server error' 
  });
}
```

## Testing Guidelines
- Write tests for all new features
- Test file naming: `*.test.ts` or `*.test.tsx`
- Mock external dependencies
- Test both success and error cases
- Include edge cases

## Accessibility Requirements
- WCAG 2.2 AA compliance
- All interactive elements must be keyboard accessible
- Proper ARIA labels and roles
- Focus management for modals and navigation
- Alt text for images
- Semantic HTML structure

## AI Integration Patterns
```typescript
// AI chat integration
const response = await fetch('/api/ai/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: userInput,
    context: { caseId, documentId },
    model: 'llama3.2'
  })
});

// Document analysis
const analysis = await fetch('/api/ai/analyze', {
  method: 'POST',
  body: formData // includes file
});
```

## Database Schema Key Tables
- `users` - Authentication and roles
- `cases` - Legal cases
- `persons` - Clients, opponents, staff  
- `documents` - File metadata
- `events` - Case timeline
- `drafts` - AI-generated content
- `audit_log` - Security audit trail
- `embeddings` - Vector search data

## Environment Variables
Required in `.env`:
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection
- `JWT_SECRET` - JWT signing secret
- `SESSION_SECRET` - Session encryption
- `OLLAMA_BASE_URL` - Local AI server

## Common Commands
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm test            # Run tests
npm run lint        # Lint code
npm run e2e         # Run E2E tests
```

## Do's and Don'ts

### DO:
- ✅ Follow TypeScript best practices
- ✅ Use shadcn/ui components
- ✅ Handle errors gracefully
- ✅ Validate all inputs
- ✅ Write clear commit messages
- ✅ Test authentication flows
- ✅ Use semantic HTML
- ✅ Follow RESTful conventions

### DON'T:
- ❌ Store sensitive data in localStorage
- ❌ Log PII or passwords
- ❌ Use `any` type without justification
- ❌ Commit `.env` files
- ❌ Skip input validation
- ❌ Ignore accessibility
- ❌ Use inline styles
- ❌ Make synchronous API calls

## Trauma-Informed UX Principles
1. Use clear, non-judgmental language
2. Provide user control with clear consent
3. Show progress indicators for all operations
4. Offer undo/cancel options
5. Use warm, supportive error messages
6. Avoid sudden changes or auto-actions
7. Provide clear data retention information

## File Structure
```
/client/src/
  /components/     # React components
  /hooks/          # Custom hooks
  /lib/            # Utilities
  /pages/          # Page components
/server/
  /routes/         # API routes
  /services/       # Business logic
  /middleware/     # Express middleware
  /utils/          # Utilities
/shared/           # Shared types/schemas
```

## Git Commit Format
```
type: brief description

- Detailed point 1
- Detailed point 2

Fixes #issue
```

Types: feat, fix, docs, style, refactor, test, chore

## Performance Guidelines
- Lazy load heavy components
- Use React.memo for expensive renders
- Implement pagination for lists
- Cache API responses where appropriate
- Optimize images and assets
- Use database indexes on frequently queried columns

## When Suggesting Code:
1. Consider UK legal context
2. Ensure accessibility compliance
3. Include error handling
4. Add TypeScript types
5. Follow existing patterns in codebase
6. Consider security implications
7. Include necessary imports
8. Add helpful comments for complex logic

Remember: This is a legal application handling sensitive data. Security, privacy, and compliance are paramount.