"""Handler for MarkFileReadyCommand — verify the upload landed on storage and flip status to READY."""
from app.application.commands.mark_file_ready_command import MarkFileReadyCommand
from app.application.dto.file_dto import FileDto
from app.domain.entities.file import FileStatus
from app.domain.exceptions.file_exceptions import (
    FileNotFoundException,
    FileNotUploadedException,
)
from app.domain.repositories.file_repository import IFileRepository
from app.domain.services.storage_service import IStorageService


class MarkFileReadyHandler:
    """Verifies the presigned PUT actually completed, then marks the File row READY."""

    def __init__(
        self,
        storage_service: IStorageService,
        file_repository: IFileRepository,
    ):
        self.storage_service = storage_service
        self.file_repository = file_repository

    async def execute(self, command: MarkFileReadyCommand) -> FileDto:
        file = await self.file_repository.find_by_id(command.file_id)
        if not file:
            raise FileNotFoundException(command.file_id)

        # Brand-scope check — a caller can only ready files belonging to their brand
        if file.brand_id != command.brand_id:
            raise FileNotFoundException(command.file_id)

        # Idempotent: re-marking a READY file is a no-op
        if file.status == FileStatus.READY:
            return FileDto.from_entity(file)

        # Verify the object actually landed on storage before trusting the client
        exists = await self.storage_service.exists(
            bucket=file.bucket,
            object_name=file.storage_path,
        )
        if not exists:
            raise FileNotUploadedException(file.id, file.storage_path)

        if command.actual_size is not None and command.actual_size > 0:
            file.file_size = command.actual_size

        file.status = FileStatus.READY
        await self.file_repository.save(file)

        return FileDto.from_entity(file)
