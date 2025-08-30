.PHONY: help install dev build test clean docker-up docker-down docker-reset db-setup db-reset db-seed setup

# Default target
help:
	@echo "Solicitor Brain v2 - Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make setup        - Complete project setup (install, docker, db)"
	@echo "  make install      - Install dependencies"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start development server"
	@echo "  make build        - Build for production"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-up    - Start Docker services"
	@echo "  make docker-down  - Stop Docker services"
	@echo "  make docker-reset - Reset Docker volumes and restart"
	@echo ""
	@echo "Database:"
	@echo "  make db-setup     - Generate migrations and push schema"
	@echo "  make db-seed      - Seed database with test data"
	@echo "  make db-reset     - Reset database (drops all tables)"
	@echo ""
	@echo "Testing:"
	@echo "  make test         - Run all tests"
	@echo "  make test-watch   - Run tests in watch mode"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean        - Clean build artifacts"
	@echo "  make check        - Run type checking"

# Complete setup
setup: install docker-up
	@echo "⏳ Waiting for services to start..."
	@sleep 10
	@make db-setup
	@make db-seed
	@echo "✅ Setup complete! Run 'make dev' to start the development server"

# Install dependencies
install:
	npm install

# Development server
dev:
	npm run dev

# Build for production
build:
	npm run build

# Docker commands
docker-up:
	docker-compose up -d
	@echo "✅ Docker services started"
	@echo "  PostgreSQL: localhost:5432"
	@echo "  Redis:      localhost:6379"
	@echo "  Ollama:     localhost:11434"

docker-down:
	docker-compose down

docker-reset:
	docker-compose down -v
	docker-compose up -d
	@echo "✅ Docker services reset"

# Database commands
db-setup:
	npm run db:generate
	npm run db:push
	@echo "✅ Database schema created"

db-seed:
	npm run db:seed

db-reset:
	npm run db:reset

# Testing
test:
	@echo "⚠️  Tests not yet implemented"
	# npm run test

test-watch:
	@echo "⚠️  Tests not yet implemented"
	# npm run test:watch

# Type checking
check:
	npm run check

# Clean build artifacts
clean:
	rm -rf dist/
	rm -rf .next/
	rm -rf node_modules/.vite/
	@echo "✅ Build artifacts cleaned"

# Development workflow shortcuts
restart: docker-down docker-up
	@sleep 5
	@make dev

fresh: clean install setup
	@echo "✅ Fresh installation complete!"