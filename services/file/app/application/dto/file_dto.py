"""File DTOs."""
from datetime import datetime
from typing import Optional, List
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
    updated_at: Optional[datetime] = None
    download_url: Optional[str] = None
    url: Optional[str] = None
    metadata: Optional[dict] = None
    program_id: Optional[str] = None
    asset_type: Optional[str] = None
    
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
            updated_at=file.updated_at,
            download_url=download_url,
            url=url,
            metadata=file.metadata,
            program_id=file.program_id,
            asset_type=file.asset_type,
        )


class UploadFileResponseDto(BaseModel):
    """Response DTO for file upload."""
    
    file: FileDto
    message: str = "File uploaded successfully"


class PaginatedFilesDto(BaseModel):
    """Paginated list of files."""

    files: List[FileDto]
    total: int
    page: int
    limit: int
    total_pages: int
