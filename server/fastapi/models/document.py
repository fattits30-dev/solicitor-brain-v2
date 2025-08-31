import uuid
from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"))
    filename = Column(String(500), nullable=False)
    content = Column(Text)
    embedding = Column(Vector(768))  # nomic-embed-text produces 768-dimensional embeddings
    doc_metadata = Column("metadata", JSONB)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    # Relationships
    case = relationship("Case", back_populates="documents")
    uploader = relationship("User", back_populates="documents")