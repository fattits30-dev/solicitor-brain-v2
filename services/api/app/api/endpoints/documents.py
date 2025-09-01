"""
Document upload and management endpoints with background processing
"""

import os
import hashlib
import shutil
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
import structlog

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
import aiofiles

from app.core.database import get_db
from app.core.config import settings
from app.models.document import Document, DocumentChunk
from app.models.case import Case
from app.models.user import User
from app.services.ocr import calculate_file_hash
from app.services.task_manager import task_manager
from app.core.deps import get_current_user

logger = structlog.get_logger()
router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/upload")
async def upload_document(
    *,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    file: UploadFile = File(...),
    case_id: UUID = Form(...),
    document_type: Optional[str] = Form(None),
    document_date: Optional[datetime] = Form(None),
    priority: Optional[str] = Form("normal")
) -> Dict[str, Any]:
    """
    Upload a document for a case with background processing
    
    - Validates file size and type
    - Checks for duplicates using file hash
    - Saves file to disk securely
    - Creates document record
    - Enqueues background processing pipeline
    - Returns job information for status tracking
    """
    
    logger.info("Starting document upload", 
                filename=file.filename, 
                case_id=str(case_id),
                user_id=str(current_user.id))
    
    # Validate file size
    if file.size and file.size > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413, 
            detail=f"File too large. Maximum size: {settings.MAX_FILE_SIZE // (1024*1024)}MB"
        )
    
    # Validate file extension
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"File type not allowed. Allowed types: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        )
    
    # Verify case exists and user has access
    case = await db.get(Case, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # TODO: Add case access validation based on user role
    
    try:
        # Create upload directory if it doesn't exist
        upload_dir = os.path.join(settings.UPLOAD_DIR, str(case_id))
        os.makedirs(upload_dir, exist_ok=True)
        
        # Save file temporarily to calculate hash
        temp_filename = f"temp_{datetime.utcnow().isoformat()}_{file.filename}"
        temp_path = os.path.join(upload_dir, temp_filename)
        
        # Save file content
        with open(temp_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Calculate file hash for deduplication
        file_hash = await calculate_file_hash(temp_path)
        
        # Check for duplicate in the same case
        existing = await db.execute(
            select(Document).where(
                and_(
                    Document.file_hash == file_hash,
                    Document.case_id == case_id
                )
            )
        )
        existing_doc = existing.scalar_one_or_none()
        
        if existing_doc:
            # Remove temp file and return existing document info
            os.remove(temp_path)
            logger.info("Duplicate document detected", 
                       existing_id=str(existing_doc.id),
                       file_hash=file_hash)
            
            return {
                "message": "Document already exists",
                "document_id": existing_doc.id,
                "duplicate": True,
                "existing_filename": existing_doc.filename
            }
        
        # Generate unique filename using hash
        unique_filename = f"{file_hash[:16]}{file_ext}"
        final_path = os.path.join(upload_dir, unique_filename)
        
        # Move file to final location
        os.rename(temp_path, final_path)
        
        # Create document record
        document = Document(
            case_id=case_id,
            filename=file.filename,
            file_path=final_path,
            mime_type=file.content_type or "application/octet-stream",
            file_size=os.path.getsize(final_path),
            file_hash=file_hash,
            document_type=document_type,
            document_date=document_date,
            uploaded_by_id=current_user.id,
            title=os.path.splitext(file.filename)[0],
            language="en"  # TODO: Add language detection
        )
        
        db.add(document)
        await db.commit()
        await db.refresh(document)
        
        # Enqueue background processing using task manager
        job_info = task_manager.enqueue_document_processing(
            document_id=str(document.id),
            priority=priority
        )
        
        logger.info("Document uploaded and queued for processing", 
                   document_id=str(document.id),
                   job_id=job_info["job_id"],
                   filename=file.filename)
        
        return {
            "message": "Document uploaded and queued for processing",
            "document_id": document.id,
            "filename": file.filename,
            "duplicate": False,
            "job_id": job_info["job_id"],
            "processing_status": "queued",
            "queue_position": job_info.get("queue_position"),
            "estimated_start": job_info.get("estimated_start")
        }
        
    except Exception as e:
        # Clean up temp file if it exists
        if 'temp_path' in locals() and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except:
                pass
        
        logger.error("Document upload failed", 
                    filename=file.filename,
                    case_id=str(case_id),
                    error=str(e))
        
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload document: {str(e)}"
        )


@router.get("/{document_id}")
async def get_document(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get document metadata and processing status"""
    
    document = await db.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # TODO: Add access control - verify user can access this document
    
    # Get processing jobs from task manager
    jobs = task_manager.get_document_jobs(str(document_id))
    
    # Get chunk count
    chunks_result = await db.execute(
        select(DocumentChunk).where(
            DocumentChunk.document_id == document_id
        )
    )
    chunks = chunks_result.scalars().all()
    
    # Determine overall processing status
    processing_status = "not_started"
    if document.processed:
        processing_status = "completed"
    elif document.processing_error:
        processing_status = "failed"
    elif document.ocr_completed:
        processing_status = "processing"
    elif jobs:
        latest_job = jobs[0] if jobs else None
        if latest_job:
            if latest_job["status"] in ["queued", "started"]:
                processing_status = "processing"
            elif latest_job["status"] == "failed":
                processing_status = "failed"
    
    return {
        "document": {
            "id": document.id,
            "filename": document.filename,
            "mime_type": document.mime_type,
            "file_size": document.file_size,
            "document_type": document.document_type,
            "title": document.title,
            "document_date": document.document_date,
            "language": document.language,
            "file_hash": document.file_hash,
            "ocr_completed": document.ocr_completed,
            "processed": document.processed,
            "processing_status": processing_status,
            "chunks_generated": len(chunks),
            "page_count": document.page_count,
            "created_at": document.created_at,
            "updated_at": document.updated_at,
            "processed_at": document.processed_at,
            "processing_error": document.processing_error,
            "uploaded_by_id": document.uploaded_by_id,
            "case_id": document.case_id
        },
        "jobs": jobs,
        "chunks_summary": {
            "total_chunks": len(chunks),
            "chunks_with_embeddings": sum(1 for c in chunks if c.embedding is not None)
        } if chunks else None
    }


@router.get("/case/{case_id}")
async def list_case_documents(
    case_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    processed_only: bool = False,
    limit: int = 50,
    offset: int = 0
) -> Dict[str, Any]:
    """List all documents for a case with pagination"""
    
    # TODO: Add case access validation
    
    query = select(Document).where(Document.case_id == case_id)
    
    if processed_only:
        query = query.where(Document.processed == True)
    
    # Add pagination
    query = query.order_by(Document.created_at.desc()).limit(limit).offset(offset)
    
    result = await db.execute(query)
    documents = result.scalars().all()
    
    # Get total count for pagination
    count_query = select(Document).where(Document.case_id == case_id)
    if processed_only:
        count_query = count_query.where(Document.processed == True)
    
    total_result = await db.execute(count_query)
    total_documents = len(total_result.scalars().all())
    
    return {
        "total": total_documents,
        "count": len(documents),
        "limit": limit,
        "offset": offset,
        "has_more": offset + len(documents) < total_documents,
        "documents": [
            {
                "id": doc.id,
                "filename": doc.filename,
                "mime_type": doc.mime_type,
                "file_size": doc.file_size,
                "document_type": doc.document_type,
                "title": doc.title,
                "ocr_completed": doc.ocr_completed,
                "processed": doc.processed,
                "chunks_generated": doc.chunks_generated,
                "page_count": doc.page_count,
                "created_at": doc.created_at,
                "processing_error": doc.processing_error
            }
            for doc in documents
        ]
    }


@router.delete("/{document_id}")
async def delete_document(
    document_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Delete a document and its associated data"""
    
    document = await db.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Delete file from disk
    if os.path.exists(document.file_path):
        os.remove(document.file_path)
    
    # Delete from database (chunks will cascade delete)
    await db.delete(document)
    await db.commit()
    
    return {"message": "Document deleted successfully"}

