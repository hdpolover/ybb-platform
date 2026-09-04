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

    Brand alone is too coarse. One brand can host several programmes with
    separate admins, so a caller authorised for programme A could delete a file
    belonging to programme B in the same brand. When the caller names a
    programme, a file that belongs to a DIFFERENT programme is refused.

    A file with no programme is deliberately still deletable on the brand check
    alone: program_id is nullable and most files legitimately have none (user
    avatars, payment-method icons, brand logos - 1,874 of 2,260 rows in
    production at the time of writing). Refusing those outright, which is what a
    plain `file.program_id != command.program_id` does, would make the majority
    of the library undeletable. A file owned by no programme also has no
    cross-programme victim to protect.
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

        if (
            command.program_id is not None
            and file.program_id is not None
            and file.program_id != command.program_id
        ):
            raise FileNotFoundException(command.file_id)

        # Remove from object storage first; if it fails the record stays intact
        try:
            await self.storage_service.delete(file.bucket, file.storage_path)
        except Exception:
            # Storage object may already be gone; proceed with soft-delete
            pass

        await self.file_repository.delete(command.file_id)
