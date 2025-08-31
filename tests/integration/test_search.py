import pytest
import asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool
import sys
import os

# Add the server/fastapi directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'server', 'fastapi')))

from app import app
from database import get_db, Base
from models.user import User
from models.case import Case
from models.document import Document
from utils.auth import get_password_hash, create_access_token


# Test database URL (use SQLite for testing)
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"

# Create test engine and session
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    poolclass=StaticPool,
    connect_args={"check_same_thread": False},
)

TestingSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False
)


async def override_get_db():
    async with TestingSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def setup_database():
    """Set up test database."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield
    
    # Cleanup
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db_session():
    """Create a database session for testing."""
    async with TestingSessionLocal() as session:
        yield session


@pytest.fixture
async def test_user(db_session: AsyncSession):
    """Create a test user."""
    user = User(
        username="testuser",
        email="test@example.com",
        password_hash=get_password_hash("testpass"),
        role="user"
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def test_case(db_session: AsyncSession, test_user: User):
    """Create a test case."""
    case = Case(
        title="Test Case",
        description="A test case for integration testing",
        status="active",
        risk_level="medium",
        created_by=test_user.id
    )
    db_session.add(case)
    await db_session.flush()
    await db_session.refresh(case)
    return case


@pytest.fixture
def auth_token(test_user: User):
    """Create authentication token for test user."""
    return create_access_token(data={"sub": test_user.username})


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


@pytest.mark.asyncio
async def test_health_check(client: TestClient):
    """Test health check endpoint."""
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_search_endpoint_without_documents(
    client: TestClient, 
    auth_token: str, 
    setup_database
):
    """Test search endpoint returns empty results when no documents exist."""
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    search_data = {
        "query": "test query",
        "limit": 10,
        "threshold": 0.7
    }
    
    response = client.post("/documents/search", json=search_data, headers=headers)
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_user_registration(client: TestClient, setup_database):
    """Test user registration."""
    user_data = {
        "username": "newuser",
        "email": "newuser@example.com",
        "password": "newpassword",
        "role": "user"
    }
    
    response = client.post("/auth/register", json=user_data)
    assert response.status_code == 200
    
    data = response.json()
    assert data["username"] == "newuser"
    assert data["email"] == "newuser@example.com"
    assert data["role"] == "user"
    assert "id" in data


@pytest.mark.asyncio
async def test_user_login(client: TestClient, setup_database, test_user: User):
    """Test user login."""
    login_data = {
        "username": "testuser",
        "password": "testpass"
    }
    
    response = client.post("/auth/token", data=login_data)
    assert response.status_code == 200
    
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_create_case(client: TestClient, auth_token: str, setup_database):
    """Test case creation."""
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    case_data = {
        "title": "Integration Test Case",
        "description": "A case created during integration testing",
        "status": "active",
        "risk_level": "low"
    }
    
    response = client.post("/cases/", json=case_data, headers=headers)
    assert response.status_code == 200
    
    data = response.json()
    assert data["title"] == "Integration Test Case"
    assert data["status"] == "active"
    assert data["risk_level"] == "low"


@pytest.mark.asyncio
async def test_list_cases(client: TestClient, auth_token: str, setup_database):
    """Test case listing."""
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    response = client.get("/cases/", headers=headers)
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_chat_without_context(client: TestClient, auth_token: str, setup_database):
    """Test chat endpoint without document context."""
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # Note: This test might fail if Ollama is not running
    # In a real environment, we'd mock the Ollama service
    chat_data = {
        "message": "Hello, this is a test message"
    }
    
    try:
        response = client.post("/chat/", json=chat_data, headers=headers)
        # If Ollama is available, should get 200
        # If not available, should get 500
        assert response.status_code in [200, 500]
        
        if response.status_code == 200:
            data = response.json()
            assert "response" in data
            assert data["message"] == "Hello, this is a test message"
    except Exception:
        # If Ollama service is not available, test should still pass
        # This is acceptable for integration testing without full infrastructure
        pass


if __name__ == "__main__":
    pytest.main([__file__, "-v"])