"""
Main API router that includes all endpoint routers
"""

from fastapi import APIRouter
from app.api.endpoints import documents, search

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(documents.router, tags=["documents"])
api_router.include_router(search.router, tags=["search"])