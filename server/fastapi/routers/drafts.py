from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import uuid

from database import get_db
from schemas.draft import DraftCreate, DraftResponse, DraftUpdate, DraftGenerate
from utils.auth import get_current_active_user
from models.user import User
from models.draft import Draft
from services.ollama_service import ollama_service

router = APIRouter(prefix="/drafts", tags=["Drafts"])


@router.post("/", response_model=DraftResponse)
async def create_draft(
    draft: DraftCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new draft."""
    try:
        db_draft = Draft(
            case_id=draft.case_id,
            template_name=draft.template_name,
            content=draft.content,
            draft_metadata=draft.metadata,
            created_by=current_user.id
        )
        
        db.add(db_draft)
        await db.flush()
        await db.refresh(db_draft)
        
        return DraftResponse.from_orm(db_draft)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate", response_model=DraftResponse)
async def generate_draft(
    draft_request: DraftGenerate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate a draft using AI."""
    try:
        # Generate draft content using AI
        generated_content = await ollama_service.generate_draft(
            template_name=draft_request.template_name,
            data=draft_request.data
        )
        
        # Create draft in database
        db_draft = Draft(
            case_id=draft_request.case_id,
            template_name=draft_request.template_name,
            content=generated_content,
            draft_metadata={
                "generated": True,
                "generation_data": draft_request.data
            },
            created_by=current_user.id
        )
        
        db.add(db_draft)
        await db.flush()
        await db.refresh(db_draft)
        
        return DraftResponse.from_orm(db_draft)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/case/{case_id}", response_model=List[DraftResponse])
async def get_case_drafts(
    case_id: uuid.UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all drafts for a case."""
    try:
        result = await db.execute(
            select(Draft)
            .where(Draft.case_id == case_id)
            .order_by(Draft.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        drafts = result.scalars().all()
        
        return [DraftResponse.from_orm(draft) for draft in drafts]
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{draft_id}", response_model=DraftResponse)
async def get_draft(
    draft_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific draft."""
    try:
        result = await db.execute(
            select(Draft).where(Draft.id == draft_id)
        )
        draft = result.scalar_one_or_none()
        
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")
        
        return DraftResponse.from_orm(draft)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{draft_id}", response_model=DraftResponse)
async def update_draft(
    draft_id: uuid.UUID,
    draft_update: DraftUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a draft."""
    try:
        result = await db.execute(
            select(Draft).where(Draft.id == draft_id)
        )
        draft = result.scalar_one_or_none()
        
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")
        
        # Update draft fields
        update_data = draft_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(draft, field, value)
        
        await db.flush()
        await db.refresh(draft)
        
        return DraftResponse.from_orm(draft)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{draft_id}")
async def delete_draft(
    draft_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a draft."""
    try:
        result = await db.execute(
            select(Draft).where(Draft.id == draft_id)
        )
        draft = result.scalar_one_or_none()
        
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")
        
        await db.delete(draft)
        await db.flush()
        
        return {"message": "Draft deleted successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=List[DraftResponse])
async def list_user_drafts(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """List all drafts created by the current user."""
    try:
        result = await db.execute(
            select(Draft)
            .where(Draft.created_by == current_user.id)
            .order_by(Draft.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        drafts = result.scalars().all()
        
        return [DraftResponse.from_orm(draft) for draft in drafts]
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))