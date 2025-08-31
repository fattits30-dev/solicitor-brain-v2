"""
Document and chunk models for RAG pipeline
"""

from sqlalchemy import Column, String, Text, Integer, ForeignKey, DateTime, Boolean, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from datetime import datetime
import uuid

from app.core.database import Base


class Document(Base):
    """Document metadata and storage"""
    
    __tablename__ = "documents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    
    # File information
    filename = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)
    mime_type = Column(String(100), nullable=False)
    file_size = Column(Integer, nullable=False)  # In bytes
    file_hash = Column(String(64), nullable=False, index=True)  # SHA256 for deduplication
    
    # Document metadata
    title = Column(String(500), nullable=True)
    document_type = Column(String(100), nullable=True)  # e.g., "letter", "report", "evidence"
    document_date = Column(DateTime, nullable=True)
    
    # OCR and processing
    ocr_completed = Column(Boolean, default=False, nullable=False)
    ocr_text = Column(Text, nullable=True)
    page_count = Column(Integer, nullable=True)
    language = Column(String(10), default="en", nullable=False)
    
    # Processing status
    processed = Column(Boolean, default=False, nullable=False)
    processing_error = Column(Text, nullable=True)
    chunks_generated = Column(Integer, default=0, nullable=False)
    
    # Metadata
    meta = Column(JSONB, nullable=True, default=dict)
    tags = Column(JSONB, nullable=True, default=list)
    
    # Relationships
    uploaded_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    uploaded_by = relationship("User", back_populates="documents")
    case = relationship("Case", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    processed_at = Column(DateTime, nullable=True)
    
    def __repr__(self):
        return f"<Document {self.filename} for Case {self.case_id}>"


class DocumentChunk(Base):
    """Document chunks with embeddings for semantic search"""
    
    __tablename__ = "document_chunks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False)
    
    # Chunk information
    chunk_index = Column(Integer, nullable=False)  # Order within document
    text = Column(Text, nullable=False)
    tokens = Column(Integer, nullable=False)
    
    # Location in document
    page_number = Column(Integer, nullable=True)
    page_start = Column(Integer, nullable=True)  # Character position
    page_end = Column(Integer, nullable=True)
    
    # Embedding for semantic search
    embedding = Column(Vector(384), nullable=True)  # Dimension matches model
    
    # Metadata
    meta = Column(JSONB, nullable=True, default=dict)
    heading = Column(String(500), nullable=True)  # Section heading if available
    
    # Search optimization
    relevance_score = Column(Float, nullable=True)  # Can be updated based on usage
    
    # Relationships
    document = relationship("Document", back_populates="chunks")
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    def __repr__(self):
        return f"<DocumentChunk {self.document_id}:{self.chunk_index}>"