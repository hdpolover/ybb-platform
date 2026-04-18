"""PostgreSQL implementation of file repository using Prisma."""
from typing import Optional, List
from app.domain.entities.file import File
from app.domain.repositories.file_repository import IFileRepository
from .database import db
from datetime import datetime
import json
from prisma import Json

class PostgresFileRepository(IFileRepository):
    """PostgreSQL implementation of file repository via Prisma."""
    
    def __init__(self, session=None):
        self.prisma = db.file

    
    async def find_by_id(self, file_id: str) -> Optional[File]:
        model = await self.prisma.find_first(
            where={
                "id": file_id,
                "is_deleted": False
            }
        )
        
        if model:
            return self._to_domain(model)
        return None
    
    async def find_by_user(self, user_id: str, brand_id: str) -> List[File]:
        """Find all files for a user in a specific brand."""
        models = await self.prisma.find_many(
            where={
                "user_id": user_id,
                "brand_id": brand_id,
                "is_deleted": False
            },
            order={
                "uploaded_at": "desc"
            }
        )
        
        return [self._to_domain(model) for model in models]

    async def find_by_program(
        self,
        program_id: str,
        brand_id: str,
        asset_type: Optional[str] = None,
        bucket: Optional[str] = None,
        page: int = 1,
        limit: int = 50,
    ) -> tuple[List[File], int]:
        """Find all non-deleted files for a program with optional filters."""
        where: dict = {
            "program_id": program_id,
            "brand_id": brand_id,
            "is_deleted": False,
        }
        if asset_type:
            where["asset_type"] = asset_type
        if bucket:
            where["bucket"] = bucket

        skip = (page - 1) * limit

        total = await self.prisma.count(where=where)
        models = await self.prisma.find_many(
            where=where,
            order={"uploaded_at": "desc"},
            skip=skip,
            take=limit,
        )

        return [self._to_domain(m) for m in models], total

    async def find_by_storage_path(self, storage_path: str) -> Optional[File]:
        """Find file by storage path (used for confirm upload hook)."""
        model = await self.prisma.find_first(
            where={
                "storage_path": storage_path,
                "is_deleted": False
            }
        )
        if model:
            return self._to_domain(model)
        return None

    async def save(self, file: File) -> File:
        """Save file metadata."""
        if file.metadata:
            metadata_json = Json(file.metadata)
        else:
            metadata_json = Json({})

        await self.prisma.upsert(
            where={
                "id": file.id
            },
            data={
                "create": {
                    "id": file.id,
                    "filename": file.filename,
                    "original_filename": file.original_filename,
                    "file_type": file.file_type,
                    "mime_type": file.mime_type,
                    "file_size": file.file_size,
                    "storage_path": file.storage_path,
                    "bucket": file.bucket,
                    "user_id": file.user_id,
                    "brand_id": file.brand_id,
                    "file_metadata": metadata_json,
                    "uploaded_at": file.uploaded_at,
                    "is_deleted": False,
                    "program_id": file.program_id,
                    "asset_type": file.asset_type,
                },
                "update": {
                    "filename": file.filename,
                    "original_filename": file.original_filename,
                    "file_type": file.file_type,
                    "mime_type": file.mime_type,
                    "file_size": file.file_size,
                    "storage_path": file.storage_path,
                    "bucket": file.bucket,
                    "file_metadata": metadata_json,
                    "updated_at": datetime.utcnow(),
                    "program_id": file.program_id,
                    "asset_type": file.asset_type,
                }
            }
        )
        return file
    
    async def delete(self, file_id: str) -> bool:
        """Soft delete file metadata."""
        exists = await self.exists(file_id)
        if not exists:
            return False

        await self.prisma.update(
            where={"id": file_id},
            data={
                "is_deleted": True,
                "deleted_at": datetime.utcnow()
            }
        )
        return True
    
    async def exists(self, file_id: str) -> bool:
        """Check if file exists."""
        count = await self.prisma.count(
            where={
                "id": file_id,
                "is_deleted": False
            }
        )
        return count > 0
    
    def _to_domain(self, model) -> File:
        """Convert database model to domain entity."""
        meta = model.file_metadata
        if meta is None:
            meta = {}
        elif isinstance(meta, str):
            meta = json.loads(meta)
            
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
            updated_at=model.updated_at,
            metadata=meta,
            program_id=getattr(model, "program_id", None),
            asset_type=getattr(model, "asset_type", None),
        )


    
    async def find_by_id(self, file_id: str) -> Optional[File]:
        model = await self.prisma.find_first(
            where={
                "id": file_id,
                "is_deleted": False
            }
        )
        
        if model:
            return self._to_domain(model)
        return None
    
    async def find_by_user(self, user_id: str, brand_id: str) -> List[File]:
        """Find all files for a user in a specific brand."""
        models = await self.prisma.find_many(
            where={
                "user_id": user_id,
                "brand_id": brand_id,
                "is_deleted": False
            },
            order={
                "uploaded_at": "desc"
            }
        )
        
        return [self._to_domain(model) for model in models]
    
    async def find_by_storage_path(self, storage_path: str) -> Optional[File]:
        """Find file by storage path (used for confirm upload hook)."""
        model = await self.prisma.find_first(
            where={
                "storage_path": storage_path,
                "is_deleted": False
            }
        )
        if model:
            return self._to_domain(model)
        return None

    async def save(self, file: File) -> File:
        """Save file metadata."""
        # Convert dictionary metadata to JSON-compatible format
        if file.metadata:
            # Wrap in prisma.Json to ensure correct type
            metadata_json = Json(file.metadata)
        else:
            # Default to empty JSON object
            metadata_json = Json({})

        # Prisma upsert
        await self.prisma.upsert(
            where={
                "id": file.id
            },
            data={
                "create": {
                    "id": file.id,
                    "filename": file.filename,
                    "original_filename": file.original_filename,
                    "file_type": file.file_type,
                    "mime_type": file.mime_type,
                    "file_size": file.file_size,
                    "storage_path": file.storage_path,
                    "bucket": file.bucket,
                    "user_id": file.user_id,
                    "brand_id": file.brand_id,
                    "file_metadata": metadata_json,
                    "uploaded_at": file.uploaded_at,
                    "is_deleted": False
                },
                "update": {
                    "filename": file.filename,
                    "original_filename": file.original_filename,
                    "file_type": file.file_type,
                    "mime_type": file.mime_type,
                    "file_size": file.file_size,
                    "storage_path": file.storage_path,
                    "bucket": file.bucket,
                    "file_metadata": metadata_json,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        return file
    
    async def delete(self, file_id: str) -> bool:
        """Soft delete file metadata."""
        # Check if exists first to return correct boolean
        exists = await self.exists(file_id)
        if not exists:
            return False

        await self.prisma.update(
            where={
                "id": file_id
            },
            data={
                "is_deleted": True,
                "deleted_at": datetime.utcnow()
            }
        )
        return True
    
    async def exists(self, file_id: str) -> bool:
        """Check if file exists."""
        count = await self.prisma.count(
            where={
                "id": file_id,
                "is_deleted": False
            }
        )
        return count > 0
    
    def _to_domain(self, model) -> File:
        """Convert database model to domain entity."""
        # Prisma returns None for null JSON, ensure dict
        meta = model.file_metadata
        if meta is None:
            meta = {}
        elif isinstance(meta, str):
            meta = json.loads(meta)
            
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
            updated_at=model.updated_at,
            metadata=meta
        )
