# Developer Quick Start Guide

## 🚀 Getting Started

### Prerequisites

- Node.js 20+ and npm 10+
- Python 3.11+
- Docker and Docker Compose
- Git

### Initial Setup

1. **Clone and install dependencies:**

```bash
git clone <repo-url>
cd solicitor-brain-v2
npm install
```

2. **Start infrastructure:**

```bash
docker-compose -f docker-compose.dev.yml up -d
```

3. **Setup database:**

```bash
npm run db:migrate
npm run db:seed
```

4. **Configure environment:**

```bash
cp .env.example .env
# Edit .env with your settings
```

5. **Start development servers:**

```bash
npm run dev
```

The application will be available at:

- Frontend: http://localhost:5173
- Backend API: http://localhost:3333
- MailHog UI: http://localhost:8025
- Adminer (DB UI): http://localhost:8080
- Jaeger (Tracing): http://localhost:16686

## 📁 Project Structure

```
solicitor-brain-v2/
├── client/              # React frontend (Vite)
├── server/              # Express backend (transitioning to FastAPI)
├── shared/              # Shared types and utilities
├── scripts/             # Build and utility scripts
├── tests/               # E2E tests (Playwright)
├── docs/                # Documentation
├── ops/                 # Operations (CI, Docker, K8s)
└── docker-compose.dev.yml
```

## 🛠️ Common Commands

### Development

```bash
npm run dev              # Start all dev servers
npm run dev:debug        # Start with debugger
npm run dev:logs         # Start with detailed logging
```

### Database

```bash
npm run db:migrate       # Run migrations
npm run db:seed          # Seed test data
npm run db:reset         # Reset database
npm run db:push          # Push schema changes (Drizzle)
```

### Testing

```bash
npm test                 # Run unit tests
npm run test:watch       # Run tests in watch mode
npm run e2e              # Run E2E tests
npm run lint             # Run linter
npm run format           # Check formatting
npm run typecheck        # Type checking
```

### Git Workflow

```bash
npm run commit           # Commit with conventional commits
git push                 # Push changes (hooks will run)
```

### Docker

```bash
docker-compose -f docker-compose.dev.yml up -d    # Start services
docker-compose -f docker-compose.dev.yml down     # Stop services
docker-compose -f docker-compose.dev.yml logs -f  # View logs
npm run docker:reset     # Reset all containers and volumes
```

### Build & Production

```bash
npm run build            # Build for production
npm run start            # Start production server
```

## 🔍 RAG Pipeline

### Indexing Documents

```bash
# Index a directory of PDFs
tsx scripts/index-documents.ts --dir ./documents

# Index with specific settings
tsx scripts/index-documents.ts \
  --dir ./documents \
  --chunk-size 500 \
  --overlap 100
```

### Vector Search

The application uses pgvector for semantic search. Embeddings are generated using:

- Ollama with llama3.2 model (local)
- OpenAI embeddings (optional, requires API key)

## 🔐 Authentication

### Test Credentials

```
Admin:     admin / password123
Solicitor: jsolicitor / password123
Paralegal: jdoe / password123
```

### MFA Setup

MFA is optional but recommended. To enable:

1. Login with your credentials
2. Go to Settings → Security
3. Enable Two-Factor Authentication
4. Scan QR code with authenticator app

## 🧪 Testing

### Running Tests

```bash
# All tests
npm test

# Specific test file
npm test -- auth.test.ts

# E2E tests
npm run e2e

# E2E with UI
npx playwright test --ui
```

### Writing Tests

- Unit tests: `*.test.ts` files next to source
- Integration tests: `tests/integration/`
- E2E tests: `tests/e2e/`

## 📊 Monitoring & Debugging

### Logs

- Application logs: Check terminal output
- Docker logs: `docker-compose -f docker-compose.dev.yml logs -f [service]`

### Database

- Adminer UI: http://localhost:8080
- Server: postgres
- Username: postgres
- Password: development_secure_2024
- Database: solicitor_brain

### Email Testing

- MailHog UI: http://localhost:8025
- SMTP: localhost:1025

### Tracing

- Jaeger UI: http://localhost:16686
- View distributed traces for API calls

## 🚨 Troubleshooting

### Port Conflicts

If ports are already in use:

```bash
# Check what's using a port
lsof -i :5173

# Change ports in .env or docker-compose.dev.yml
```

### Database Issues

```bash
# Reset database
npm run db:reset

# Check PostgreSQL logs
docker-compose -f docker-compose.dev.yml logs postgres
```

### Module Not Found

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Vite HMR Not Working

- Check that ports 5173 and 24678 are not blocked
- Try disabling browser extensions
- Clear browser cache

## 🔗 Useful Links

- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [Express Documentation](https://expressjs.com)
- [PostgreSQL Documentation](https://www.postgresql.org/docs)
- [Playwright Documentation](https://playwright.dev)
- [Docker Documentation](https://docs.docker.com)

## 📝 Contributing

1. Create feature branch from `main`
2. Make changes following coding standards
3. Write/update tests
4. Run `npm run commit` for conventional commits
5. Push and create PR
6. Ensure CI passes
7. Request review

## ⚠️ Important Notes

- **Never commit .env files**
- **Always use conventional commits**
- **Run tests before pushing**
- **Keep PRs small (≤300 LOC)**
- **Update documentation for changes**
- **Use TypeScript strict mode**

## 🆘 Getting Help

- Check this guide first
- Search existing issues
- Ask in team chat
- Create detailed bug report with:
  - Steps to reproduce
  - Expected behavior
  - Actual behavior
  - Environment details
  - Error messages/screenshots
