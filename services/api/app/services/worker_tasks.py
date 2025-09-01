"""
Background worker tasks for document processing
"""

import asyncio
from typing import Dict, Any, Optional, List
import structlog
from rq import get_current_job
from sqlalchemy.orm import Session
from sqlalchemy import select, update
import tempfile
import os
from pathlib import Path

from app.core.database import AsyncSessionLocal
from app.models.document import Document, DocumentChunk
from app.services.ocr import process_document_ocr, calculate_file_hash
from app.services.chunking import smart_chunk_document
from app.services.embeddings import generate_embeddings
from app.core.config import settings

logger = structlog.get_logger()


class TaskError(Exception):
    """Custom exception for task errors"""
    pass


def update_job_progress(progress: int, message: str = ""):
    """Update job progress in Redis"""
    job = get_current_job()
    if job:
        job.meta['progress'] = progress
        job.meta['message'] = message
        job.save_meta()


async def process_document_pipeline(document_id: str) -> Dict[str, Any]:
    """
    Complete document processing pipeline: OCR -> Chunking -> Embeddings
    
    Args:
        document_id: UUID of the document to process
        
    Returns:
        Dictionary with processing results and statistics
    """
    
    job = get_current_job()
    logger.info("Starting document processing pipeline", 
                document_id=document_id, 
                job_id=job.id if job else None)
    
    result = {
        "document_id": document_id,
        "status": "started",
        "steps_completed": [],
        "errors": [],
        "statistics": {}
    }
    
    try:
        # Get database session
        async with AsyncSessionLocal() as db:
            # Fetch document
            document = await db.get(Document, document_id)
            if not document:
                raise TaskError(f"Document not found: {document_id}")
            
            logger.info("Processing document", 
                       filename=document.filename,
                       file_path=document.file_path)
            
            # Step 1: OCR Processing
            update_job_progress(10, "Starting OCR processing...")
            ocr_result = await process_document_ocr_task(document, db)
            result["steps_completed"].append("ocr")
            result["statistics"]["ocr"] = ocr_result
            
            # Step 2: Document Chunking
            update_job_progress(40, "Chunking document...")
            chunking_result = await process_document_chunking_task(document, db)
            result["steps_completed"].append("chunking")
            result["statistics"]["chunking"] = chunking_result
            
            # Step 3: Generate Embeddings
            update_job_progress(70, "Generating embeddings...")
            embedding_result = await process_document_embeddings_task(document, db)
            result["steps_completed"].append("embeddings")
            result["statistics"]["embeddings"] = embedding_result
            
            # Step 4: Finalize
            update_job_progress(90, "Finalizing...")
            await finalize_document_processing(document, db)
            result["steps_completed"].append("finalized")
            
            update_job_progress(100, "Document processing completed")
            result["status"] = "completed"
            
            logger.info("Document processing pipeline completed", 
                       document_id=document_id,
                       steps=result["steps_completed"],
                       total_chunks=chunking_result.get("total_chunks", 0))
            
            return result
            
    except Exception as e:
        error_msg = f"Document processing failed: {str(e)}"
        logger.error(error_msg, 
                    document_id=document_id, 
                    error=str(e),
                    steps_completed=result["steps_completed"])
        
        result["status"] = "failed"
        result["errors"].append(error_msg)
        
        # Update document status
        try:
            async with AsyncSessionLocal() as db:
                await db.execute(
                    update(Document)
                    .where(Document.id == document_id)
                    .values(processing_error=error_msg)
                )
                await db.commit()
        except Exception as db_error:
            logger.error("Failed to update document error status", 
                        document_id=document_id, 
                        error=str(db_error))
        
        raise TaskError(error_msg)


async def process_document_ocr_task(document: Document, db: Session) -> Dict[str, Any]:
    """
    OCR processing task with error handling and retries
    """
    
    logger.info("Starting OCR processing", document_id=str(document.id))
    
    try:
        # Verify file exists
        if not os.path.exists(document.file_path):
            raise TaskError(f"File not found: {document.file_path}")
        
        # Calculate file hash for deduplication
        file_hash = await calculate_file_hash(document.file_path)
        
        # Process OCR
        text, metadata = await process_document_ocr(document.file_path, document.mime_type)
        
        if not text or len(text.strip()) < 10:
            raise TaskError("OCR produced no usable text")
        
        # Update document with OCR results
        document.ocr_text = text
        document.ocr_completed = True
        document.page_count = metadata.get("page_count", 1)
        document.file_hash = file_hash
        document.meta = {**(document.meta or {}), "ocr_metadata": metadata}
        
        await db.commit()
        
        result = {
            "text_length": len(text),
            "page_count": metadata.get("page_count", 1),
            "extraction_method": metadata.get("extraction_method"),
            "confidence": metadata.get("average_confidence"),
            "processing_errors": metadata.get("processing_errors", [])
        }
        
        logger.info("OCR processing completed", 
                   document_id=str(document.id),
                   **result)
        
        return result
        
    except Exception as e:
        error_msg = f"OCR processing failed: {str(e)}"
        logger.error(error_msg, document_id=str(document.id))
        
        # Update document with error
        document.processing_error = error_msg
        await db.commit()
        
        raise TaskError(error_msg)


async def process_document_chunking_task(document: Document, db: Session) -> Dict[str, Any]:
    """
    Document chunking task with metadata extraction
    """
    
    logger.info("Starting document chunking", document_id=str(document.id))
    
    try:
        if not document.ocr_text:
            raise TaskError("No OCR text available for chunking")
        
        # Get OCR metadata
        ocr_metadata = document.meta.get("ocr_metadata", {}) if document.meta else {}
        
        # Perform smart chunking based on document type
        chunks_data = await smart_chunk_document(
            document.ocr_text,
            document_type=document.document_type,
            ocr_metadata=ocr_metadata
        )
        
        if not chunks_data:
            raise TaskError("Chunking produced no results")
        
        # Delete existing chunks
        await db.execute(
            select(DocumentChunk).where(DocumentChunk.document_id == document.id)
        )
        existing_chunks = await db.execute(
            select(DocumentChunk).where(DocumentChunk.document_id == document.id)
        )
        for chunk in existing_chunks.scalars():
            await db.delete(chunk)
        
        # Create new chunks
        chunk_objects = []
        for chunk_data in chunks_data:
            chunk = DocumentChunk(
                document_id=document.id,
                chunk_index=chunk_data["chunk_index"],
                text=chunk_data["text"],
                tokens=chunk_data["token_count"],
                page_number=None,  # TODO: Extract from OCR metadata if available
                meta=chunk_data
            )
            chunk_objects.append(chunk)
            db.add(chunk)
        
        # Update document
        document.chunks_generated = len(chunks_data)
        document.processed = True
        
        await db.commit()
        
        result = {
            "total_chunks": len(chunks_data),
            "avg_tokens": sum(c["token_count"] for c in chunks_data) / len(chunks_data),
            "avg_chars": sum(c["char_count"] for c in chunks_data) / len(chunks_data),
            "chunks_with_headings": sum(1 for c in chunks_data if c.get("has_heading")),
            "legal_references_found": sum(len(c.get("legal_references", [])) for c in chunks_data)
        }
        
        logger.info("Document chunking completed", 
                   document_id=str(document.id),
                   **result)
        
        return result
        
    except Exception as e:
        error_msg = f"Chunking failed: {str(e)}"
        logger.error(error_msg, document_id=str(document.id))
        
        document.processing_error = error_msg
        await db.commit()
        
        raise TaskError(error_msg)


async def process_document_embeddings_task(document: Document, db: Session) -> Dict[str, Any]:
    """
    Generate embeddings for document chunks
    """
    
    logger.info("Starting embedding generation", document_id=str(document.id))
    
    try:
        # Get chunks
        chunks_result = await db.execute(
            select(DocumentChunk)
            .where(DocumentChunk.document_id == document.id)
            .order_by(DocumentChunk.chunk_index)
        )
        chunks = chunks_result.scalars().all()
        
        if not chunks:
            raise TaskError("No chunks found for embedding generation")
        
        # Extract texts
        texts = [chunk.text for chunk in chunks]
        
        # Generate embeddings
        embeddings = await generate_embeddings(texts, use_cache=True, batch_size=16)
        
        if len(embeddings) != len(chunks):
            raise TaskError(f"Embedding count mismatch: {len(embeddings)} vs {len(chunks)}")
        
        # Update chunks with embeddings
        updated_chunks = 0
        for chunk, embedding in zip(chunks, embeddings):
            chunk.embedding = embedding.tolist()  # Store as JSON array
            updated_chunks += 1
        
        await db.commit()
        
        result = {
            "chunks_embedded": updated_chunks,
            "embedding_dimension": len(embeddings[0]) if embeddings else 0,
            "total_vectors": len(embeddings)
        }
        
        logger.info("Embedding generation completed", 
                   document_id=str(document.id),
                   **result)
        
        return result
        
    except Exception as e:
        error_msg = f"Embedding generation failed: {str(e)}"
        logger.error(error_msg, document_id=str(document.id))
        
        document.processing_error = error_msg
        await db.commit()
        
        raise TaskError(error_msg)


async def finalize_document_processing(document: Document, db: Session) -> None:
    """
    Finalize document processing - update status and metadata
    """
    
    try:
        from datetime import datetime
        
        # Update final status
        document.processed = True
        document.processing_error = None
        document.processed_at = datetime.utcnow()
        
        # Update metadata with processing completion
        if not document.meta:
            document.meta = {}
        
        document.meta["processing_completed_at"] = datetime.utcnow().isoformat()
        document.meta["pipeline_version"] = "1.0"
        
        await db.commit()
        
        logger.info("Document processing finalized", document_id=str(document.id))
        
    except Exception as e:
        logger.error("Failed to finalize document processing", 
                    document_id=str(document.id), 
                    error=str(e))
        raise


# RQ job wrapper functions (these are called by the queue)
def process_document_job(document_id: str) -> Dict[str, Any]:
    """RQ job wrapper for document processing"""
    return asyncio.run(process_document_pipeline(document_id))


def process_ocr_job(document_id: str) -> Dict[str, Any]:
    """RQ job wrapper for OCR processing only"""
    async def _process():
        async with AsyncSessionLocal() as db:
            document = await db.get(Document, document_id)
            if not document:
                raise TaskError(f"Document not found: {document_id}")
            return await process_document_ocr_task(document, db)
    
    return asyncio.run(_process())


def process_chunking_job(document_id: str) -> Dict[str, Any]:
    """RQ job wrapper for chunking processing only"""
    async def _process():
        async with AsyncSessionLocal() as db:
            document = await db.get(Document, document_id)
            if not document:
                raise TaskError(f"Document not found: {document_id}")
            return await process_document_chunking_task(document, db)
    
    return asyncio.run(_process())


def process_embeddings_job(document_id: str) -> Dict[str, Any]:
    """RQ job wrapper for embeddings processing only"""
    async def _process():
        async with AsyncSessionLocal() as db:
            document = await db.get(Document, document_id)
            if not document:
                raise TaskError(f"Document not found: {document_id}")
            return await process_document_embeddings_task(document, db)
    
    return asyncio.run(_process())