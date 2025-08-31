"""
Case model for legal case management
"""

from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Enum as SQLEnum, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.core.database import Base


class CaseStatus(str, enum.Enum):
    """Case status stages"""
    INTAKE = "intake"
    INVESTIGATION = "investigation"
    PRE_ACTION = "pre_action"
    LITIGATION = "litigation"
    SETTLEMENT = "settlement"
    CLOSED = "closed"
    ARCHIVED = "archived"


class SensitivityLevel(str, enum.Enum):
    """Sensitivity levels for trauma-informed handling"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Case(Base):
    """Legal case with trauma-informed sensitivity tracking"""
    
    __tablename__ = "cases"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reference = Column(String(50), unique=True, nullable=False, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    
    # Client information (redactable)
    client_name = Column(String(255), nullable=False)
    client_email = Column(String(255), nullable=True)
    client_phone = Column(String(50), nullable=True)
    
    # Case details
    status = Column(SQLEnum(CaseStatus), nullable=False, default=CaseStatus.INTAKE)
    sensitivity_level = Column(SQLEnum(SensitivityLevel), nullable=False, default=SensitivityLevel.MEDIUM)
    case_type = Column(String(100), nullable=True)  # e.g., "Personal Injury", "Employment", "Housing"
    
    # Opposing party (redactable)
    opposing_party = Column(String(500), nullable=True)
    opposing_solicitor = Column(String(500), nullable=True)
    
    # Important dates
    incident_date = Column(DateTime, nullable=True)
    limitation_date = Column(DateTime, nullable=True)
    next_action_date = Column(DateTime, nullable=True)
    
    # Metadata
    tags = Column(JSONB, nullable=True, default=list)
    notes = Column(Text, nullable=True)
    
    # Financial
    estimated_value = Column(Integer, nullable=True)  # In pence to avoid float issues
    
    # Relationships
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    owner = relationship("User", back_populates="cases")
    
    documents = relationship("Document", back_populates="case", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="case", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="case", cascade="all, delete-orphan")
    drafts = relationship("Draft", back_populates="case", cascade="all, delete-orphan")
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    closed_at = Column(DateTime, nullable=True)
    
    def __repr__(self):
        return f"<Case {self.reference}: {self.title}>"