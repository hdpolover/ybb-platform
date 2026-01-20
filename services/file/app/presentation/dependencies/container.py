"""Dependency injection container."""
from functools import lru_cache
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
import os

# --- IMPORT INFRASTRUCTURE ---
from app.infrastructure.storage.minio_storage import MinIOStorage
from app.infrastructure.persistence.postgres.database import get_db
from app.infrastructure.persistence.postgres.file_repository import PostgresFileRepository

# --- IMPORT HANDLERS ---
from app.application.commands.handlers.upload_file_handler import UploadFileHandler
from app.application.queries.handlers.get_file_handler import GetFileHandler

# --- IMPORT PROCESSORS ---
from app.infrastructure.processors.excel_export import ExcelExportService
from app.infrastructure.processors.pdf_generator import PDFGeneratorService
from app.infrastructure.processors.certificate_generator import CertificateGeneratorService


# Singleton storage service
@lru_cache()
def get_storage_service() -> MinIOStorage:
    """Get MinIO storage service instance."""
    return MinIOStorage(
        endpoint=os.getenv("MINIO_ENDPOINT", "localhost:9000"),
        access_key=os.getenv("MINIO_ACCESS_KEY", "minioadmin"),
        secret_key=os.getenv("MINIO_SECRET_KEY", "minioadmin"),
        secure=os.getenv("MINIO_SECURE", "false").lower() == "true",
        public_endpoint=os.getenv("MINIO_PUBLIC_ENDPOINT", "localhost:9000"),
        public_secure=os.getenv("MINIO_PUBLIC_SECURE", "false").lower() == "true"
    )


# Ganti InMemory jadi Postgres
def get_file_repository(session: AsyncSession = Depends(get_db)) -> PostgresFileRepository:
    """Get PostgreSQL file repository instance."""
    return PostgresFileRepository(session)


# Document generation services
@lru_cache()
def get_excel_export_service() -> ExcelExportService:
    """Get Excel export service instance."""
    return ExcelExportService()


@lru_cache()
def get_pdf_generator_service() -> PDFGeneratorService:
    """Get PDF generator service instance."""
    return PDFGeneratorService()


@lru_cache()
def get_certificate_generator_service() -> CertificateGeneratorService:
    """Get certificate generator service instance."""
    return CertificateGeneratorService(
        signing_key=os.getenv("CERTIFICATE_SIGNING_KEY", "your-secret-key"),
        verification_url=os.getenv("CERTIFICATE_VERIFICATION_URL", "https://verify.ybb.org")
    )


# Inject Repository via Depends
def get_upload_handler(
    file_repository: PostgresFileRepository = Depends(get_file_repository)
) -> UploadFileHandler:
    """Get upload file handler."""
    return UploadFileHandler(
        storage_service=get_storage_service(),
        file_repository=file_repository
    )


def get_get_file_handler(
    file_repository: PostgresFileRepository = Depends(get_file_repository)
) -> GetFileHandler:
    """Get file handler."""
    return GetFileHandler(
        file_repository=file_repository,
        storage_service=get_storage_service()
    )