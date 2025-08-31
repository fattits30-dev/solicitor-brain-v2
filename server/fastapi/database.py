from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool
from config import settings
import structlog

logger = structlog.get_logger(__name__)

# Create async engine
engine = create_async_engine(
    settings.database_url,
    poolclass=NullPool,
    echo=False,
    future=True
)

# Create session maker
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

Base = declarative_base()


async def get_db() -> AsyncSession:
    """Dependency to get database session."""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_database():
    """Initialize database tables."""
    try:
        async with engine.begin() as conn:
            # Import all models here to ensure they are registered
            from models import user, case, document, chat, draft
            await conn.run_sync(Base.metadata.create_all)
            logger.info("Database tables initialized successfully")
    except Exception as e:
        logger.error("Failed to initialize database", error=str(e))
        raise