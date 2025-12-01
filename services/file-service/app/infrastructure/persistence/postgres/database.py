"""Database configuration and session management."""
# type: ignore
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker  # type: ignore
from sqlalchemy.orm import declarative_base  # type: ignore
from typing import AsyncGenerator
import os


# Database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://ybb_user:ybb_password@localhost:5432/ybb_files_db")

# Create async engine
engine = create_async_engine(
    DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://"),
    echo=True,
    pool_size=20,
    max_overflow=0,
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Base class for models
Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Get database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
