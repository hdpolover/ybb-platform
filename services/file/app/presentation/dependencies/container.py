"""Dependency injection container."""
from functools import lru_cache
from fastapi import Depends
import os

# --- IMPORT INFRASTRUCTURE ---
from app.infrastructure.storage.minio_storage import MinIOStorage
from app.infrastructure.persistence.postgres.file_repository import PostgresFileRepository
from app.infrastructure.messaging.rabbitmq_service import RabbitMQService

# --- IMPORT HANDLERS ---
from app.application.commands.handlers.upload_file_handler import UploadFileHandler
from app.application.commands.handlers.delete_file_handler import DeleteFileHandler
from app.application.commands.handlers.create_upload_url_handler import CreateUploadUrlHandler
from app.application.commands.handlers.mark_file_ready_handler import MarkFileReadyHandler
from app.application.queries.handlers.get_file_handler import GetFileHandler
from app.application.queries.handlers.list_files_by_program_handler import ListFilesByProgramHandler

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
        public_secure=os.getenv("MINIO_PUBLIC_SECURE", "false").lower() == "true",
        region=os.getenv("MINIO_REGION", None)
    )


def get_file_repository() -> PostgresFileRepository:
    """Get PostgreSQL file repository instance."""
    return PostgresFileRepository()


@lru_cache()
def get_rabbitmq_service() -> RabbitMQService:
    """Get RabbitMQ service instance."""
    return RabbitMQService(
        amqp_url=os.getenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/"),
        exchange_name="ybb.events"
    )


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


def get_delete_file_handler(
    file_repository: PostgresFileRepository = Depends(get_file_repository)
) -> DeleteFileHandler:
    """Get delete file handler."""
    return DeleteFileHandler(
        file_repository=file_repository,
        storage_service=get_storage_service()
    )


def get_list_files_by_program_handler(
    file_repository: PostgresFileRepository = Depends(get_file_repository)
) -> ListFilesByProgramHandler:
    """Get list-files-by-program handler."""
    return ListFilesByProgramHandler(
        file_repository=file_repository,
        storage_service=get_storage_service()
    )


def get_create_upload_url_handler(
    file_repository: PostgresFileRepository = Depends(get_file_repository),
) -> CreateUploadUrlHandler:
    """Get create-upload-url handler (presigned PUT flow)."""
    return CreateUploadUrlHandler(
        storage_service=get_storage_service(),
        file_repository=file_repository,
    )


def get_mark_file_ready_handler(
    file_repository: PostgresFileRepository = Depends(get_file_repository),
) -> MarkFileReadyHandler:
    """Get mark-file-ready handler (transitions PROCESSING → READY after client PUT)."""
    return MarkFileReadyHandler(
        storage_service=get_storage_service(),
        file_repository=file_repository,
    )
