from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
import uuid


class DraftCreate(BaseModel):
    case_id: uuid.UUID
    template_name: str
    content: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class DraftUpdate(BaseModel):
    template_name: Optional[str] = None
    content: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class DraftResponse(BaseModel):
    id: uuid.UUID
    case_id: uuid.UUID
    template_name: Optional[str] = None
    content: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime
    created_by: uuid.UUID

    class Config:
        from_attributes = True
        
    @classmethod
    def from_orm(cls, obj):
        # Map the database field to the schema field
        data = obj.__dict__.copy()
        if 'draft_metadata' in data:
            data['metadata'] = data.pop('draft_metadata')
        return cls(**data)


class DraftGenerate(BaseModel):
    case_id: uuid.UUID
    template_name: str
    data: Dict[str, Any]