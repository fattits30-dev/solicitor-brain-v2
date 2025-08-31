"""
Document upload and management endpoints
"""

import os
import hashlib
import shutil
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
import aiofiles

from app.core.database import get_db
from app.core.config import settings
from app.models.document import Document, DocumentChunk
from app.models.case import Case
from app.models.task import Task, TaskType, TaskStatus
from app.services.ocr import process_document_ocr
from app.services.chunking import chunk_document
from app.services.embeddings import generate_embeddings

router = APIRouter(prefix="/documents", tags=["documents"])


async def calculate_file_hash(file_path: str) -> str:
    """Calculate SHA256 hash of file"""
    sha256_hash = hashlib.sha256()
    async with aiofiles.open(file_path, "rb") as f:
        while chunk := await f.read(8192):
            sha256_hash.update(chunk)
    return sha256_hash.hexdigest()


@router.post("/upload")
async def upload_document(
    *,
    db: AsyncSession = Depends(get_db),
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    case_id: UUID = Form(...),
    uploaded_by_id: UUID = Form(...),
    document_type: Optional[str] = Form(None),
    document_date: Optional[datetime] = Form(None),
):
    """
    Upload a document for a case
    
    - Checks for duplicates using file hash
    - Saves file to disk
    - Creates document record
    - Queues background tasks for OCR and processing
    """
    
    # Verify case exists
    case = await db.get(Case, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Create upload directory if it doesn't exist
    upload_dir = os.path.join(settings.UPLOAD_DIR, str(case_id))
    os.makedirs(upload_dir, exist_ok=True)
    
    # Save file temporarily to calculate hash
    temp_path = os.path.join(upload_dir, f"temp_{file.filename}")
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Calculate file hash
    file_hash = await calculate_file_hash(temp_path)
    
    # Check for duplicate
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
        # Remove temp file and return existing document
        os.remove(temp_path)
        return {
            "message": "Document already exists",
            "document_id": existing_doc.id,
            "duplicate": True
        }
    
    # Generate unique filename
    file_ext = os.path.splitext(file.filename)[1]
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
        uploaded_by_id=uploaded_by_id,
        title=os.path.splitext(file.filename)[0],
        language="en"
    )
    
    db.add(document)
    await db.commit()
    await db.refresh(document)
    
    # Create OCR task
    ocr_task = Task(
        case_id=case_id,
        task_type=TaskType.OCR,
        status=TaskStatus.PENDING,
        priority=5,
        payload={
            "document_id": str(document.id),
            "file_path": final_path,
            "mime_type": file.content_type
        }
    )
    db.add(ocr_task)
    await db.commit()
    
    # Queue background processing
    background_tasks.add_task(
        process_document_pipeline,
        document_id=document.id,
        db=db
    )
    
    return {
        "message": "Document uploaded successfully",
        "document_id": document.id,
        "duplicate": False,
        "task_id": ocr_task.id
    }


@router.get("/{document_id}")
async def get_document(
    document_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get document metadata and processing status"""
    
    document = await db.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Get processing tasks
    tasks_result = await db.execute(
        select(Task).where(
            Task.payload["document_id"].astext == str(document_id)
        ).order_by(Task.created_at.desc())
    )
    tasks = tasks_result.scalars().all()
    
    # Get chunk count
    chunks_result = await db.execute(
        select(DocumentChunk).where(
            DocumentChunk.document_id == document_id
        )
    )
    chunks = chunks_result.scalars().all()
    
    return {
        "document": {
            "id": document.id,
            "filename": document.filename,
            "mime_type": document.mime_type,
            "file_size": document.file_size,
            "document_type": document.document_type,
            "ocr_completed": document.ocr_completed,
            "processed": document.processed,
            "chunks_generated": len(chunks),
            "created_at": document.created_at,
            "processing_error": document.processing_error
        },
        "tasks": [
            {
                "id": task.id,
                "type": task.task_type,
                "status": task.status,
                "progress": task.progress,
                "message": task.message,
                "error": task.error,
                "created_at": task.created_at
            }
            for task in tasks
        ]
    }


@router.get("/case/{case_id}")
async def list_case_documents(
    case_id: UUID,
    db: AsyncSession = Depends(get_db),
    processed_only: bool = False
):
    """List all documents for a case"""
    
    query = select(Document).where(Document.case_id == case_id)
    
    if processed_only:
        query = query.where(Document.processed == True)
    
    result = await db.execute(query.order_by(Document.created_at.desc()))
    documents = result.scalars().all()
    
    return {
        "count": len(documents),
        "documents": [
            {
                "id": doc.id,
                "filename": doc.filename,
                "mime_type": doc.mime_type,
                "file_size": doc.file_size,
                "document_type": doc.document_type,
                "ocr_completed": doc.ocr_completed,
                "processed": doc.processed,
                "chunks_generated": doc.chunks_generated,
                "created_at": doc.created_at
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


async def process_document_pipeline(document_id: UUID, db: AsyncSession):
    """
    Background task to process document through OCR and chunking pipeline
    """
    try:
        document = await db.get(Document, document_id)
        if not document:
            return
        
        # Step 1: OCR
        if not document.ocr_completed:
            ocr_text = await process_document_ocr(document.file_path, document.mime_type)
            document.ocr_text = ocr_text
            document.ocr_completed = True
            await db.commit()
        
        # Step 2: Chunking
        if document.ocr_text:
            chunks = await chunk_document(document.ocr_text)
            
            # Step 3: Generate embeddings for each chunk
            for idx, chunk_text in enumerate(chunks):
                embedding = await generate_embeddings(chunk_text)
                
                chunk = DocumentChunk(
                    document_id=document_id,
                    chunk_index=idx,
                    text=chunk_text,
                    tokens=len(chunk_text.split()),  # Simple token count
                    embedding=embedding
                )
                db.add(chunk)
            
            document.processed = True
            document.chunks_generated = len(chunks)
            document.processed_at = datetime.utcnow()
            await db.commit()
            
    except Exception as e:
        document.processing_error = str(e)
        await db.commit()