from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid


class CaseCreate(BaseModel):
    title: str
    description: Optional[str] = None
    client_id: Optional[uuid.UUID] = None
    status: Optional[str] = "active"
    risk_level: Optional[str] = "medium"


class CaseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    client_id: Optional[uuid.UUID] = None
    status: Optional[str] = None
    risk_level: Optional[str] = None


class CaseResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: Optional[str] = None
    client_id: Optional[uuid.UUID] = None
    status: str
    risk_level: str
    created_at: datetime
    updated_at: datetime
    created_by: uuid.UUID

    class Config:
        from_attributes = True


class CaseWithDocuments(CaseResponse):
    document_count: int
    recent_activity: Optional[datetime] = None