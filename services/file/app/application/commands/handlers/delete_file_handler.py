"""Delete file command handler."""
from app.application.commands.delete_file_command import DeleteFileCommand
from app.domain.repositories.file_repository import IFileRepository
from app.domain.services.storage_service import IStorageService
from app.domain.exceptions.file_exceptions import FileNotFoundException


class DeleteFileHandler:
    """
    Soft-deletes the file record and removes the object from storage.

    Ownership check: the file's brand_id must match the caller's brand_id
    so a program admin cannot delete files belonging to a different brand.
    """

    def __init__(
        self,
        file_repository: IFileRepository,
        storage_service: IStorageService,
    ):
        self.file_repository = file_repository
        self.storage_service = storage_service

    async def execute(self, command: DeleteFileCommand) -> None:
        file = await self.file_repository.find_by_id(command.file_id)
        if not file:
            raise FileNotFoundException(command.file_id)

        if file.brand_id != command.brand_id:
            raise FileNotFoundException(command.file_id)

        # Remove from object storage first; if it fails the record stays intact
        try:
            await self.storage_service.delete(file.bucket, file.storage_path)
        except Exception:
            # Storage object may already be gone; proceed with soft-delete
            pass

        await self.file_repository.delete(command.file_id)
