# Contributing to Solicitor Brain v2

Thank you for your interest in contributing to Solicitor Brain v2! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/solicitor-brain-v2.git`
3. Install dependencies: `npm install`
4. Set up the development environment: `make setup`
5. Start development: `make dev`

### Branching Strategy

- `main`: Production-ready code
- `develop`: Latest development changes
- `feature/*`: New features
- `bugfix/*`: Bug fixes
- `hotfix/*`: Critical fixes for production

## 📝 Development Guidelines

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
- Aim for 80% coverage minimum

### Security

- Never expose sensitive data in logs
- Always sanitize user inputs
- Use parameterized queries for database operations
- Implement proper authentication checks
- Follow OWASP security guidelines

### Commit Messages

Use conventional commits:

```text
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## 🔧 Pull Request Process

1. Create a feature branch from `develop`
2. Make your changes
3. Write/update tests
4. Ensure all tests pass
5. Update documentation if needed
6. Create a pull request to `develop`
7. Wait for review and approval

### PR Checklist

- [ ] Tests pass
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] Security review completed
- [ ] Performance impact assessed

## 🐛 Reporting Issues

When reporting bugs, please include:

- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details (OS, Node version, etc.)
- Screenshots/logs if applicable

## 📚 Documentation

- Update README.md for new features
- Add JSDoc comments for new functions
- Update API documentation
- Include examples for complex features

## 🤝 Code of Conduct

This project follows our Code of Conduct. By participating, you agree to uphold these standards.

## 📞 Getting Help

- Check existing issues and documentation first
- Create a new issue for bugs or feature requests
- Use GitHub Discussions for questions

Thank you for contributing to Solicitor Brain v2! 🎉
