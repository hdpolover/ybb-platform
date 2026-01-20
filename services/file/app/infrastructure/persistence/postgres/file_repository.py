"""PostgreSQL implementation of file repository."""
# type: ignore
from typing import Optional, List
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.domain.entities.file import File
from app.domain.repositories.file_repository import IFileRepository
from .models import FileModel
from datetime import datetime

class PostgresFileRepository(IFileRepository):
    """PostgreSQL implementation of file repository."""
    
    def __init__(self, session: AsyncSession):
        """Initialize with database session."""
        self._session = session
    
    async def find_by_id(self, file_id: str) -> Optional[File]:
        stmt = select(FileModel).where(
            and_(
                FileModel.id == file_id,
                FileModel.is_deleted == False
            )
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        
        if model:
            return self._to_domain(model)
        return None
    
    async def find_by_user(self, user_id: str, brand_id: str) -> List[File]:
        """Find all files for a user in a specific brand."""
        stmt = select(FileModel).where(
            and_(
                FileModel.user_id == user_id,
                FileModel.brand_id == brand_id,
                FileModel.is_deleted == False
            )
        ).order_by(FileModel.uploaded_at.desc())
        
        result = await self._session.execute(stmt)
        models = result.scalars().all()
        
        return [self._to_domain(model) for model in models]
    
    async def save(self, file: File) -> File:
        """Save file metadata."""
        stmt = select(FileModel).where(FileModel.id == file.id)
        result = await self._session.execute(stmt)
        existing = result.scalar_one_or_none()
        
        if existing:
            existing.filename = file.filename
            existing.original_filename = file.original_filename
            existing.file_type = file.file_type
            existing.mime_type = file.mime_type
            existing.file_size = file.file_size
            existing.storage_path = file.storage_path
            existing.bucket = file.bucket
            # --- UPDATE: Pakai file_metadata ---
            existing.file_metadata = file.metadata 
            existing.updated_at = datetime.utcnow()
        else:
            model = FileModel(
                id=file.id,
                filename=file.filename,
                original_filename=file.original_filename,
                file_type=file.file_type,
                mime_type=file.mime_type,
                file_size=file.file_size,
                storage_path=file.storage_path,
                bucket=file.bucket,
                user_id=file.user_id,
                brand_id=file.brand_id,
                # --- UPDATE: Pakai file_metadata ---
                file_metadata=file.metadata, 
                is_deleted=False,
                uploaded_at=file.uploaded_at
            )
            self._session.add(model)
        
        await self._session.flush()
        await self._session.commit()
        return file
    
    async def delete(self, file_id: str) -> bool:
        """Soft delete file metadata."""
        stmt = select(FileModel).where(FileModel.id == file_id)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        
        if model:
            model.is_deleted = True
            model.deleted_at = datetime.utcnow()
            await self._session.flush()
            await self._session.commit()
            return True
        return False
    
    async def exists(self, file_id: str) -> bool:
        """Check if file exists."""
        stmt = select(FileModel.id).where(
            and_(
                FileModel.id == file_id,
                FileModel.is_deleted == False
            )
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none() is not None
    
    def _to_domain(self, model: FileModel) -> File:
        """Convert database model to domain entity."""
        return File(
            id=model.id,
            filename=model.filename,
            original_filename=model.original_filename,
            file_type=model.file_type,
            mime_type=model.mime_type,
            file_size=model.file_size,
            storage_path=model.storage_path,
            bucket=model.bucket,
            user_id=model.user_id,
            brand_id=model.brand_id,
            uploaded_at=model.uploaded_at,
            # --- UPDATE: Pakai file_metadata ---
            metadata=model.file_metadata or {} 
        )