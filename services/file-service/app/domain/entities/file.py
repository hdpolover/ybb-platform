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
    content_type: str
    size: int
    bucket: str
    storage_path: str
    user_id: str
    brand_id: str
    uploaded_at: datetime
    metadata: Optional[dict] = None
    
    def is_image(self) -> bool:
        """Check if file is an image."""
        return self.content_type.startswith('image/')
    
    def is_document(self) -> bool:
        """Check if file is a document."""
        document_types = ['application/pdf', 'application/msword', 
                         'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
        return self.content_type in document_types
    
    def is_valid_size(self, max_size_bytes: int) -> bool:
        """Validate file size against maximum allowed."""
        return self.size <= max_size_bytes
    
    def get_extension(self) -> str:
        """Get file extension from filename."""
        return self.filename.split('.')[-1].lower() if '.' in self.filename else ''
