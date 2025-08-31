"""
Draft model for generated documents and letters
"""

from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Enum as SQLEnum, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.core.database import Base


class DraftType(str, enum.Enum):
    """Types of drafted documents"""
    LETTER = "letter"
    EMAIL = "email"
    COMPLAINT = "complaint"
    SAR = "sar"  # Subject Access Request
    PRE_ACTION = "pre_action"
    COURT_FORM = "court_form"
    WITNESS_STATEMENT = "witness_statement"
    REPORT = "report"


class DraftStatus(str, enum.Enum):
    """Draft review status"""
    GENERATED = "generated"
    REVIEWING = "reviewing"
    APPROVED = "approved"
    SENT = "sent"
    ARCHIVED = "archived"


class ToneLevel(str, enum.Enum):
    """Tone settings for trauma-informed communication"""
    GENTLE = "gentle"
    NEUTRAL = "neutral"
    ASSERTIVE = "assertive"
    FIRM = "firm"
    ESCALATED = "escalated"


class Draft(Base):
    """Generated drafts with tone control and versioning"""
    
    __tablename__ = "drafts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    
    # Draft details
    draft_type = Column(SQLEnum(DraftType), nullable=False)
    status = Column(SQLEnum(DraftStatus), nullable=False, default=DraftStatus.GENERATED)
    version = Column(Integer, default=1, nullable=False)
    parent_id = Column(UUID(as_uuid=True), nullable=True)  # For versioning
    
    # Content
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=False)
    
    # Recipient information (redactable)
    recipient_name = Column(String(500), nullable=True)
    recipient_address = Column(Text, nullable=True)
    recipient_email = Column(String(255), nullable=True)
    
    # Tone and style
    tone = Column(SQLEnum(ToneLevel), nullable=False, default=ToneLevel.NEUTRAL)
    
    # Metadata
    meta = Column(JSONB, nullable=True, default=dict)
    attachments = Column(JSONB, nullable=True, default=list)
    
    # Generation details
    prompt_used = Column(Text, nullable=True)
    model_used = Column(String(100), nullable=True)
    tokens_used = Column(Integer, nullable=True)
    
    # Relationships
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_by = relationship("User", back_populates="drafts")
    case = relationship("Case", back_populates="drafts")
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    approved_at = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    
    def __repr__(self):
        return f"<Draft {self.draft_type}:{self.title}>"