# Solicitor Brain v2 - Project Structure Analysis

## 🚨 DUPLICATE BUILD SYSTEMS DETECTED

### Current Architecture (MESSY - 2 Apps in 1)

```
solicitor-brain-v2/
├── 📦 BUILD SYSTEM 1: Express + React + Vite (ACTIVE)
│   ├── /client/           - React frontend (Vite)
│   ├── /server/           - Express backend
│   ├── /shared/           - Shared types/schemas
│   ├── package.json       - Main build (port 3333)
│   └── vite.config.ts     - Vite configuration
│
├── 📦 BUILD SYSTEM 2: Next.js (ORPHANED)
│   ├── /web/              - Next.js app
│   ├── web/package.json   - Separate deps (port 3002)
│   └── web/.next/         - Next.js build artifacts
│
├── 📦 BUILD SYSTEM 3: Python FastAPI (Phase 5)
│   ├── /services/api/     - Python backend
│   ├── requirements.txt   - Python deps
│   └── Worker/Queue       - Document processing
│
└── 🗑️ REDUNDANT/DUPLICATE FILES
    ├── /server/api/real-api.ts    - Duplicate API?
    ├── /dist/                      - Production build
    └── Multiple index.html files

```

## 🎯 IDENTIFIED ISSUES

### 1. **Two Frontend Frameworks**

- **React + Vite** in `/client` (Currently running)
- **Next.js** in `/web` (Abandoned/incomplete)

### 2. **Multiple Package.json Files**

- Root `package.json` - Express/React app
- `/web/package.json` - Next.js app (separate)

### 3. **Port Conflicts**

- Main app: PORT=3333 (from .env)
- Next.js: PORT=3002 (hardcoded)
- Database: PORT=5433
- Redis: PORT=6379
- Ollama: PORT=11434

### 4. **Script Conflicts**

Both package.json files have:

- `npm run dev` (different commands)
- `npm run build` (different outputs)
- `npm run start` (different servers)

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
