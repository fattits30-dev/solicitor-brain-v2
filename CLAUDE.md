# CLAUDE.md - Solicitor Brain v2 Assistant Reference Guide
**ALWAYS READ THIS FILE FIRST IN EVERY SESSION**

## 🎯 PROJECT IDENTITY
**App Name**: Solicitor Brain - Trauma-informed UK legal case management system
**Architecture**: Monorepo with pnpm + Turbo (transitioning from current Express/React setup)
**Current State**: ~70% complete, testing infrastructure in place

## 🏗️ CURRENT TECH STACK (As Implemented)
```yaml
Frontend: React + Vite + TypeScript + shadcn/ui + Tailwind
Backend: Express.js + TypeScript (will migrate to FastAPI)
Database: PostgreSQL with pgvector + Redis
AI: Ollama (local LLMs) + Tesseract.js (OCR)
Testing: Jest + Playwright + ESLint + Prettier
Auth: JWT + bcrypt + role-based access
```

## 📋 MASTER REQUIREMENTS (Non-Negotiable)
1. **NO MOCK DATA IN PRODUCTION** - Use dev/seed/ for test data
2. **Privacy by Default** - Redact PII, sanitize logs
3. **Small PRs** - ≤300 LOC unless specified
4. **Trauma-Informed UX** - WCAG 2.2 AA, consent gates, clear language
5. **Test Everything** - No code without tests

## 🗄️ DATABASE SCHEMA (Current)
```sql
users           - Authentication and roles
cases           - Legal cases  
persons         - Clients, opponents, staff
documents       - Uploaded files metadata
events          - Case timeline events
drafts          - AI-generated drafts
consents        - GDPR consent tracking
audit_log       - Security audit trail
embeddings      - Vector search data
```

## 🔑 TEST CREDENTIALS
```
Admin: admin / password123
Solicitor: jsolicitor / password123  
Paralegal: jdoe / password123
```

## 📁 PROJECT STRUCTURE
```
/client         - React frontend
/server         - Express backend (to become FastAPI)
/shared         - Shared types and schemas
/tests          - E2E tests
/scripts        - Build and dev scripts
/uploads        - File storage
/docs           - Documentation

Future Structure (per Master Prompt):
/packages/ui    - Next.js app
/packages/api   - FastAPI service
/packages/rag   - RAG pipeline
/packages/libs  - Shared libraries
```

## ✅ COMPLETED FEATURES
- [x] JWT Authentication with role-based access
- [x] File upload/management with deduplication
- [x] PostgreSQL + pgvector + Redis infrastructure
- [x] OCR with Tesseract.js
- [x] Ollama AI integration
- [x] Vector embeddings and semantic search
- [x] Audit logging
- [x] Testing infrastructure (Jest + Playwright)

## 🔴 CURRENT ISSUES
1. Frontend login page working but needs full flow testing
2. API routes returning HTML (Vite intercepting)
3. AI features disabled in .env (ENABLE_AI_FEATURES=false)

## 🎯 IMMEDIATE PRIORITIES
1. **Fix API Routing** - Express routes before Vite
2. **Enable AI Features** - Set flags to true, verify Ollama running
3. **Test Auth Flow** - Verify login/logout/session
4. **Build Missing UI** - Document viewer, search interface, AI chat

## 🚀 NEXT PHASE TASKS

### Phase 1: Core Fixes (This Week)
- [ ] Fix API route handling order
- [ ] Enable and test AI features
- [ ] Complete authentication flow
- [ ] Build document viewer component

### Phase 2: UI Components (Next Week)
- [ ] Semantic search interface
- [ ] AI chat/Q&A panel
- [ ] Draft generator UI
- [ ] Case timeline view

### Phase 3: UK Legal API Integration
- [ ] Companies House API
- [ ] legislation.gov.uk API
- [ ] HMCTS court data
- [ ] GOV.UK Notify
- [ ] Land Registry API

### Phase 4: Migration to Target Architecture
- [ ] Migrate Express → FastAPI
- [ ] Migrate React → Next.js
- [ ] Implement pnpm workspaces
- [ ] Set up Turbo monorepo

## 🛠️ MCP TOOLS AVAILABLE

### Core Tools
- **Bash** - Command execution
- **Read/Write/Edit** - File operations
- **Grep/Glob** - File searching
- **Git** - Version control via mcp__git
- **WebFetch** - URL content fetching
- **TodoWrite** - Task management

### MCP Services
- **mcp__memory-keeper** - Persistent context storage
- **mcp__filesystem** - Advanced file operations
- **mcp__git** - Git operations
- **mcp__ide** - VS Code integration
- **mcp__fetch** - Web content fetching

### Specialized Agents
- **legal-template-generator** - UK legal templates
- **document-ingestion-pipeline** - PDF OCR pipeline
- **fastapi-service-builder** - API implementation
- **legal-schema-architect** - Legal database design
- **test-automation-engineer** - Test implementation
- **security-audit-guardian** - Security setup
- **local-model-optimizer** - LLM configuration

## 📝 WORKFLOW COMMANDS (Pseudo Slash Commands)

```bash
/plan {goal}          - Create implementation plan
/implement {goal}     - Plan → Code → Test → PR
/fixloop             - Fix failing tests/checks
/audit {area}        - Security/privacy audit
/seed {entity}       - Generate test data
/migrate {change}    - Database migration
/rag-index {dir}     - Index documents for RAG
/doc {topic}         - Write documentation
/ux {page}           - Build UI with a11y
/bench {component}   - Performance testing
```

## 🔒 SECURITY & COMPLIANCE

### PII Fields to Redact
- Names, DOBs, addresses
- NI numbers, case references
- Phone numbers, emails
- Financial information

### Consent Requirements
- OCR processing consent
- Data sharing consent
- Export/deletion requests
- Retention policies (7 years)

## 🎨 UX PRINCIPLES
1. **Trauma-Informed Language** - Clear, non-judgmental
2. **User Control** - "You control this action" copy
3. **Consent Gates** - Review before sensitive actions
4. **Accessibility** - WCAG 2.2 AA minimum
5. **Keyboard Navigation** - Full keyboard support

## 📊 QUICK STATUS CHECKS

```bash
# Check server health
curl http://localhost:3000/api/health

# Run tests
npm run e2e
npm run test

# Check Ollama
curl http://localhost:11434/api/tags

# Database status
psql $DATABASE_URL -c "SELECT COUNT(*) FROM cases;"

# View logs
npm run dev:logs
```

## 🚨 GUARDIAN CHECKS
Before ANY commit:
1. Run tests: `npm test && npm run e2e`
2. Check linting: `npm run lint`
3. Verify no mock data in production code
4. Ensure PII is redacted in logs/examples
5. Confirm accessibility compliance

## 📌 SESSION CHECKLIST
When starting a new session:
1. [ ] Read this CLAUDE.md file
2. [ ] Check git status
3. [ ] Review recent commits
4. [ ] Load context from memory-keeper
5. [ ] Check server status
6. [ ] Review open issues/tasks

## 🔗 KEY FILES
- `/server/index.ts` - Main server
- `/server/routes.ts` - API routes
- `/client/src/App.tsx` - React app
- `/shared/schema.ts` - Database schema
- `/.env` - Configuration
- `/PROJECT_PLAN.md` - Detailed plan
- `/attached_assets/*` - Master prompt

## 💡 REMEMBER
- Always use TodoWrite for task tracking
- Save important context to memory-keeper
- Keep PRs small and focused
- Test before committing
- No mock data in production
- Redact PII everywhere
- Follow trauma-informed UX principles

---
Last Updated: 2025-08-31
Session: a64b7a9f