"""Upload file command handler."""
import uuid
import os
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
    
    # Public Categories
    PUBLIC_CATEGORIES = [
        'gallery',
        'programs',
        'banners',
        'assets',
        'partners',
        'sponsors',
        'speakers',
        'content',
        'announcements',
        'faq',
        'payment_icons',
        'payment_methods'
    ]
    
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
        # Confirm allowed file types
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
        
        # Determine unique file ID
        file_id = str(uuid.uuid4())
        extension = command.filename.split('.')[-1] if '.' in command.filename else ''
        storage_filename = f"{file_id}.{extension}" if extension else file_id

        # Use shared service to generate path
        from app.application.services.file_path_service import FilePathService
        storage_path, real_bucket, path_metadata = FilePathService.get_storage_path(
            brand_id=command.brand_id,
            user_id=command.user_id,
            bucket=command.bucket,
            filename=storage_filename,
            program_id=command.program_id,
            participant_id=command.participant_id
        )
        
        # Prepare metadata to save
        file_metadata = command.metadata or {}
        file_metadata.update(path_metadata)
        
        # Determine visibility
        is_public = command.bucket in self.PUBLIC_CATEGORIES

        # Upload to storage
        await self.storage_service.upload(
            bucket=real_bucket,
            object_name=storage_path,
            file_data=command.file_data,
            content_type=command.content_type,
            size=command.size,
            is_public=is_public
        )
        
        # Determine file type from content type
        if command.content_type.startswith('image/'):
            file_type = 'image'
        elif command.content_type == 'application/pdf':
            file_type = 'document'
        elif command.content_type in ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']:
            file_type = 'document'
        elif command.content_type in ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']:
            file_type = 'spreadsheet'
        else:
            file_type = 'other'
        
        # Create domain entity
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
            metadata=file_metadata,
            program_id=command.program_id,
            asset_type=command.asset_type,
        )
        
        # Save metadata to repository
        saved_file = await self.file_repository.save(file_entity)
        
        # Return DTO
        return FileDto.from_entity(saved_file)
