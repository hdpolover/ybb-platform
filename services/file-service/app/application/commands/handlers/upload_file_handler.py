"""Upload file command handler."""
import uuid
from datetime import datetime
from app.application.commands.upload_file_command import UploadFileCommand
from app.application.dto.file_dto import FileDto
from app.domain.entities.file import File
from app.domain.repositories.file_repository import IFileRepository
from app.domain.services.storage_service import IStorageService
from app.domain.exceptions.file_exceptions import (
    InvalidFileTypeException,
    FileSizeLimitException
)


class UploadFileHandler:
    """Handler for uploading files."""
    
    # Allowed file types
    ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    ALLOWED_DOCUMENT_TYPES = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
    
    # Size limits (in bytes)
    MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB
    MAX_DOCUMENT_SIZE = 10 * 1024 * 1024  # 10MB
    
    def __init__(
        self,
        storage_service: IStorageService,
        file_repository: IFileRepository
    ):
        """Initialize handler with dependencies."""
        self.storage_service = storage_service
        self.file_repository = file_repository
    
    async def execute(self, command: UploadFileCommand) -> FileDto:
        """
        Execute file upload.
        
        Args:
            command: Upload file command
            
        Returns:
            FileDto with uploaded file information
            
        Raises:
            InvalidFileTypeException: If file type not allowed
            FileSizeLimitException: If file exceeds size limit
        """
        # Validate file type
        allowed_types = self.ALLOWED_IMAGE_TYPES + self.ALLOWED_DOCUMENT_TYPES
        if command.content_type not in allowed_types:
            raise InvalidFileTypeException(command.content_type, allowed_types)
        
        # Validate file size
        if command.content_type in self.ALLOWED_IMAGE_TYPES:
            max_size = self.MAX_IMAGE_SIZE
        else:
            max_size = self.MAX_DOCUMENT_SIZE
        
        if command.size > max_size:
            raise FileSizeLimitException(command.size, max_size)
        
        # Generate unique file ID and storage path
        file_id = str(uuid.uuid4())
        extension = command.filename.split('.')[-1] if '.' in command.filename else ''
        storage_filename = f"{file_id}.{extension}" if extension else file_id
        storage_path = f"{command.brand_id}/{command.user_id}/{storage_filename}"
        
        # Upload to storage
        await self.storage_service.upload(
            bucket=command.bucket,
            object_name=storage_path,
            file_data=command.file_data,
            content_type=command.content_type,
            size=command.size
        )
        
        # Create domain entity
        file_entity = File(
            id=file_id,
            filename=storage_filename,
            original_filename=command.filename,
            content_type=command.content_type,
            size=command.size,
            bucket=command.bucket,
            storage_path=storage_path,
            user_id=command.user_id,
            brand_id=command.brand_id,
            uploaded_at=datetime.utcnow(),
            metadata=command.metadata
        )
        
        # Save metadata to repository
        saved_file = await self.file_repository.save(file_entity)
        
        # Return DTO
        return FileDto.from_entity(saved_file)
