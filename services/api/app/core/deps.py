"""
Dependency injection for FastAPI endpoints
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import jwt

from app.core.database import get_db
from app.core.config import settings
from app.models.user import User

security = HTTPBearer()


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> User:
    """
    Get the current authenticated user from JWT token
    """
    # For now, return a placeholder user for development
    # TODO: Implement proper JWT validation
    
    # Temporary development user
    from sqlalchemy import select
    
    result = await db.execute(select(User).where(User.email == "admin@example.com"))
    user = result.scalar_one_or_none()
    
    if not user:
        # Create a temporary admin user for development
        try:
            user = User(
                email="admin@example.com",
                username="admin",
                full_name="Admin User",
                role="admin",
                is_active=True,
                hashed_password="dummy"  # This is just for development
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
        except:
            # User probably already exists, try to get it by username
            await db.rollback()
            result = await db.execute(select(User).where(User.username == "admin"))
            user = result.scalar_one_or_none()
            if not user:
                raise HTTPException(status_code=401, detail="Authentication required")
    
    return user


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """
    Get the current authenticated active user
    """
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


def require_role(required_role: str):
    """
    Dependency factory for role-based access control
    """
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role != required_role and current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
        return current_user
    return role_checker


# Role-specific dependencies
require_admin = Depends(require_role("admin"))
require_solicitor = Depends(require_role("solicitor"))
require_paralegal = Depends(require_role("paralegal"))