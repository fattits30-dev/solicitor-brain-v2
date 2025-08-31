"""
Seed database with test data
"""
import asyncio
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import engine, Base
from app.models.user import User, UserRole
from app.models.case import Case, CaseStatus, SensitivityLevel

async def seed_database():
    async with engine.begin() as conn:
        # Create tables if not exist
        await conn.run_sync(Base.metadata.create_all)
    
    async with AsyncSession(engine) as session:
        # Create test user
        test_user = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
            email="test@example.com",
            username="testuser",
            full_name="Test User",
            hashed_password="hashed",
            role=UserRole.SOLICITOR,
            is_active=True,
            is_verified=True
        )
        
        # Create test case
        test_case = Case(
            id=uuid.UUID("123e4567-e89b-12d3-a456-426614174000"),
            reference="TEST-2024-001",
            title="Test Case for Development",
            description="This is a test case for development and testing",
            client_name="Test Client",
            client_email="client@test.com",
            status=CaseStatus.INTAKE,
            sensitivity_level=SensitivityLevel.MEDIUM,
            owner_id=test_user.id
        )
        
        session.add(test_user)
        session.add(test_case)
        await session.commit()
        
        print("✅ Database seeded successfully!")
        print(f"   User ID: {test_user.id}")
        print(f"   Case ID: {test_case.id}")

if __name__ == "__main__":
    asyncio.run(seed_database())