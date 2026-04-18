"""File domain entity."""
from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class File:
    """File domain entity representing an uploaded file."""
    
    id: str
    filename: str
    original_filename: str
    file_type: str  # e.g., 'image', 'document', 'video'
    mime_type: str  # e.g., 'application/pdf', 'image/png'
    file_size: int  # in bytes
    storage_path: str
    bucket: str
    user_id: str
    brand_id: str
    uploaded_at: datetime
    updated_at: Optional[datetime] = None
    metadata: Optional[dict] = None
    program_id: Optional[str] = None
    asset_type: Optional[str] = None  # e.g., 'logo', 'banner', 'gallery', 'document', 'certificate'
    alt_text: Optional[str] = None
    title: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    
    # Backward compatibility aliases
    @property
    def content_type(self) -> str:
        """Alias for mime_type."""
        return self.mime_type
    
    @property
    def size(self) -> int:
        """Alias for file_size."""
        return self.file_size
    
    def is_image(self) -> bool:
        """Check if file is an image."""
        return self.mime_type.startswith('image/')
    
    def is_document(self) -> bool:
        """Check if file is a document."""
        document_types = ['application/pdf', 'application/msword', 
                         'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
        return self.mime_type in document_types
    
    def is_valid_size(self, max_size_bytes: int) -> bool:
        """Validate file size against maximum allowed."""
        return self.file_size <= max_size_bytes
    
    def get_extension(self) -> str:
        """Get file extension from filename."""
        return self.filename.split('.')[-1].lower() if '.' in self.filename else ''
