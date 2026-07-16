"""List files by program query."""
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ListFilesByProgramQuery:
    """Query to list files belonging to a program (for the media library)."""

    program_id: str
    brand_id: str
    asset_type: Optional[str] = None   # filter: 'image' | 'document' | specific asset type
    bucket: Optional[str] = None       # filter by storage bucket/category
    page: int = 1
    limit: int = 50
