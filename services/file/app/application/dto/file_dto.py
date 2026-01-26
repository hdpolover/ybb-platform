"""File DTOs."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.domain.entities.file import File


class FileDto(BaseModel):
    """Data transfer object for file."""
    
    id: str
    filename: str
    original_filename: str
    content_type: str
    size: int
    bucket: str
    storage_path: str
    user_id: str
    brand_id: str
    uploaded_at: datetime
    download_url: Optional[str] = None
    url: Optional[str] = None
    metadata: Optional[dict] = None
    
    @staticmethod
    def from_entity(file: File, download_url: Optional[str] = None, url: Optional[str] = None) -> 'FileDto':
        """Convert domain entity to DTO."""
        return FileDto(
            id=file.id,
            filename=file.filename,
            original_filename=file.original_filename,
            content_type=file.content_type,
            size=file.size,
            bucket=file.bucket,
            storage_path=file.storage_path,
            user_id=file.user_id,
            brand_id=file.brand_id,
            uploaded_at=file.uploaded_at,
            download_url=download_url,
            url=url,
            metadata=file.metadata
        )


class UploadFileResponseDto(BaseModel):
    """Response DTO for file upload."""
    
    file: FileDto
    message: str = "File uploaded successfully"
