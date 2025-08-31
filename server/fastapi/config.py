import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://postgres:development_secure_2024@localhost:5432/solicitor_brain_v2"
    
    # JWT
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # Ollama
    ollama_host: str = "http://localhost:11434"
    embedding_model: str = "nomic-embed-text:latest"
    chat_model: str = "llama3.2:latest"
    code_model: str = "codellama:13b"
    
    # File upload
    max_file_size: int = 10 * 1024 * 1024  # 10MB
    upload_dir: str = "/home/mine/ai/claude-home/projects/solicitor-brain-v2/uploads"
    
    # CORS
    cors_origins: list = ["http://localhost:3000", "http://localhost:5173"]
    
    # Logging
    log_level: str = "INFO"
    
    class Config:
        env_file = ".env"
        env_file_encoding = 'utf-8'


settings = Settings()