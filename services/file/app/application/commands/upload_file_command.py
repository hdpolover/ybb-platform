"""Upload file command."""
from dataclasses import dataclass
from typing import BinaryIO, Optional


@dataclass
class UploadFileCommand:
    """Command to upload a file."""
    
    file_data: BinaryIO
    filename: str
    content_type: str
    size: int
    user_id: str
    brand_id: str
    bucket: str = "documents"
    metadata: Optional[dict] = None
