# Solicitor Brain v2 - Project Plan

## 🎯 Project Overview
A trauma-informed UK legal case management system with AI capabilities for solicitors handling vulnerable client cases. Built with React, Express, PostgreSQL, and AI integrations.

## ✅ Completed Features (as of 2025-08-30)

### 1. **Authentication System** ✅
- [x] JWT-based authentication with bcrypt hashing
- [x] Login page component with validation
- [x] AuthContext for global state management
- [x] ProtectedRoute component for route guards
- [x] Role-based access control (admin, solicitor, paralegal)
- [x] Token storage in localStorage
- [x] Session persistence

### 2. **File Management System** ✅
- [x] Multer integration for uploads
- [x] Single and batch file uploads
- [x] File type/size validation
- [x] SHA-256 hash deduplication
- [x] Case-specific storage directories
- [x] Download/delete endpoints
- [x] File watching with backups

### 3. **Database Infrastructure** ✅
- [x] PostgreSQL with pgvector extension
- [x] Drizzle ORM with migrations
- [x] Redis caching layer
- [x] Docker Compose configuration
- [x] Seed scripts with test data
- [x] Audit logging service

### 4. **Developer Experience** ✅
- [x] VS Code debugging configuration
- [x] Error boundaries for React
- [x] Console logging for debugging
- [x] Hot module replacement
- [x] TypeScript configuration

## 🔧 Current Issues

### Critical
1. **Frontend White Screen**
   - Status: Debugging tools added
   - Next: Check browser console for errors
   - Error boundary and console logs added

2. **Upload API Routes**
   - Status: Routes registered but returning HTML
   - Issue: Vite catching routes before Express
   - Fix: Reorder middleware or adjust route paths

## 📋 Pending Features (Priority Order)

### Phase 1: Core Functionality
1. **Fix Frontend Issues** 🔴
   - Debug white screen with browser console
   - Verify all components load correctly
   - Test login flow end-to-end

2. **Fix Upload Routes** 🔴
   - Ensure API routes are handled before Vite
   - Test file upload with Postman/curl
   - Verify multer middleware works

### Phase 2: AI Integration
3. **OCR Processing**
   - Install Tesseract.js
   - Create OCR service
   - Process uploaded PDFs/images
   - Store extracted text in database
   - Update embeddings table

4. **Ollama Integration**
   - Connect to Ollama API
   - Implement document analysis
   - Create draft generation
   - Add tone adjustment (trauma-informed)
   - Implement RAG search

5. **Vector Search**
   - Implement embedding generation
   - Store vectors in pgvector
   - Create similarity search API
   - Build search UI component

### Phase 3: Enhanced Features
6. **Document Viewer**
   - PDF viewer component
   - Annotation support
   - Highlight search results
   - Side-by-side comparison

7. **Testing Infrastructure**
   - Jest unit tests
   - Playwright E2E tests
   - API integration tests
   - Coverage reporting

8. **Production Deployment**
   - Environment configuration
   - Docker production builds
   - CI/CD pipeline
   - SSL/TLS setup
   - Backup strategies

## 🗂️ Database Schema
```
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

## 🔐 Test Credentials
- **Admin**: admin / password123
- **Solicitor**: jsolicitor / password123
- **Paralegal**: jdoe / password123

## 📊 Project Statistics
- **Source Files**: 94
- **Database Tables**: 9
- **User Roles**: 3
- **File Size Limit**: 10MB
- **Completion**: ~60%

## 🚀 Quick Start Commands
```bash
# Start development
npm run dev

# Reset database
npm run db:reset

# Seed database
npm run db:seed

# Start Docker services
docker-compose up -d

# Debug in VS Code
F5 -> Select "Full Stack Debug"
```

## 📝 Next Session Tasks
1. Open browser console and check for JavaScript errors
2. Test login functionality in browser
3. Fix upload route registration order
4. Begin OCR integration with Tesseract

## 🔗 Important Files
- `/server/index.ts` - Main server file
- `/server/routes.ts` - API route registration
- `/client/src/App.tsx` - Main React component
- `/client/src/contexts/AuthContext.tsx` - Auth state
- `/server/services/upload.ts` - File upload logic
- `/shared/schema.ts` - Database schema

## 💡 Architecture Decisions
- **Frontend**: React with Vite, shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with pgvector for AI
- **Auth**: JWT with bcrypt, role-based access
- **File Storage**: Local filesystem with SHA-256 dedup
- **AI**: Ollama (local) for LLM, Tesseract for OCR

---
Last Updated: 2025-08-30 by Claude Code