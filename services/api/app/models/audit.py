"""
Audit log model for security and compliance
"""

from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.core.database import Base


class AuditLog(Base):
    """Comprehensive audit logging with PII redaction"""
    
    __tablename__ = "audit_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Action details
    action = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(50), nullable=False)
    resource_id = Column(UUID(as_uuid=True), nullable=True)
    
    # Request details
    method = Column(String(10), nullable=True)  # HTTP method
    path = Column(String(500), nullable=True)
    ip_address = Column(INET, nullable=True)
    user_agent = Column(String(500), nullable=True)
    
    # Data changes
    old_values = Column(JSONB, nullable=True)  # Redacted
    new_values = Column(JSONB, nullable=True)  # Redacted
    
    # Status
    success = Column(Boolean, default=True, nullable=False)
    error_message = Column(Text, nullable=True)
    
    # Security
    is_redacted = Column(Boolean, default=False, nullable=False)
    risk_level = Column(String(20), nullable=True)  # low, medium, high, critical
    
    # Metadata
    meta = Column(JSONB, nullable=True, default=dict)
    session_id = Column(String(100), nullable=True)
    request_id = Column(String(100), nullable=True)
    
    # Relationships
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    actor = relationship("User", back_populates="audit_logs")
    
    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    def __repr__(self):
        return f"<AuditLog {self.action} on {self.resource_type}>"