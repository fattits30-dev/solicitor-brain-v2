from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import uuid

from database import get_db
from schemas.document import (
    DocumentResponse, 
    DocumentAnalysis, 
    DocumentSearchResult,
    SearchRequest
)
from utils.auth import get_current_active_user
from models.user import User
from services.file_service import file_service
from services.document_service import document_service
from services.ollama_service import ollama_service

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    case_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Upload and process a document."""
    try:
        # Process the uploaded file
        file_data = await file_service.process_file(file)
        
        # Create document in database
        document = await document_service.create_document(
            db=db,
            case_id=str(case_id),
            filename=file_data["metadata"]["original_filename"],
            content=file_data["content"],
            metadata=file_data["metadata"],
            user_id=str(current_user.id)
        )
        
        return DocumentResponse.from_orm(document)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/case/{case_id}", response_model=List[DocumentResponse])
async def get_case_documents(
    case_id: uuid.UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all documents for a case."""
    try:
        documents = await document_service.get_documents_by_case(
            db=db,
            case_id=str(case_id),
            skip=skip,
            limit=limit
        )
        
        return [DocumentResponse.from_orm(doc) for doc in documents]
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific document."""
    try:
        document = await document_service.get_document(db, str(document_id))
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return DocumentResponse.from_orm(document)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search", response_model=List[DocumentSearchResult])
async def search_documents(
    search_request: SearchRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Search documents using vector similarity."""
    try:
        results = await document_service.vector_search(
            db=db,
            query=search_request.query,
            case_id=str(search_request.case_id) if search_request.case_id else None,
            limit=search_request.limit,
            threshold=search_request.threshold
        )
        
        return results
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{document_id}/analyze", response_model=DocumentAnalysis)
async def analyze_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Analyze a document using AI."""
    try:
        # Get the document
        document = await document_service.get_document(db, str(document_id))
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Analyze the document
        analysis_data = await ollama_service.analyze_document(document.content)
        
        # Create analysis response
        analysis = DocumentAnalysis(
            analysis=analysis_data.get("summary", ""),
            key_parties=analysis_data.get("key_parties", []),
            important_dates=analysis_data.get("important_dates", []),
            legal_issues=analysis_data.get("legal_issues", []),
            risk_assessment=analysis_data.get("risk_assessment", "medium"),
            recommended_actions=analysis_data.get("recommended_actions", []),
            timestamp=document.uploaded_at
        )
        
        return analysis
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{document_id}")
async def delete_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a document."""
    try:
        success = await document_service.delete_document(db, str(document_id))
        
        if not success:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return {"message": "Document deleted successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))