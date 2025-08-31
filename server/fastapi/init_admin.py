#!/usr/bin/env python3
"""
Initialize admin user and test database connectivity.
Run this script to set up the initial admin user.
"""

import asyncio
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import async_session_maker, init_database
from models.user import User
from utils.auth import get_password_hash
from config import settings


async def create_admin_user():
    """Create default admin user if it doesn't exist."""
    async with async_session_maker() as db:
        try:
            # Check if admin user exists
            result = await db.execute(
                select(User).where(User.username == "admin")
            )
            existing_admin = result.scalar_one_or_none()
            
            if existing_admin:
                print("Admin user already exists!")
                return existing_admin
            
            # Create admin user
            admin_user = User(
                username="admin",
                email="admin@example.com",
                password_hash=get_password_hash("admin123"),
                role="admin"
            )
            
            db.add(admin_user)
            await db.commit()
            await db.refresh(admin_user)
            
            print("Admin user created successfully!")
            print(f"Username: admin")
            print(f"Password: admin123")
            print(f"Email: admin@example.com")
            print(f"Role: admin")
            
            return admin_user
            
        except Exception as e:
            print(f"Error creating admin user: {e}")
            await db.rollback()
            raise


async def test_database_connection():
    """Test database connectivity."""
    try:
        async with async_session_maker() as db:
            result = await db.execute(select(1))
            result.scalar()
            print("✅ Database connection successful!")
            return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False


async def main():
    """Main initialization function."""
    print("Solicitor Brain API - Database Initialization")
    print("=" * 50)
    
    # Test database connection
    print("\n1. Testing database connection...")
    db_ok = await test_database_connection()
    if not db_ok:
        print("Please check your database configuration and ensure PostgreSQL is running.")
        sys.exit(1)
    
    # Initialize database tables
    print("\n2. Initializing database tables...")
    try:
        await init_database()
        print("✅ Database tables initialized successfully!")
    except Exception as e:
        print(f"❌ Failed to initialize database tables: {e}")
        sys.exit(1)
    
    # Create admin user
    print("\n3. Creating admin user...")
    try:
        await create_admin_user()
    except Exception as e:
        print(f"❌ Failed to create admin user: {e}")
        sys.exit(1)
    
    print("\n" + "=" * 50)
    print("✅ Initialization completed successfully!")
    print("\nNext steps:")
    print("1. Start the API server: uvicorn app:app --reload")
    print("2. Visit http://localhost:8000/docs for API documentation")
    print("3. Use the admin credentials above to authenticate")
    print("4. Check health endpoint: http://localhost:8000/healthz")


if __name__ == "__main__":
    asyncio.run(main())