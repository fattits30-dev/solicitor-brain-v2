from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Dict, Any

from database import get_db
from services.ollama_service import ollama_service

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("/")
async def health_check():
    """Basic health check endpoint."""
    return {"status": "ok", "message": "API is running"}


@router.get("/readiness")
async def readiness_check(db: AsyncSession = Depends(get_db)):
    """Readiness check with database and external service connectivity."""
    health_status = {
        "status": "healthy",
        "checks": {}
    }
    
    overall_healthy = True
    
    # Database check
    try:
        await db.execute(text("SELECT 1"))
        health_status["checks"]["database"] = {
            "status": "healthy",
            "message": "Database connection successful"
        }
    except Exception as e:
        overall_healthy = False
        health_status["checks"]["database"] = {
            "status": "unhealthy",
            "message": f"Database connection failed: {str(e)}"
        }
    
    # Ollama service check
    try:
        ollama_healthy = await ollama_service.health_check()
        if ollama_healthy:
            health_status["checks"]["ollama"] = {
                "status": "healthy",
                "message": "Ollama service is available"
            }
        else:
            overall_healthy = False
            health_status["checks"]["ollama"] = {
                "status": "unhealthy",
                "message": "Ollama service is not responding"
            }
    except Exception as e:
        overall_healthy = False
        health_status["checks"]["ollama"] = {
            "status": "unhealthy",
            "message": f"Ollama service check failed: {str(e)}"
        }
    
    # Update overall status
    if not overall_healthy:
        health_status["status"] = "unhealthy"
    
    # Return appropriate status code
    status_code = 200 if overall_healthy else 503
    
    if status_code == 503:
        raise HTTPException(status_code=503, detail=health_status)
    
    return health_status


@router.get("/liveness")
async def liveness_check():
    """Liveness probe - simple check to see if the service is alive."""
    return {"status": "alive", "timestamp": "2024-01-01T00:00:00Z"}


@router.get("/status")
async def detailed_status():
    """Detailed status information about the service."""
    import sys
    import os
    from datetime import datetime
    
    return {
        "service": "solicitor-brain-api",
        "version": "1.0.0",
        "environment": os.getenv("ENVIRONMENT", "development"),
        "python_version": sys.version,
        "timestamp": datetime.utcnow().isoformat(),
        "uptime": "Service is running"
    }