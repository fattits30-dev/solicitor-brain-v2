# Solicitor Brain v2

A trauma-informed, privacy-focused legal case management system for UK solicitors, featuring AI-powered document processing and legal drafting assistance.

## 🎯 Overview

Solicitor Brain is a comprehensive case management platform designed specifically for UK legal professionals, with a focus on:
- **Privacy-first architecture** - All sensitive data is redacted by default
- **Trauma-informed UX** - Clear consent flows and empathetic language
- **AI-powered assistance** - Local LLM integration for document analysis and drafting
- **WCAG 2.2 AA compliance** - Fully accessible interface
- **Comprehensive audit trail** - 7-year retention for UK legal compliance

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Docker and Docker Compose
- PostgreSQL (via Docker or local)
- 8GB+ RAM for AI features

### Setup

```bash
# 1. Clone the repository
git clone <repository-url>
cd solicitor-brain-v2

# 2. Install dependencies
npm install

# 3. Copy environment variables
cp .env.example .env

# 4. Start services and setup database
make setup

# 5. Start development server
make dev
```

The application will be available at http://localhost:3000

### Test Credentials

After running `make setup`, use these credentials:
- **Admin:** admin / password123
- **Solicitor:** jsolicitor / password123  
- **Paralegal:** jdoe / password123

## 📁 Project Structure

```
solicitor-brain-v2/
├── client/              # React frontend application
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Application pages
│   │   ├── hooks/       # Custom React hooks
│   │   └── lib/         # Utilities and helpers
├── server/              # Express.js backend
│   ├── routes/          # API route handlers
│   ├── services/        # Business logic
│   ├── middleware/      # Express middleware
│   └── storage.ts       # Database abstraction
├── shared/              # Shared TypeScript types
│   └── schema.ts        # Database schema & types
├── scripts/             # Utility scripts
│   ├── migrate.ts       # Database migrations
│   ├── seed.ts          # Seed data
│   └── reset-db.ts      # Database reset
├── migrations/          # Database migration files
├── uploads/             # File upload directory
└── docker-compose.yml   # Docker services config
```

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **shadcn/ui** component library
- **TanStack Query** for server state
- **React Hook Form** + Zod validation
- **Wouter** for routing

### Backend
- **Express.js** with TypeScript
- **Drizzle ORM** for database
- **PostgreSQL** with pgvector extension
- **Redis** for queues and caching
- **JWT** authentication
- **bcrypt** for password hashing

### AI/ML (Planned)
- **Ollama** for local LLM inference
- **pgvector** for semantic search
- **Tesseract** for OCR processing

## 📊 Database Schema

The application uses PostgreSQL with the following core tables:

- **users** - System users (solicitors, admins, paralegals)
- **cases** - Legal cases with status and risk levels
- **persons** - Clients, opponents, and other parties
- **documents** - Case documents with OCR text
- **events** - Case timeline (hearings, letters, tasks)
- **drafts** - AI-assisted legal document drafts
- **consents** - GDPR consent tracking
- **audit_log** - Comprehensive audit trail
- **embeddings** - Vector embeddings for RAG

## 🔐 Security & Privacy

- **Authentication:** JWT-based with bcrypt password hashing
- **Authorization:** Role-based access control (RBAC)
- **Data Protection:** Automatic PII redaction in logs
- **Consent Management:** Granular consent tracking
- **Audit Trail:** Complete action logging with 7-year retention
- **Encryption:** TLS in transit, encryption at rest (planned)

## 🎨 Features

### Implemented ✅
- Complete database schema with relationships
- JWT authentication system
- RESTful API for all core entities
- Responsive React UI with shadcn components
- Consent management system
- Audit logging with PII redaction
- Dashboard with statistics
- Case management interface
- Document upload UI (frontend only)
- Legal drafts editor

### In Progress 🚧
- File storage backend
- Ollama AI integration
- OCR document processing
- Vector search implementation
- Testing infrastructure

### Planned 📋
- Real-time updates via WebSockets
- Advanced search filters
- Document collaboration
- Mobile app
- Offline mode
- Backup/restore system

## 🧪 Development

### Available Commands

```bash
# Development
make dev          # Start dev server
make build        # Build for production
make check        # Run TypeScript checks

# Docker
make docker-up    # Start services
make docker-down  # Stop services
make docker-reset # Reset and restart

# Database
make db-setup     # Create schema
make db-seed      # Add test data
make db-reset     # Drop all tables

# Utilities
make setup        # Complete setup
make clean        # Clean artifacts
make help         # Show all commands
```

### Environment Variables

Key configuration in `.env`:

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/solicitor_brain
SESSION_SECRET=your-secret-here
JWT_SECRET=your-jwt-secret
OLLAMA_BASE_URL=http://localhost:11434
REDIS_URL=redis://localhost:6379
```

## 🤝 Contributing

### Development Workflow

1. Create feature branch: `feat/your-feature`
2. Make changes following existing patterns
3. Ensure TypeScript checks pass: `npm run check`
4. Test thoroughly with seed data
5. Update documentation if needed
6. Submit PR with clear description

### Code Standards

- TypeScript strict mode enabled
- Functional components with hooks
- Zod for runtime validation
- Consistent error handling
- PII redaction by default
- WCAG 2.2 AA compliance

## 📄 License

MIT License - See LICENSE file for details

## 🆘 Support

For issues or questions:
1. Check existing issues on GitHub
2. Review documentation in `/docs`
3. Contact the development team

## 🔮 Roadmap

### Phase 1: Core Foundation (Current)
- ✅ Database schema
- ✅ Authentication system
- ✅ Basic UI implementation
- 🚧 File storage backend
- 🚧 Testing framework

### Phase 2: AI Integration
- [ ] Ollama integration
- [ ] Document OCR processing
- [ ] Vector embeddings
- [ ] Semantic search
- [ ] AI-powered drafting

### Phase 3: Production Ready
- [ ] Docker deployment
- [ ] CI/CD pipeline
- [ ] Performance optimization
- [ ] Security audit
- [ ] Documentation complete

---

**Note:** This is a development version. Do not use with real client data until security audit is complete.