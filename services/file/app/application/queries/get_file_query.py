"""Get file query."""
from dataclasses import dataclass


@dataclass
class GetFileQuery:
    """Query to get file by ID."""
    
    file_id: str
    user_id: str
    brand_id: str
    generate_download_url: bool = True
