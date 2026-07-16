"""Delete file command."""
from dataclasses import dataclass


@dataclass
class DeleteFileCommand:
    """Command to soft-delete a file and remove it from storage."""

    file_id: str
    brand_id: str   # used to verify ownership before deletion
