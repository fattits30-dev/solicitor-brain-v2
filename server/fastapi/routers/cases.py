from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
import uuid

from database import get_db
from schemas.case import CaseCreate, CaseResponse, CaseUpdate, CaseWithDocuments
from utils.auth import get_current_active_user
from models.user import User
from models.case import Case
from models.document import Document

router = APIRouter(prefix="/cases", tags=["Cases"])


@router.post("/", response_model=CaseResponse)
async def create_case(
    case: CaseCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new case."""
    try:
        db_case = Case(
            title=case.title,
            description=case.description,
            client_id=case.client_id,
            status=case.status,
            risk_level=case.risk_level,
            created_by=current_user.id
        )
        
        db.add(db_case)
        await db.flush()
        await db.refresh(db_case)
        
        return CaseResponse.from_orm(db_case)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=List[CaseWithDocuments])
async def list_cases(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=100),
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """List cases with document counts."""
    try:
        # Build base query
        query = (
            select(
                Case,
                func.count(Document.id).label('document_count'),
                func.max(Document.uploaded_at).label('recent_activity')
            )
            .outerjoin(Document, Case.id == Document.case_id)
            .group_by(Case.id)
            .order_by(Case.updated_at.desc())
            .offset(skip)
            .limit(limit)
        )
        
        # Add status filter if provided
        if status:
            query = query.where(Case.status == status)
        
        result = await db.execute(query)
        rows = result.all()
        
        cases = []
        for row in rows:
            case_data = CaseResponse.from_orm(row.Case)
            case_with_docs = CaseWithDocuments(
                **case_data.dict(),
                document_count=row.document_count,
                recent_activity=row.recent_activity
            )
            cases.append(case_with_docs)
        
        return cases
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{case_id}", response_model=CaseResponse)
async def get_case(
    case_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific case."""
    try:
        result = await db.execute(
            select(Case).where(Case.id == case_id)
        )
        case = result.scalar_one_or_none()
        
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        
        return CaseResponse.from_orm(case)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{case_id}", response_model=CaseResponse)
async def update_case(
    case_id: uuid.UUID,
    case_update: CaseUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a case."""
    try:
        result = await db.execute(
            select(Case).where(Case.id == case_id)
        )
        case = result.scalar_one_or_none()
        
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        
        # Update case fields
        update_data = case_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(case, field, value)
        
        await db.flush()
        await db.refresh(case)
        
        return CaseResponse.from_orm(case)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{case_id}")
async def delete_case(
    case_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a case."""
    try:
        result = await db.execute(
            select(Case).where(Case.id == case_id)
        )
        case = result.scalar_one_or_none()
        
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        
        await db.delete(case)
        await db.flush()
        
        return {"message": "Case deleted successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))