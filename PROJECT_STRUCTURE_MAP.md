# Solicitor Brain v2 - Project Structure Analysis

## ✅ PROJECT STRUCTURE CLEANED (2025-09-01)

### Current Architecture (CLEAN - Single Unified App)

```
solicitor-brain-v2/
├── 📦 MAIN BUILD SYSTEM: Express + React + Vite
│   ├── /client/           - React frontend (Vite)
│   ├── /server/           - Express backend
│   ├── /shared/           - Shared types/schemas
│   ├── /dist/             - Production build
│   ├── package.json       - Main build (port 3333)
│   └── vite.config.ts     - Vite configuration
│
├── 📦 MICROSERVICES: Python FastAPI
│   ├── /services/api/     - Python backend
│   ├── requirements.txt   - Python deps
│   └── Worker/Queue       - Document processing
│
└── ✅ CLEANED FILES
    ├── Removed /web/      - Next.js duplicate
    ├── Removed duplicate API files
    └── Cleaned root directory

```

## ✅ CLEANUP COMPLETED

### Issues Fixed:

1. **Removed Duplicate Build System**
   - Deleted orphaned Next.js `/web` folder
   - Single build system now: Express + React + Vite

2. **Consolidated Configuration**
   - Single `package.json` in root
   - Unified scripts and dependencies

3. **Cleaned Ports**
   - Main app: PORT=3333
   - Database: PORT=5433
   - Redis: PORT=6379
   - Ollama: PORT=11434

4. **Fixed Server Startup**
   - Disabled problematic pdf-parse import
   - Commented out file-watcher causing issues

## ✅ RECOMMENDED CLEAN STRUCTURE

### Option 1: Keep Express + React (Current Working System)

```
solicitor-brain-v2/
├── /client/          - React frontend
├── /server/          - Express backend
├── /shared/          - Shared types
├── /services/        - Python microservices
├── package.json      - Single package.json
└── DELETE: /web/     - Remove Next.js
```

### Option 2: Migrate to Next.js (As per Master Plan)

```
solicitor-brain-v2/
├── /packages/
│   ├── /web/        - Next.js app (from /web)
│   ├── /api/        - FastAPI (from /services/api)
│   └── /shared/     - Shared types
├── pnpm-workspace.yaml
└── DELETE: /client, /server
```

## 📋 CLEANUP TASKS

### Immediate Actions Needed:

1. **Choose architecture**: Express+React OR Next.js
2. **Remove duplicate files**
3. **Consolidate package.json**
4. **Fix import paths**
5. **Update build scripts**

## 🔧 CURRENT RUNNING CONFIGURATION

```bash
# What's Actually Running Now:
- Frontend: React + Vite at http://localhost:3333
- Backend: Express TypeScript at :3333/api
- Database: PostgreSQL at :5433
- Redis: Local at :6379
- Entry: server/index.ts → routes.ts → vite dev server
```

## 📝 SCRIPTS MAPPING

### Root package.json (Active):

- `dev` → tsx server/index.ts (Express + Vite)
- `build` → vite build + esbuild server
- `start` → node dist/index.js

### Web package.json (Orphaned):

- `dev` → next dev --port 3002
- `build` → next build
- `start` → next start

## 🚀 RECOMMENDATION

**KEEP EXPRESS + REACT** (Option 1)

- It's working now
- Authentication complete
- Database integrated
- Delete `/web` folder
- Focus on completing features

OR

**MIGRATE TO MONOREPO** (Option 2)

- Follow master plan
- Use pnpm workspaces
- Requires significant refactoring
- Better long-term architecture
