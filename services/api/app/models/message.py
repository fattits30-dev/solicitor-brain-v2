"""
Message model for AI conversations and audit trail
"""

from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Enum as SQLEnum, Integer, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.core.database import Base


class MessageRole(str, enum.Enum):
    """Message roles in conversation"""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    TOOL = "tool"


class Message(Base):
    """Conversation messages with tool calls and responses"""
    
    __tablename__ = "messages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    
    # Message content
    role = Column(SQLEnum(MessageRole), nullable=False)
    content = Column(Text, nullable=False)
    
    # Tool usage
    tool_calls = Column(JSONB, nullable=True)  # Array of tool calls
    tool_responses = Column(JSONB, nullable=True)  # Tool execution results
    
    # Context and citations
    context_chunks = Column(JSONB, nullable=True)  # Referenced document chunks
    citations = Column(JSONB, nullable=True)  # Document references
    
    # Metadata
    tokens_used = Column(Integer, nullable=True)
    model_used = Column(String(100), nullable=True)
    temperature = Column(Float, nullable=True)
    
    # Relationships
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    author = relationship("User", back_populates="messages")
    case = relationship("Case", back_populates="messages")
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    def __repr__(self):
        return f"<Message {self.role} in Case {self.case_id}>"