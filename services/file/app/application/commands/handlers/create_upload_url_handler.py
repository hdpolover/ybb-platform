"""Handler for CreateUploadUrlCommand — reserves a File row and returns a presigned PUT URL."""
import uuid
from datetime import datetime

from app.application.commands.create_upload_url_command import CreateUploadUrlCommand
from app.application.dto.file_dto import CreateUploadUrlResponseDto
from app.application.services.file_path_service import FilePathService
from app.domain.entities.file import File, FileStatus
from app.domain.exceptions.file_exceptions import (
    FileSizeLimitException,
    InvalidFileTypeException,
)
from app.domain.repositories.file_repository import IFileRepository
from app.domain.services.storage_service import IStorageService


class CreateUploadUrlHandler:
    """Issue a presigned PUT URL for direct-to-storage uploads.

    Validates MIME + size, reserves a `File` row with status=PROCESSING, and returns
    the URL the client should PUT bytes to. No file data passes through this handler.
    """

    ALLOWED_DOCUMENT_TYPES = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]
    ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

    MAX_DOCUMENT_SIZE = 50 * 1024 * 1024  # 50 MB — client passes docs through as-is
    MAX_IMAGE_SIZE = 20 * 1024 * 1024     # 20 MB — safety net; client compresses images first

    def __init__(
        self,
        storage_service: IStorageService,
        file_repository: IFileRepository,
    ):
        self.storage_service = storage_service
        self.file_repository = file_repository

    async def execute(self, command: CreateUploadUrlCommand) -> CreateUploadUrlResponseDto:
        # MIME allowlist
        allowed = self.ALLOWED_DOCUMENT_TYPES + self.ALLOWED_IMAGE_TYPES
        if command.content_type not in allowed:
            raise InvalidFileTypeException(command.content_type, allowed)

        # Size cap by MIME category
        max_size = (
            self.MAX_IMAGE_SIZE
            if command.content_type in self.ALLOWED_IMAGE_TYPES
            else self.MAX_DOCUMENT_SIZE
        )
        if command.size > max_size:
            raise FileSizeLimitException(command.size, max_size)

        # Generate deterministic-looking storage key: {uuid}.{ext}
        file_id = str(uuid.uuid4())
        extension = command.filename.rsplit('.', 1)[-1].lower() if '.' in command.filename else ''
        storage_filename = f"{file_id}.{extension}" if extension else file_id

        storage_path, real_bucket, path_metadata = FilePathService.get_storage_path(
            brand_id=command.brand_id,
            user_id=command.user_id,
            bucket=command.bucket,
            filename=storage_filename,
            program_id=command.program_id,
            participant_id=command.participant_id,
        )

        merged_metadata = {**(command.metadata or {}), **path_metadata}

        # Sign a PUT URL valid for command.expires_in_seconds
        upload_url = await self.storage_service.get_presigned_upload_url(
            bucket=real_bucket,
            object_name=storage_path,
            expiry_seconds=command.expires_in_seconds,
        )

        public_url = self.storage_service.get_public_url(
            bucket=real_bucket,
            object_name=storage_path,
        ) or None

        # Infer coarse file_type for filtering/search later
        if command.content_type.startswith('image/'):
            file_type = 'image'
        elif command.content_type in {
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }:
            file_type = 'spreadsheet'
        else:
            file_type = 'document'

        file_entity = File(
            id=file_id,
            filename=storage_filename,
            original_filename=command.filename,
            file_type=file_type,
            mime_type=command.content_type,
            file_size=command.size,
            bucket=real_bucket,
            storage_path=storage_path,
            user_id=command.user_id,
            brand_id=command.brand_id,
            uploaded_at=datetime.utcnow(),
            metadata=merged_metadata,
            program_id=command.program_id,
            asset_type=command.asset_type,
            title=command.title,
            alt_text=command.alt_text,
            status=FileStatus.PROCESSING,
        )

        await self.file_repository.save(file_entity)

        return CreateUploadUrlResponseDto(
            file_id=file_id,
            upload_url=upload_url,
            storage_path=storage_path,
            bucket=real_bucket,
            public_url=public_url,
            expires_in_seconds=command.expires_in_seconds,
        )
