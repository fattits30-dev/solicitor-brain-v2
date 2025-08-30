# Overview

This is a **Solicitor Brain** application - a trauma-informed, privacy-focused legal case management system with AI-powered assistance for UK solicitors. The application provides case management, document processing with OCR, AI-powered search and drafting capabilities, and comprehensive audit trails with automatic PII redaction.

The system is built as a full-stack application with a React frontend and Express.js backend, using PostgreSQL for data storage and designed to integrate with local LLMs via Ollama for AI functionality.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript, using Vite for build tooling
- **Routing**: Wouter for client-side routing with pages for Dashboard, Cases, Upload, Search, Drafts, Activity, Audit, and Settings
- **UI Framework**: Tailwind CSS with shadcn/ui component library providing accessible, consistent design system
- **State Management**: TanStack Query for server state management with optimistic updates and caching
- **Forms**: React Hook Form with Zod validation for type-safe form handling

## Backend Architecture
- **Framework**: Express.js with TypeScript for RESTful API endpoints
- **Database ORM**: Drizzle ORM with PostgreSQL, configured for Neon serverless database
- **Schema Design**: Comprehensive legal case management schema including cases, persons, documents, events, drafts, audit logs, consents, and embeddings
- **API Structure**: RESTful endpoints for CRUD operations on cases, documents, events, and drafts with proper validation

## Data Storage Solutions
- **Primary Database**: PostgreSQL with vector extension (pgvector) for AI embeddings and semantic search
- **Connection**: Neon serverless PostgreSQL with connection pooling
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Data Models**: Structured entities for legal case management with proper relationships and audit trails

## Authentication and Authorization
- **User System**: Basic user authentication with roles (solicitor as default)
- **Privacy Controls**: Built-in consent management system for AI processing
- **Audit Logging**: Comprehensive audit trail with automatic PII redaction capabilities

## AI and Document Processing Architecture
- **Document Processing**: OCR capabilities for document text extraction and indexing
- **Vector Search**: pgvector integration for semantic search across case documents
- **AI Integration**: Designed for local LLM integration via Ollama HTTP API
- **Embeddings**: Document chunking and vector embedding storage for RAG (Retrieval Augmented Generation)

## Development and Build Tools
- **TypeScript Configuration**: Strict TypeScript setup with path mapping for clean imports
- **Build Pipeline**: Vite for frontend bundling, esbuild for backend compilation
- **Development Server**: Hot module replacement with Vite dev server integration
- **Code Quality**: ESLint/Prettier integration with shadcn/ui component standards

## Privacy and Compliance Features
- **Trauma-Informed Design**: WCAG 2.2 AA accessibility compliance with clear consent flows
- **Data Protection**: Automatic PII redaction in logs and audit trails
- **Consent Management**: Granular consent system for AI processing with revocation capabilities
- **Export Functionality**: Data portability features for user data export

# External Dependencies

## Core Framework Dependencies
- **@neondatabase/serverless**: Serverless PostgreSQL client for Neon database
- **drizzle-orm**: Type-safe ORM for PostgreSQL with schema management
- **@tanstack/react-query**: Server state management and caching
- **wouter**: Lightweight React router for client-side navigation

## UI and Styling
- **@radix-ui/***: Accessible UI primitives for form controls, dialogs, and interactive components
- **tailwindcss**: Utility-first CSS framework for responsive design
- **class-variance-authority**: Type-safe component variant management
- **lucide-react**: Modern icon library for consistent iconography

## Development Tools
- **vite**: Fast build tool and development server
- **typescript**: Static type checking and enhanced development experience
- **esbuild**: Fast JavaScript bundler for production builds
- **@replit/vite-plugin-runtime-error-modal**: Development error overlay integration

## Database and Validation
- **drizzle-zod**: Zod schema generation from Drizzle schemas
- **zod**: Runtime type validation and schema definition
- **connect-pg-simple**: PostgreSQL session store for Express sessions

## Planned Integrations
- **Ollama**: Local LLM integration for AI-powered legal assistance
- **pgvector**: Vector similarity search for document embeddings
- **OCR Libraries**: Document text extraction capabilities
- **Redis**: Caching and session management (referenced in architecture docs)