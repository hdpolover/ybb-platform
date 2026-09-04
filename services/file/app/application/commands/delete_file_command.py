"""Delete file command."""
from dataclasses import dataclass
from typing import Optional


@dataclass
class DeleteFileCommand:
    """Command to soft-delete a file and remove it from storage."""

    file_id: str
    brand_id: str   # used to verify ownership before deletion
    program_id: Optional[str] = None  # narrows ownership to one programme
