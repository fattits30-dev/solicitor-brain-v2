from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import uuid

from database import get_db
from schemas.chat import ChatRequest, ChatResponse, ChatHistoryResponse, ChatHistoryList
from utils.auth import get_current_active_user
from models.user import User
from models.chat import ChatHistory
from services.ollama_service import ollama_service
from services.document_service import document_service

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post("/", response_model=ChatResponse)
async def chat_with_ai(
    chat_request: ChatRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Chat with AI assistant."""
    try:
        # Get relevant document context if case_id is provided
        context = ""
        if chat_request.case_id:
            context = await document_service.get_context_for_chat(
                db=db,
                query=chat_request.message,
                case_id=str(chat_request.case_id)
            )
        
        # Get AI response
        ai_response = await ollama_service.chat(
            message=chat_request.message,
            context=context,
            model=chat_request.model
        )
        
        # Save chat history
        chat_history = ChatHistory(
            user_id=current_user.id,
            case_id=chat_request.case_id,
            message=chat_request.message,
            response=ai_response,
            model=chat_request.model or ollama_service.chat_model
        )
        
        db.add(chat_history)
        await db.flush()
        await db.refresh(chat_history)
        
        return ChatResponse(
            id=chat_history.id,
            message=chat_history.message,
            response=chat_history.response,
            model=chat_history.model,
            created_at=chat_history.created_at
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history", response_model=ChatHistoryList)
async def get_chat_history(
    case_id: Optional[uuid.UUID] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get chat history for the current user."""
    try:
        skip = (page - 1) * per_page
        
        # Build query
        query = select(ChatHistory).where(ChatHistory.user_id == current_user.id)
        
        if case_id:
            query = query.where(ChatHistory.case_id == case_id)
        
        query = query.order_by(ChatHistory.created_at.desc()).offset(skip).limit(per_page)
        
        result = await db.execute(query)
        chats = result.scalars().all()
        
        # Get total count
        count_query = select(ChatHistory).where(ChatHistory.user_id == current_user.id)
        if case_id:
            count_query = count_query.where(ChatHistory.case_id == case_id)
        
        from sqlalchemy import func
        total_result = await db.execute(
            select(func.count(ChatHistory.id)).where(ChatHistory.user_id == current_user.id)
        )
        total = total_result.scalar()
        
        chat_responses = [ChatHistoryResponse.from_orm(chat) for chat in chats]
        
        return ChatHistoryList(
            chats=chat_responses,
            total=total,
            page=page,
            per_page=per_page
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/{chat_id}", response_model=ChatHistoryResponse)
async def get_chat_message(
    chat_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific chat message."""
    try:
        result = await db.execute(
            select(ChatHistory).where(
                ChatHistory.id == chat_id,
                ChatHistory.user_id == current_user.id
            )
        )
        chat = result.scalar_one_or_none()
        
        if not chat:
            raise HTTPException(status_code=404, detail="Chat message not found")
        
        return ChatHistoryResponse.from_orm(chat)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/history/{chat_id}")
async def delete_chat_message(
    chat_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a chat message."""
    try:
        result = await db.execute(
            select(ChatHistory).where(
                ChatHistory.id == chat_id,
                ChatHistory.user_id == current_user.id
            )
        )
        chat = result.scalar_one_or_none()
        
        if not chat:
            raise HTTPException(status_code=404, detail="Chat message not found")
        
        await db.delete(chat)
        await db.flush()
        
        return {"message": "Chat message deleted successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))