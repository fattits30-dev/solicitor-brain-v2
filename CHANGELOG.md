# Changelog

All notable changes to Solicitor Brain v2 will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- **CRITICAL**: Removed vulnerable auth-standalone.ts that logged sensitive data (passwords, tokens)
- **CRITICAL**: Eliminated hardcoded credential acceptance ("password123")
- Added comprehensive security test suite (13 tests) covering:
  - Password hashing security with bcrypt
  - JWT token generation and validation
  - SQL injection protection
  - Prevention of information leakage
  - Session security with proper expiration
- Integrated Trivy vulnerability scanner in CI pipeline
- Added TruffleHog secret detection to prevent credential leaks
- Implemented policy.yml for automated quality gates and security standards
- Fixed broken authentication middleware imports

### Added

- Initial setup of GitHub Actions workflows
- Dependabot configuration for automated dependency updates
- Code scanning with CodeQL
- Issue templates for bug reports and feature requests
- Contributing guidelines and code of conduct
- Security policy and vulnerability reporting process
- GitHub Pages deployment workflow
- Automated release workflow
- Comprehensive policy enforcement framework (policy.yml)
- Security scanning in CI/CD pipeline

### Changed

- Updated README.md with comprehensive project information
- Enhanced .gitignore with additional patterns
- Standardized authentication to use secure AuthService with bcrypt + JWT
- CI workflow enhanced with security scanning and E2E testing

### Fixed

- Fixed lint errors in documentation files
- Fixed Jest stripAnsi dependency conflict preventing test execution
- Fixed broken auth middleware imports that prevented server startup
- Fixed TypeScript errors in auth routes
- Added missing email field to Drizzle users schema
- Synchronized database schema with actual PostgreSQL structure

## [2.0.0] - 2025-01-01

### Features

- Complete rewrite of Solicitor Brain with modern architecture
- React + TypeScript frontend with shadcn/ui components
- Express.js backend with TypeScript
- PostgreSQL database with pgvector for AI features
- Ollama integration for local LLM processing
- Tesseract.js for OCR functionality
- Comprehensive authentication and authorization system
- Role-based access control (RBAC)
- Multi-factor authentication (MFA)
- Trauma-informed UX design
- WCAG 2.2 AA accessibility compliance
- Privacy-first data handling with automatic redaction
- Comprehensive audit trail with 7-year retention
- Docker containerization for easy deployment
- Jest and Playwright testing frameworks
- API documentation and developer tools

### Security

- End-to-end encryption for sensitive data
- GDPR and UK data protection compliance
- Secure file upload and storage
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CSRF protection

### Performance

- Optimized database queries
- Lazy loading for components
- Caching strategies for improved performance
- Background job processing

### Documentation

- Comprehensive README with setup instructions
- API documentation
- User guides and tutorials
- Developer documentation

---

## Types of changes

- `Added` for new features
- `Changed` for changes in existing functionality
- `Deprecated` for soon-to-be removed features
- `Removed` for now removed features
- `Fixed` for any bug fixes
- `Security` in case of vulnerabilities

## Versioning

This project uses [Semantic Versioning](https://semver.org/).

Given a version number MAJOR.MINOR.PATCH, increment the:

- MAJOR version when you make incompatible API changes
- MINOR version when you add functionality in a backwards compatible manner
- PATCH version when you make backwards compatible bug fixes

Additional labels for pre-release and build metadata are available as extensions to the MAJOR.MINOR.PATCH format.
