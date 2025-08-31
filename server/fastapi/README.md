# Solicitor Brain FastAPI Service

A comprehensive legal case management API with AI capabilities, built with FastAPI, SQLAlchemy, and PostgreSQL with pgvector for vector search.

## Features

- **Authentication**: JWT-based authentication with role-based access control
- **Case Management**: Create, read, update, delete legal cases
- **Document Management**: Upload, process, and search legal documents with AI
- **Vector Search**: Semantic search using pgvector and Ollama embeddings
- **AI Chat**: Legal assistant powered by Ollama (llama3.2)
- **Document Analysis**: AI-powered document analysis and risk assessment
- **Draft Generation**: Automated legal document drafting
- **OCR Support**: PDF parsing and OCR for scanned documents
- **Health Checks**: Comprehensive health monitoring endpoints

## Prerequisites

- Python 3.8+
- PostgreSQL 14+ with pgvector extension
- Ollama running locally with models:
  - `llama3.2:latest` (chat)
  - `nomic-embed-text:latest` (embeddings)
  - `codellama:13b` (code generation)

## Installation

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Initialize database:**
   ```bash
   python init_admin.py
   ```

## Configuration

### Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `SECRET_KEY`: JWT secret key (change in production!)
- `OLLAMA_HOST`: Ollama service URL (default: http://localhost:11434)
- `UPLOAD_DIR`: Directory for file uploads
- `CORS_ORIGINS`: Allowed CORS origins

See `.env.example` for complete configuration options.

## Running the Service

### Development
```bash
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

### Production
```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --workers 4
```

## API Documentation

Once running, visit:
- **Interactive API docs**: http://localhost:8000/docs
- **ReDoc documentation**: http://localhost:8000/redoc
- **Health check**: http://localhost:8000/healthz

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/token` - Login and get access token

### Users
- `GET /users/me` - Get current user info
- `PUT /users/me` - Update current user

### Cases
- `GET /cases/` - List cases
- `POST /cases/` - Create case
- `GET /cases/{id}` - Get case details
- `PUT /cases/{id}` - Update case
- `DELETE /cases/{id}` - Delete case

### Documents
- `POST /documents/upload` - Upload document
- `GET /documents/case/{case_id}` - Get case documents
- `POST /documents/search` - Vector search documents
- `POST /documents/{id}/analyze` - AI document analysis

### Chat
- `POST /chat/` - Chat with AI assistant
- `GET /chat/history` - Get chat history

### Drafts
- `POST /drafts/` - Create draft
- `POST /drafts/generate` - Generate draft with AI
- `GET /drafts/case/{case_id}` - Get case drafts

### Health
- `GET /health/` - Basic health check
- `GET /health/readiness` - Readiness check with dependencies
- `GET /health/status` - Detailed service status

## Authentication

All protected endpoints require a Bearer token:
```bash
Authorization: Bearer <your-jwt-token>
```

Get a token by calling `/auth/token` with username/password.

## Example Usage

### 1. Register and Login
```bash
# Register
curl -X POST "http://localhost:8000/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username": "lawyer1", "email": "lawyer1@firm.com", "password": "secure123"}'

# Login
curl -X POST "http://localhost:8000/auth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=lawyer1&password=secure123"
```

### 2. Create a Case
```bash
curl -X POST "http://localhost:8000/cases/" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Contract Dispute", "description": "Client contract issue", "risk_level": "medium"}'
```

### 3. Upload Document
```bash
curl -X POST "http://localhost:8000/documents/upload" \
  -H "Authorization: Bearer <token>" \
  -F "file=@contract.pdf" \
  -F "case_id=<case-uuid>"
```

### 4. Search Documents
```bash
curl -X POST "http://localhost:8000/documents/search" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"query": "breach of contract", "limit": 5}'
```

### 5. Chat with AI
```bash
curl -X POST "http://localhost:8000/chat/" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"message": "What are the key elements of a valid contract?", "case_id": "<case-uuid>"}'
```

## Database Migrations

Using Alembic for database migrations:

```bash
# Generate migration
cd infra/migrations
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Downgrade
alembic downgrade -1
```

## Testing

Run integration tests:
```bash
cd tests
python -m pytest integration/test_search.py -v
```

## Development Notes

### Adding New Models

1. Create model in `models/`
2. Add to `models/__init__.py`
3. Create corresponding schema in `schemas/`
4. Generate migration: `alembic revision --autogenerate`
5. Apply migration: `alembic upgrade head`

### AI Service Integration

The service integrates with Ollama for:
- **Embeddings**: `nomic-embed-text` for document vectorization
- **Chat**: `llama3.2` for legal assistance
- **Analysis**: Document analysis and risk assessment
- **Generation**: Legal document drafting

### File Processing

Supported file types:
- **PDF**: Text extraction using PyPDF2
- **Images**: OCR using Tesseract
- **Text**: Direct text processing

## Production Deployment

### Docker
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Environment Setup
- Use environment-specific `.env` files
- Configure proper database connections
- Set up log aggregation
- Configure reverse proxy (nginx)
- Use HTTPS in production

## Monitoring

The service provides health check endpoints for monitoring:
- `/healthz` - Basic liveness check
- `/health/readiness` - Database and Ollama connectivity
- `/health/status` - Detailed service information

## Security Considerations

- JWT tokens expire after 30 minutes (configurable)
- Passwords are hashed using bcrypt
- File uploads are validated and size-limited
- CORS origins are configurable
- SQL injection protection via SQLAlchemy
- Input validation using Pydantic

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check PostgreSQL is running
   - Verify connection string in `.env`
   - Ensure pgvector extension is installed

2. **Ollama Service Unavailable**
   - Start Ollama: `ollama serve`
   - Pull required models: `ollama pull llama3.2`
   - Check `OLLAMA_HOST` in configuration

3. **File Upload Issues**
   - Check `UPLOAD_DIR` permissions
   - Verify file size limits
   - Install tesseract for OCR: `apt-get install tesseract-ocr`

4. **Import Errors**
   - Verify all dependencies installed
   - Check Python path configuration

## License

This project is proprietary software for legal case management.