"""
Task model for background job processing
"""

from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Enum as SQLEnum, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.core.database import Base


class TaskType(str, enum.Enum):
    """Types of background tasks"""
    OCR = "ocr"
    CHUNK_DOCUMENT = "chunk_document"
    GENERATE_EMBEDDINGS = "generate_embeddings"
    GENERATE_DRAFT = "generate_draft"
    SEND_EMAIL = "send_email"
    EXPORT_DOCUMENT = "export_document"
    REDACT_DOCUMENT = "redact_document"


class TaskStatus(str, enum.Enum):
    """Task processing status"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Task(Base):
    """Background task queue and status tracking"""
    
    __tablename__ = "tasks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=True)
    
    # Task details
    task_type = Column(SQLEnum(TaskType), nullable=False)
    status = Column(SQLEnum(TaskStatus), nullable=False, default=TaskStatus.PENDING)
    priority = Column(Integer, default=5, nullable=False)  # 1-10, 1 is highest
    
    # Task data
    payload = Column(JSONB, nullable=False, default=dict)
    result = Column(JSONB, nullable=True)
    error = Column(Text, nullable=True)
    
    # Progress tracking
    progress = Column(Integer, default=0, nullable=False)  # 0-100
    message = Column(String(500), nullable=True)
    
    # Execution details
    attempts = Column(Integer, default=0, nullable=False)
    max_attempts = Column(Integer, default=3, nullable=False)
    worker_id = Column(String(100), nullable=True)
    
    # Relationships
    case = relationship("Case", back_populates="tasks")
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    scheduled_for = Column(DateTime, nullable=True)
    
    def __repr__(self):
        return f"<Task {self.task_type}:{self.status}>"