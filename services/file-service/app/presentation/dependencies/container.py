"""Dependency injection container."""
from functools import lru_cache
from app.infrastructure.storage.minio_storage import MinIOStorage
from app.application.commands.handlers.upload_file_handler import UploadFileHandler
from app.application.queries.handlers.get_file_handler import GetFileHandler
from app.infrastructure.persistence.in_memory_file_repository import InMemoryFileRepository
import os


# Singleton storage service
@lru_cache()
def get_storage_service() -> MinIOStorage:
    """Get MinIO storage service instance."""
    return MinIOStorage(
        endpoint=os.getenv("MINIO_ENDPOINT", "localhost:9000"),
        access_key=os.getenv("MINIO_ACCESS_KEY", "minioadmin"),
        secret_key=os.getenv("MINIO_SECRET_KEY", "minioadmin"),
        secure=os.getenv("MINIO_SECURE", "false").lower() == "true"
    )


# Singleton repository (in-memory for now)
@lru_cache()
def get_file_repository() -> InMemoryFileRepository:
    """Get file repository instance."""
    return InMemoryFileRepository()


def get_upload_handler() -> UploadFileHandler:
    """Get upload file handler."""
    return UploadFileHandler(
        storage_service=get_storage_service(),
        file_repository=get_file_repository()
    )


def get_get_file_handler() -> GetFileHandler:
    """Get file handler."""
    return GetFileHandler(
        file_repository=get_file_repository(),
        storage_service=get_storage_service()
    )
