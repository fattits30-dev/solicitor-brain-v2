from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from database import get_db
from schemas.user import UserResponse, UserUpdate
from utils.auth import get_current_active_user
from models.user import User

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    """Get current user information."""
    return UserResponse.from_orm(current_user)


@router.put("/me", response_model=UserResponse)
async def update_user_me(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Update current user information."""
    try:
        # Update user fields
        update_data = user_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(current_user, field, value)
        
        await db.flush()
        await db.refresh(current_user)
        
        return UserResponse.from_orm(current_user)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=List[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """List all users (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Not enough permissions"
        )
    
    try:
        from sqlalchemy import select
        result = await db.execute(
            select(User)
            .order_by(User.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        users = result.scalars().all()
        return [UserResponse.from_orm(user) for user in users]
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))