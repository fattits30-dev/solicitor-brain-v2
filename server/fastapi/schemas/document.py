from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime
import uuid


class DocumentUpload(BaseModel):
    case_id: uuid.UUID
    filename: str


class DocumentResponse(BaseModel):
    id: uuid.UUID
    case_id: uuid.UUID
    filename: str
    content: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    uploaded_at: datetime
    uploaded_by: uuid.UUID

    class Config:
        from_attributes = True
        
    @classmethod
    def from_orm(cls, obj):
        # Map the database field to the schema field
        data = obj.__dict__.copy()
        if 'doc_metadata' in data:
            data['metadata'] = data.pop('doc_metadata')
        return cls(**data)


class DocumentAnalysis(BaseModel):
    analysis: str
    key_parties: List[str]
    important_dates: List[str]
    legal_issues: List[str]
    risk_assessment: str
    recommended_actions: List[str]
    timestamp: datetime


class DocumentSearchResult(BaseModel):
    document: DocumentResponse
    similarity_score: float
    relevant_excerpt: Optional[str] = None


class SearchRequest(BaseModel):
    query: str
    case_id: Optional[uuid.UUID] = None
    limit: Optional[int] = 10
    threshold: Optional[float] = 0.7