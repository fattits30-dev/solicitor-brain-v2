from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid


class ChatRequest(BaseModel):
    message: str
    case_id: Optional[uuid.UUID] = None
    model: Optional[str] = None


class ChatResponse(BaseModel):
    id: uuid.UUID
    message: str
    response: str
    model: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ChatHistoryResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    case_id: Optional[uuid.UUID] = None
    message: str
    response: Optional[str] = None
    model: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ChatHistoryList(BaseModel):
    chats: List[ChatHistoryResponse]
    total: int
    page: int
    per_page: int